/**
 * tracked-processes.ts — 采集本实例已登记的其它 SFMC 进程内存。
 *
 * 使用场景：运行指标除 BDS、数据服务外，还要列出守护进程、QQ 桥、隧道、LLBot 和模块附属进程。
 * 只读这些进程自己写下的运行态文件，不按进程名全机扫描，避免把同机另一个程序算进来。
 * 界面名称与桌面端 metric-series.ts 的 sfmcPartLabel 一致。
 */

import { qqRuntimeStatusPath, stateDir } from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import path from "node:path";
import { collectProcessResourcesMany } from "./process-resources.js";

/** 一条已确认仍在运行的进程。内存采不到的不返回，避免把过期 PID 显示成「资源未知」。 */
export interface TrackedProcess {
  /** daemon、qq、tunnel、llbot，或 sidecar:<模块 id> */
  key: string;
  /** 侧栏和曲线用的名称 */
  label: string;
  pid: number;
  running: true;
  memoryMb: number;
  cpuSeconds: number | null;
  /** CPU 占用率（整机为 100%）。由 status 路由的 ProcessCpuMeter 补上，这里采集时不填。 */
  cpuPercent?: number | null;
}

/** 单进程运行态文件。路径都在 `<根>/.sfmc` 下，与写入方使用的文件名一致。 */
const ROLE_FILES: Array<{ key: string; label: string; file: (root: string) => string }> = [
  { key: "daemon", label: "守护进程", file: (root) => path.join(stateDir(root), "daemon.json") },
  { key: "qq", label: "QQ 桥", file: (root) => qqRuntimeStatusPath(root) },
  { key: "tunnel", label: "隧道", file: (root) => path.join(stateDir(root), "tunnel.runtime.json") },
  { key: "llbot", label: "LLBot", file: (root) => path.join(stateDir(root), "llbot.runtime.json") },
];

/**
 * 从运行态 JSON 里取出 pid。
 * 使用场景：daemon.json、qq.runtime.json 等只借 pid 字段，其余内容（例如鉴权 token）不读取、不返回。
 */
export function readRecordedPid(text: string): number {
  try {
    const pid = (JSON.parse(text) as { pid?: unknown }).pid;
    return typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0 ? pid : 0;
  } catch {
    return 0;
  }
}

/** 附属进程清单。id 只接受模块标识，避免把任意字符串写进指标键。 */
function readSidecars(text: string): Array<{ id: string; pid: number }> {
  try {
    const processes = (JSON.parse(text) as { processes?: unknown }).processes;
    if (!Array.isArray(processes)) return [];
    const rows: Array<{ id: string; pid: number }> = [];
    for (const item of processes) {
      if (!item || typeof item !== "object") continue;
      const row = item as { id?: unknown; pid?: unknown };
      if (typeof row.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(row.id)) continue;
      if (typeof row.pid !== "number" || !Number.isSafeInteger(row.pid) || row.pid <= 0) continue;
      rows.push({ id: row.id, pid: row.pid });
    }
    return rows;
  } catch {
    return [];
  }
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * 采集仍在运行的已登记进程。
 * @param root 实例根目录。
 * @param skip 已经单独统计过的 PID（数据服务、本实例 BDS），这里不再重复计入。
 */
export async function collectTrackedProcesses(root: string, skip: ReadonlySet<number>): Promise<TrackedProcess[]> {
  const wanted: Array<{ key: string; label: string; pid: number }> = [];
  const seen = new Set<number>(skip);
  for (const role of ROLE_FILES) {
    const pid = readRecordedPid(readText(role.file(root)));
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    wanted.push({ key: role.key, label: role.label, pid });
  }
  for (const row of readSidecars(readText(path.join(stateDir(root), "sidecars.runtime.json")))) {
    if (seen.has(row.pid)) continue;
    seen.add(row.pid);
    wanted.push({ key: `sidecar:${row.id}`, label: row.id, pid: row.pid });
  }
  if (!wanted.length) return [];
  const measured = await collectProcessResourcesMany(wanted.map((row) => row.pid));
  const found: TrackedProcess[] = [];
  for (const row of wanted) {
    const usage = measured.get(row.pid);
    if (!usage) continue;
    found.push({
      key: row.key,
      label: row.label,
      pid: row.pid,
      running: true,
      memoryMb: usage.memoryMb,
      cpuSeconds: usage.cpuSeconds,
    });
  }
  return found;
}
