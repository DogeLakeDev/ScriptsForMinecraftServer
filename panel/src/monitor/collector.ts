/**
 * monitor/collector.ts — 周期性数据采集
 */

import os from "node:os";
import { exec } from "node:child_process";
// @ts-expect-error pidusage 没有官方类型
import pidusage from "pidusage";
import { set } from "../store.js";
import { services } from "../services/manager.js";
import { getDbBaseUrl } from "../api/client.js";
import type { ServiceName } from "../store.js";

let _timer: ReturnType<typeof setInterval> | null = null;
let _prevSys: { idle: number; tick: number } | null = null;
let _prevPanel: { cpu: ReturnType<typeof process.cpuUsage>; at: number } | null = null;
let _tick = 0;

function collectSystem(): void {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  set((s) => ({
    monitor: {
      ...s.monitor,
      systemMemPct: total > 0 ? Math.round((used / total) * 100) : 0,
      systemMemUsedMb: Math.round(used / 1048576),
      systemMemTotalMb: Math.round(total / 1048576),
    },
  }));
}

function collectSystemCpu(): void {
  const cpus = os.cpus();
  let idle = 0;
  let tick = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    tick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  if (_prevSys) {
    const dIdle = idle - _prevSys.idle;
    const dTick = tick - _prevSys.tick;
    const pct = dTick > 0 ? Math.round((1 - dIdle / dTick) * 100) : 0;
    set((s) => ({ monitor: { ...s.monitor, systemCpu: pct } }));
  }
  _prevSys = { idle, tick };
}

function collectProcs(): void {
  const curPU = process.cpuUsage();
  const curTime = Date.now();
  let panelCPU = 0;
  if (_prevPanel) {
    const dUser = curPU.user - _prevPanel.cpu.user;
    const dSys = curPU.system - _prevPanel.cpu.system;
    const dWall = curTime - _prevPanel.at;
    panelCPU = dWall > 0 ? Math.min(100, Math.round(((dUser + dSys) / (dWall * 1000)) * 100)) : 0;
  }
  _prevPanel = { cpu: curPU, at: curTime };
  set((s) => ({
    services: {
      ...s.services,
      panel: { ...s.services.panel, running: true, pid: process.pid, cpu: panelCPU, memMb: Math.round(process.memoryUsage().rss / 1048576) },
    },
  }));

  const jobs: Array<{ name: Exclude<ServiceName, "panel">; pid: number }> = [];
  for (const name of ["bds", "db", "qq", "llbot"] as const) {
    const svc = services[name];
    if (svc?.pid) jobs.push({ name, pid: svc.pid });
  }
  for (const name of ["bds", "db", "qq", "llbot"] as const) {
    if (!jobs.find((j) => j.name === name)) {
      const n = name;
      set((s) => ({ services: { ...s.services, [n]: { ...s.services[n], cpu: 0, memMb: null } } }));
    }
  }
  if (jobs.length === 0) return;
  pidusage(jobs.map((j) => j.pid))
    .then((results: Record<number, { memory: number; cpu: number }>) => {
      for (const j of jobs) {
        const info = results[j.pid];
        const cpu = info ? Math.min(100, Math.round(info.cpu * 100) / 100) : 0;
        const mem = info ? Math.round(info.memory / 1048576) : null;
        const n = j.name;
        set((s) => ({ services: { ...s.services, [n]: { ...s.services[n], cpu, memMb: mem } } }));
      }
    })
    .catch(() => {
      for (const j of jobs) queryTasklistMem(j);
    });
}

function queryTasklistMem(j: { name: Exclude<ServiceName, "panel">; pid: number }): void {
  exec(`tasklist /FI "PID eq ${j.pid}" /FO CSV /NH`, { timeout: 2000 }, (err, stdout) => {
    if (err) return;
    const line = stdout.trim();
    if (!line) return;
    const parts = line.match(/"([^"]*)"/g);
    if (parts && parts.length >= 5 && parts[4]) {
      const kb = parseInt(parts[4].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(kb)) {
        const n = j.name;
        set((s) => ({ services: { ...s.services, [n]: { ...s.services[n], memMb: Math.round(kb / 1024) } } }));
      }
    }
  });
}

async function fetchMonitorSummary(): Promise<void> {
  try {
    const res = await fetch(`${getDbBaseUrl()}/api/sfmc/monitor/summary`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const d = (await res.json()) as {
      tps?: number;
      entities?: Record<string, number>;
      players?: Array<{ name: string; dimension: string; chunkEstimate?: number; clientEntities?: number }>;
      totalChunks?: number;
    };
    const entitiesTotal = Object.values(d.entities ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    set((s) => ({
      monitor: {
        ...s.monitor,
        tps: d.tps ?? 0,
        entitiesTotal,
        totalChunks: d.totalChunks ?? 0,
        players: (d.players ?? []).map((p) => ({
          name: p.name,
          dimension: p.dimension,
          chunkEstimate: p.chunkEstimate ?? 0,
          clientEntities: p.clientEntities ?? 0,
        })),
        summaryAt: Date.now(),
        tick: _tick,
      },
    }));
  } catch {
    /* db-server 不可达 */
  }
}

async function poll(): Promise<void> {
  _tick++;
  collectSystem();
  collectSystemCpu();
  collectProcs();
  await fetchMonitorSummary();
}

export function startMonitor(): void {
  if (_timer) return;
  void poll();
  _timer = setInterval(() => void poll(), 3000);
}

export function stopMonitor(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
