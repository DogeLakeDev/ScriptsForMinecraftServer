/**
 * domain/system-status.ts — 主机 / 进程运维快照（供 GET /api/sfmc/status）
 *
 * 不依赖 bds-tools：仅读 SFMC_ROOT/.sfmc/bds.pid + OS 探活，避免 db-server 拉入重依赖。
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { stateDir } from "@sfmc-bds/sdk/node/config";

const execFileAsync = promisify(execFile);

/** 进程探活 / 启动时间查询超时，避免 status 卡住 */
const PROBE_TIMEOUT_MS = 2_000;

export type HostStatus = {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  uptimeSec: number;
  uptimeText: string;
  cpu: { model: string; cores: number };
  memory: {
    totalMb: number;
    freeMb: number;
    usedMb: number;
    usedPercent: number;
  };
  /** Linux 有意义；Windows 常为 [0,0,0] */
  loadavg: [number, number, number];
};

export type ProcessUptime = {
  pid: number;
  uptimeSec: number | null;
  uptimeText: string;
  running: boolean;
};

export type BdsStatus = ProcessUptime & {
  state: "running" | "stopped";
};

export type SystemStatusSnapshot = {
  host: HostStatus;
  db: ProcessUptime;
  bds: BdsStatus;
};

/** 人类可读运行时长 */
export function formatUptimeSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (d > 0) return `${d}天${h}时${m}分`;
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${r}秒`;
  return `${r}秒`;
}

export function collectHostStatus(nowSec = os.uptime()): HostStatus {
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(0, total - free);
  const load = os.loadavg();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptimeSec: Math.floor(nowSec),
    uptimeText: formatUptimeSec(nowSec),
    cpu: {
      model: (cpus[0]?.model ?? "unknown").replace(/\s+/g, " ").trim().slice(0, 48),
      cores: cpus.length,
    },
    memory: {
      totalMb: Math.round(total / (1024 * 1024)),
      freeMb: Math.round(free / (1024 * 1024)),
      usedMb: Math.round(used / (1024 * 1024)),
      usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
    },
    loadavg: [round1(load[0] ?? 0), round1(load[1] ?? 0), round1(load[2] ?? 0)],
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function readBdsPidFile(projectRoot: string): number {
  try {
    const file = path.join(stateDir(projectRoot), "bds.pid");
    return parseInt(fs.readFileSync(file, "utf-8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function isPidAlive(pid: number): Promise<boolean> {
  if (!pid) return false;
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync(
        "tasklist",
        ["/fi", `PID eq ${pid}`, "/nh"],
        { windowsHide: true, timeout: PROBE_TIMEOUT_MS }
      );
      return String(stdout).includes(String(pid));
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 查询进程已运行秒数；失败返回 null */
async function getProcessUptimeSec(pid: number): Promise<number | null> {
  if (!pid) return null;
  try {
    if (process.platform === "win32") {
      // 用 etimes 等价：从 StartTime 算到现在（秒）
      const script = `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime | ForEach-Object { [int]((Get-Date) - $_).TotalSeconds }`;
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true, timeout: PROBE_TIMEOUT_MS, encoding: "utf8" }
      );
      const n = parseInt(String(stdout).trim(), 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    // Linux: ps etimes（已运行秒）
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "etimes="], {
      timeout: PROBE_TIMEOUT_MS,
      encoding: "utf8",
    });
    const n = parseInt(String(stdout).trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

async function findBedrockServerPid(): Promise<number> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync(
        "tasklist",
        ["/fi", "IMAGENAME eq bedrock_server.exe", "/fo", "csv", "/nh"],
        { windowsHide: true, timeout: PROBE_TIMEOUT_MS }
      );
      for (const line of String(stdout).split(/\r?\n/)) {
        const m = line.match(/"bedrock_server\.exe","(\d+)"/i);
        if (m) {
          const pid = parseInt(m[1] ?? "0", 10);
          if (pid > 0) return pid;
        }
      }
      return 0;
    }
    const { stdout } = await execFileAsync("pgrep", ["-x", "bedrock_server"], {
      timeout: PROBE_TIMEOUT_MS,
    });
    const pid = parseInt(String(stdout).trim().split(/\r?\n/)[0] ?? "0", 10);
    return pid > 0 ? pid : 0;
  } catch {
    return 0;
  }
}

export async function collectBdsStatus(projectRoot: string): Promise<BdsStatus> {
  let pid = readBdsPidFile(projectRoot);
  const alive = pid > 0 ? await withTimeout(isPidAlive(pid), PROBE_TIMEOUT_MS) : false;
  if (!alive) {
    pid = (await withTimeout(findBedrockServerPid(), PROBE_TIMEOUT_MS)) ?? 0;
  }
  if (!pid) {
    return { state: "stopped", running: false, pid: 0, uptimeSec: null, uptimeText: "未运行" };
  }
  const stillAlive = alive === true || (await withTimeout(isPidAlive(pid), PROBE_TIMEOUT_MS)) === true;
  if (!stillAlive) {
    return { state: "stopped", running: false, pid: 0, uptimeSec: null, uptimeText: "未运行" };
  }
  const uptimeSec = await withTimeout(getProcessUptimeSec(pid), PROBE_TIMEOUT_MS);
  return {
    state: "running",
    running: true,
    pid,
    uptimeSec,
    uptimeText: uptimeSec != null ? formatUptimeSec(uptimeSec) : "运行中",
  };
}

export function collectDbStatus(): ProcessUptime {
  const uptimeSec = Math.floor(process.uptime());
  return {
    pid: process.pid,
    running: true,
    uptimeSec,
    uptimeText: formatUptimeSec(uptimeSec),
  };
}

/** 组装完整系统快照（host 同步；bds 异步探活） */
export async function collectSystemStatus(projectRoot: string): Promise<SystemStatusSnapshot> {
  return {
    host: collectHostStatus(),
    db: collectDbStatus(),
    bds: await collectBdsStatus(projectRoot),
  };
}
