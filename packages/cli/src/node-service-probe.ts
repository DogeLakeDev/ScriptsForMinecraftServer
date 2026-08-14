/**
 * node-service-probe.ts — 按入口脚本探测 / 终止「外部」node 服务（db / qq）
 *
 * CLI 未托管（无 ChildProcess 句柄）时，stop/restart 仍须能杀干净，避免双实例。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";
import { isProcessAlive } from "@sfmc-bds/bds-tools/process-probe";

const execFileAsync = promisify(execFile);

/** 可按脚本路径杀的 node 服务 */
export type NodeServiceName = "db" | "qq";

/** cmdline 匹配用稳定子串（跨 monorepo / npm 布局） */
export const SCRIPT_HINT: Record<NodeServiceName, string> = {
  db: "db-server/dist/index.js",
  qq: "qq-bridge/dist/index.js",
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function matchesService(cmdline: string, service: NodeServiceName): boolean {
  const n = normalizePath(cmdline);
  const hint = SCRIPT_HINT[service];
  if (!n.includes(hint)) return false;
  // 避免误伤：必须是 node 跑该入口
  return /\bnode(?:\.exe)?\b/i.test(cmdline) || n.includes("node");
}

async function listCandidatePids(service: NodeServiceName): Promise<number[]> {
  const hint = SCRIPT_HINT[service];

  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "wmic",
        ["process", "where", "name='node.exe'", "get", "ProcessId,CommandLine", "/FORMAT:CSV"],
        { windowsHide: true, timeout: 8000 }
      );
      const pids: number[] = [];
      for (const line of String(stdout).split(/\r?\n/)) {
        if (!line.trim() || /^Node,/i.test(line.trim())) continue;
        if (!matchesService(line, service)) continue;
        const parts = line.split(",");
        const pid = parseInt(parts[parts.length - 1]?.trim() || "", 10);
        if (!pid || pid === process.pid) continue;
        pids.push(pid);
      }
      return [...new Set(pids)];
    } catch {
      return [];
    }
  }

  try {
    const { stdout } = await execFileAsync("pgrep", ["-af", hint], { timeout: 5000 });
    const pids: number[] = [];
    for (const line of String(stdout).split(/\n/)) {
      if (!matchesService(line, service)) continue;
      const pid = parseInt(line.trim().split(/\s+/)[0] || "", 10);
      if (!pid || pid === process.pid) continue;
      pids.push(pid);
    }
    return [...new Set(pids)];
  } catch {
    // pgrep 无匹配时退出码 1
    return [];
  }
}

/**
 * 查找匹配入口脚本的存活 PID（不含当前 CLI 进程）。
 */
export async function findNodeServicePids(service: NodeServiceName): Promise<number[]> {
  const pids = await listCandidatePids(service);
  const alive: number[] = [];
  for (const pid of pids) {
    if (await isProcessAlive(pid)) alive.push(pid);
  }
  return [...new Set(alive)];
}

function killPid(pid: number, sig: NodeJS.Signals): void {
  try {
    process.kill(pid, sig);
  } catch {
    /* ignore */
  }
}

/**
 * 终止匹配脚本的全部外部实例；返回尝试杀掉的 PID 列表。
 */
export async function killNodeServiceByScript(service: NodeServiceName): Promise<number[]> {
  const pids = await findNodeServicePids(service);
  for (const pid of pids) {
    killPid(pid, "SIGTERM");
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    let any = false;
    for (const pid of pids) {
      if (await isProcessAlive(pid)) {
        any = true;
        break;
      }
    }
    if (!any) return pids;
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const pid of pids) {
    if (await isProcessAlive(pid)) killPid(pid, "SIGKILL");
  }
  return pids;
}
