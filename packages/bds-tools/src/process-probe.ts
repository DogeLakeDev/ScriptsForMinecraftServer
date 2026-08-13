/**
 * process-probe.ts — OS 级 BDS 进程探测与 PID 文件管理
 *
 * 供 bds-manager / sfmc 共用，避免重复 tasklist / taskkill 逻辑。
 */

import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeRoot, stateDir } from "@sfmc-bds/sdk/node/config";
import { bdsExeName } from "./host-platform.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 与 paths.ROOT_DIR 一致：SFMC_ROOT > walk-up monorepo */
const DEFAULT_ROOT_DIR = resolveRuntimeRoot(__dirname);

export type ExecFn = (
  cmd: string,
  opts?: { windowsHide?: boolean }
) => Promise<{ stdout: string; stderr: string }>;

let execImpl: ExecFn = async (cmd, opts) => {
  const result = await execAsync(cmd, opts);
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
};

/** 测试注入 exec，传 null 恢复默认 */
export function setExecForTesting(fn: ExecFn | null): void {
  execImpl =
    fn ??
    (async (cmd, opts) => {
      const result = await execAsync(cmd, opts);
      return { stdout: String(result.stdout), stderr: String(result.stderr) };
    });
}

function resolveRoot(rootDir?: string): string {
  return rootDir ?? DEFAULT_ROOT_DIR;
}

function pidFilePath(rootDir?: string): string {
  return path.join(stateDir(resolveRoot(rootDir)), "bds.pid");
}

function ensureStateDirForRoot(rootDir?: string): void {
  fs.mkdirSync(stateDir(resolveRoot(rootDir)), { recursive: true });
}

export function readBdsPidFile(rootDir?: string): number {
  try {
    return parseInt(fs.readFileSync(pidFilePath(rootDir), "utf-8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBdsPidFile(pid: number, rootDir?: string): void {
  try {
    ensureStateDirForRoot(rootDir);
    fs.writeFileSync(pidFilePath(rootDir), String(pid));
  } catch {
    /* ignore */
  }
}

export function clearBdsPidFile(rootDir?: string): void {
  try {
    const file = pidFilePath(rootDir);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

let aliveOverride: ((pid: number) => boolean) | null = null;

/** 测试注入探活，传 null 恢复默认（避免 Linux 上 process.kill 碰到真实 PID） */
export function setIsAliveForTesting(fn: ((pid: number) => boolean) | null): void {
  aliveOverride = fn;
}

export async function isProcessAlive(pid: number): Promise<boolean> {
  if (!pid) return false;
  if (aliveOverride) return aliveOverride(pid);
  try {
    if (process.platform === "win32") {
      const { stdout } = await execImpl(`tasklist /fi "PID eq ${pid}" /nh`, { windowsHide: true });
      return stdout.includes(String(pid));
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 同步探活（供 sync 的 sendCommand 等路径；避免 Promise 被当 truthy） */
export function isProcessAliveSync(pid: number): boolean {
  if (!pid) return false;
  if (aliveOverride) return aliveOverride(pid);
  try {
    if (process.platform === "win32") {
      const stdout = execSync(`tasklist /fi "PID eq ${pid}" /nh`, {
        windowsHide: true,
        encoding: "utf8",
      });
      return String(stdout).includes(String(pid));
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function findBedrockServerPids(): Promise<number[]> {
  try {
    if (process.platform === "win32") {
      const image = bdsExeName("windows");
      const { stdout } = await execImpl(`tasklist /fi "IMAGENAME eq ${image}" /fo csv /nh`, {
        windowsHide: true,
      });
      const pids: number[] = [];
      const re = new RegExp(`"${image.replace(".", "\\.")}","(\\d+)"`, "i");
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(re);
        if (m) {
          const pid = parseInt(m[1] ?? "0", 10);
          if (pid > 0) pids.push(pid);
        }
      }
      return pids;
    }
    const { stdout } = await execImpl("pgrep -x bedrock_server", { windowsHide: true });
    return stdout
      .split(/\r?\n/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0);
  } catch {
    return [];
  }
}

export async function killBedrockServerByImage(): Promise<void> {
  try {
    if (process.platform === "win32") {
      await execImpl(`taskkill /f /im ${bdsExeName("windows")}`, { windowsHide: true });
    } else {
      await execImpl("pkill -x bedrock_server", { windowsHide: true });
    }
  } catch {
    /* ignore — 无进程时 taskkill/pkill 会非零退出 */
  }
}

export type BdsProbeState = "stopped" | "managed" | "external";

export interface BdsProbeResult {
  state: BdsProbeState;
  pid: number;
}

export async function probeBdsStatus(opts: {
  managedPid?: number;
  hasStdin?: boolean;
  rootDir?: string;
}): Promise<BdsProbeResult> {
  const managedPid = opts.managedPid ?? 0;
  const hasStdin = opts.hasStdin ?? false;

  if (managedPid > 0 && hasStdin && (await isProcessAlive(managedPid))) {
    return { state: "managed", pid: managedPid };
  }

  const filePid = readBdsPidFile(opts.rootDir);
  if (filePid > 0 && (await isProcessAlive(filePid))) {
    return { state: "external", pid: filePid };
  }

  const imagePids = await findBedrockServerPids();
  if (imagePids.length > 0) {
    return { state: "external", pid: imagePids[0] ?? 0 };
  }

  if (filePid > 0) {
    clearBdsPidFile(opts.rootDir);
  }

  return { state: "stopped", pid: 0 };
}
