/** GET /api/sfmc/status 与 BDS 实时快照入口。 */

import { collectSystemStatus, type SystemStatusSnapshot } from "../domain/system-status.js";
import { PROJECT_ROOT } from "../project-root.js";
import { METRICS_RAW_WINDOW_MS, MetricsHistory, ResourceHistory, clampMetricsSpan, parseMetrics, type MetricsSample } from "../domain/metrics.js";
import { collectProcessResources } from "../domain/process-resources.js";
import { collectTrackedProcesses } from "../domain/tracked-processes.js";
import { HostCpuMeter, ProcessCpuMeter } from "../domain/cpu-usage.js";
import type { QueryFn } from "../lib/sqlite.js";
import fs from "node:fs";
import pathModule from "node:path";
import { stateDir } from "@sfmc-bds/sdk/node/config";
import { body, json, type RouteFactory } from "./_shared.js";

const FRESH_MS = 60_000;

interface LiveSnapshot {
  online: Array<{ name: string }>;
  world: { day: number; difficulty: string };
  updatedAt: number;
}

interface Deps {
  collectSystem?: (projectRoot: string) => Promise<SystemStatusSnapshot>;
  projectRoot?: string;
  query?: QueryFn;
  /** 主机 CPU 占用率换算器；缺省按本机 os.cpus() 新建一个。 */
  hostCpu?: HostCpuMeter;
  /** 各进程 CPU 占用率换算器；缺省按本机逻辑核数新建一个。 */
  processCpu?: ProcessCpuMeter;
}

function createStatusRoutes({ collectSystem, projectRoot, query, hostCpu, processCpu }: Deps): ReturnType<RouteFactory> {
  const root = projectRoot ?? PROJECT_ROOT;
  const collect = collectSystem ?? collectSystemStatus;
  let live: LiveSnapshot | null = null;
  let metrics: MetricsSample | null = null;
  const history = query ? new MetricsHistory(query) : undefined;
  const resources = query ? new ResourceHistory(query) : undefined;
  const hostCpuMeter = hostCpu ?? new HostCpuMeter();
  const processCpuMeter = processCpu ?? new ProcessCpuMeter();
  let lastCapture = 0;
  const captureResources = async (system: SystemStatusSnapshot | null) => {
    if (!system) return null;
    let ownedPid = 0;
    try { ownedPid = Number(fs.readFileSync(pathModule.join(stateDir(root), "bds.pid"), "utf8").trim()); } catch { /* 未托管实例不猜测进程归属。 */ }
    const owned = Number.isSafeInteger(ownedPid) && ownedPid > 0 && system.bds.pid === ownedPid;
    const processes = {
      db: await collectProcessResources(system.db.pid, system.db.running),
      bds: owned ? await collectProcessResources(system.bds.pid, system.bds.running) : null,
    };
    const skip = new Set<number>();
    if (processes.db.pid > 0) skip.add(processes.db.pid);
    if (processes.bds && processes.bds.pid > 0) skip.add(processes.bds.pid);
    const parts = await collectTrackedProcesses(root, skip);
    const now = Date.now();
    // 累计 CPU 秒数换算成占用率：同一轮的进程一起交给换算器，主机占用率在同一时刻读取。
    const hostCpuPercent = hostCpuMeter.measure(now);
    const cpu = processCpuMeter.measure(
      [
        { key: "db", pid: processes.db.pid, running: processes.db.running, cpuSeconds: processes.db.cpuSeconds },
        ...(processes.bds ? [{ key: "bds", pid: processes.bds.pid, running: processes.bds.running, cpuSeconds: processes.bds.cpuSeconds }] : []),
        ...parts.map((part) => ({ key: part.key, pid: part.pid, running: part.running, cpuSeconds: part.cpuSeconds })),
      ],
      now,
    );
    processes.db.cpuPercent = cpu.get("db") ?? null;
    if (processes.bds) processes.bds.cpuPercent = cpu.get("bds") ?? null;
    for (const part of parts) part.cpuPercent = cpu.get(part.key) ?? null;
    const partsMb: Record<string, number> = {};
    const partsCpuPercent: Record<string, number> = {};
    for (const part of parts) {
      partsMb[part.key] = part.memoryMb;
      if (typeof part.cpuPercent === "number") partsCpuPercent[part.key] = part.cpuPercent;
    }
    resources?.append({
      recordedAt: now,
      hostUsedMb: system.host.memory.usedMb,
      dbMb: processes.db.memoryMb,
      bdsMb: processes.bds?.memoryMb ?? null,
      ...(Object.keys(partsMb).length ? { partsMb } : {}),
      hostCpuPercent,
      dbCpuPercent: processes.db.cpuPercent,
      bdsCpuPercent: processes.bds?.cpuPercent ?? null,
      ...(Object.keys(partsCpuPercent).length ? { partsCpuPercent } : {}),
    });
    lastCapture = Date.now();
    return { processes: { ...processes, ...(parts.length ? { parts } : {}) }, hostCpuPercent };
  };
  let systemCache: { data: SystemStatusSnapshot; at: number } | undefined;
  let collecting: Promise<SystemStatusSnapshot> | undefined;
  const getSystem = async () => {
    if (systemCache && Date.now() - systemCache.at < 5000) return systemCache.data;
    collecting ??= collect(root).then(data => { systemCache = { data, at: Date.now() }; return data; }).finally(() => { collecting = undefined; });
    return collecting;
  };
  if (resources) {
    const timer = setInterval(() => {
      if (Date.now() - lastCapture < 12_000) return;
      void getSystem().then(system => captureResources(system)).catch(() => undefined);
    }, 15_000);
    timer.unref();
  }

  return async function handle({ path, method, params, req, res }): Promise<boolean> {
    if (path === "/api/sfmc/status/live" || path === "/api/sfmc/metrics/live") {
      if (method !== "POST") {
        json(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      const data = await body(req);
      const raw = data.players;
      const day = data.day;
      const difficulty = data.difficulty;
      if (
        !Array.isArray(raw) || raw.length > 1000 ||
        !raw.every((name) => typeof name === "string" && name.trim().length > 0 && name.length <= 64) ||
        typeof day !== "number" || !Number.isSafeInteger(day) || day < 0 ||
        typeof difficulty !== "string" || difficulty.length > 32
      ) {
        json(res, { success: false, error: "invalid_live_status" }, 400);
        return true;
      }
      if (path === "/api/sfmc/metrics/live") {
        const sample = parseMetrics(data, Date.now());
        if (!sample) { json(res, { success: false, error: "invalid_metrics" }, 400); return true; }
        history?.append(sample);
        metrics = sample;
      }
      live = {
        online: raw.map((name: string) => ({ name: name.trim() })),
        world: { day, difficulty },
        updatedAt: Date.now(),
      };
      json(res, { success: true });
      return true;
    }

    if (path !== "/api/sfmc/status" && path !== "/api/sfmc/metrics") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    let system: SystemStatusSnapshot | null = null;
    try {
      system = await getSystem();
    } catch {
      system = null;
    }

    const now = Date.now();
    const bds = system?.bds;
    const bdsAgeMs = typeof bds?.uptimeSec === "number" ? bds.uptimeSec * 1000 : null;
    const snapshot = live;
    const fresh = snapshot !== null &&
      bds?.state === "running" &&
      now - snapshot.updatedAt <= FRESH_MS &&
      (bdsAgeMs === null || now - snapshot.updatedAt <= bdsAgeMs + 2_000);
    const current = fresh ? snapshot : null;

    if (path === "/api/sfmc/metrics") {
      // 资源指标只认当前实例的 PID，不能使用全机扫描找到的另一套 BDS。
      let ownedPid = 0;
      try { ownedPid = Number(fs.readFileSync(pathModule.join(stateDir(root), "bds.pid"), "utf8").trim()); } catch { /* 未托管实例不猜测进程归属。 */ }
      const owned = Number.isSafeInteger(ownedPid) && ownedPid > 0 && bds?.pid === ownedPid;
      const metricFresh = owned && metrics !== null && bds?.state === "running" && now - metrics.recordedAt <= 60_000 &&
        (bdsAgeMs === null || now - metrics.recordedAt <= bdsAgeMs + 2000);
      const captured = await captureResources(system);
      // 主机 CPU 占用率挂在 host.cpu 上，与核数、型号放在一起；还没有基线时为 null。
      const host = system ? { ...system.host, cpu: { ...system.host.cpu, usedPercent: captured?.hostCpuPercent ?? null } } : null;
      let span = METRICS_RAW_WINDOW_MS;
      const rawSpan = params.get("spanMs");
      if (rawSpan) {
        try { span = clampMetricsSpan(Number(rawSpan)); } catch {
          json(res, { success: false, error: "invalid_span" }, 400);
          return true;
        }
      }
      json(res, { fresh: metricFresh, current: metricFresh ? metrics : null, updatedAt: metrics?.recordedAt ?? null,
        history: history?.read(now, span) ?? [], host, processes: captured?.processes ?? null, resourcesUpdatedAt: system ? Date.now() : null,
        resourceHistory: resources?.read(now, span) ?? [],
        note: metricFresh ? undefined : bds?.state === "stopped" ? "服务器未运行" : "等待平台指标同步" });
      return true;
    }

    json(res, {
      online: current?.online ?? [],
      world: current?.world ?? null,
      updatedAt: current?.updatedAt ?? null,
      host: system?.host ?? null,
      processes: system ? { db: system.db, bds: system.bds } : null,
      source: "bds_script_live",
      note: fresh ? undefined : bds?.state === "stopped" ? "服务器未运行" : "等待游戏实时状态同步",
    });
    return true;
  };
}

export { createStatusRoutes, FRESH_MS };
