/**
 * cpu-usage.ts — 把累计 CPU 时间换算成占用率。
 *
 * 使用场景：运行指标的主机 CPU 与各进程 CPU 曲线（GET /api/sfmc/metrics 与资源历史落库）。
 * 占用率口径与任务管理器一致：以整机全部逻辑核为 100%，各进程之和不超过主机。
 * 两次读数间隔太短时沿用上一次的结果，避免 Linux ps 秒级精度在短窗口里跳成 0% / 100%。
 */
import os from "node:os";

/** 两次读数的最短间隔（毫秒）。间隔不足时不更新基线，直接返回上一次的占用率。 */
export const CPU_MIN_WINDOW_MS = 5_000;

/** 占用率保留一位小数，并收在 0–100 之间。 */
function toPercent(ratio: number): number {
  return Math.round(Math.min(100, Math.max(0, ratio * 100)) * 10) / 10;
}

/**
 * 主机整机 CPU 占用率。
 * 使用场景：status 路由每次采集资源时调用一次；第一次没有基线，返回 null，不拿开机以来的平均值冒充当前值。
 */
export class HostCpuMeter {
  private last: { idle: number; total: number; at: number; percent: number | null } | null = null;
  /** @param readCpus 读取各核累计时间，默认 os.cpus()；单独传入便于替换数据源。 */
  constructor(
    private readCpus: () => os.CpuInfo[] = os.cpus,
    private minWindowMs = CPU_MIN_WINDOW_MS,
  ) {}

  measure(now = Date.now()): number | null {
    if (this.last && now - this.last.at < this.minWindowMs) return this.last.percent;
    let idle = 0;
    let total = 0;
    for (const cpu of this.readCpus()) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }
    const previous = this.last;
    const deltaTotal = previous ? total - previous.total : 0;
    const percent = previous && deltaTotal > 0 ? toPercent(1 - (idle - previous.idle) / deltaTotal) : null;
    this.last = { idle, total, at: now, percent };
    return percent;
  }
}

/** 一个待换算的进程读数。key 是角色键（db、bds、daemon、sidecar:<id> 等），同一角色换了 PID 视为新进程。 */
export interface CpuReading {
  key: string;
  pid: number;
  running: boolean;
  cpuSeconds: number | null;
}

/**
 * 各进程 CPU 占用率。
 * 使用场景：status 路由把 BDS、数据服务和已登记进程的累计 CPU 秒数一并交给 measure，按角色键取回占用率。
 * 本轮没出现的角色会被丢弃，附属进程反复启停时基线表不会无限增长。
 */
export class ProcessCpuMeter {
  private last = new Map<string, { pid: number; cpuSeconds: number; at: number; percent: number | null }>();
  /** @param cores 逻辑核数，默认取本机可用并行度。 */
  constructor(
    private cores = Math.max(1, os.availableParallelism()),
    private minWindowMs = CPU_MIN_WINDOW_MS,
  ) {}

  measure(rows: CpuReading[], now = Date.now()): Map<string, number | null> {
    const next = new Map<string, { pid: number; cpuSeconds: number; at: number; percent: number | null }>();
    const result = new Map<string, number | null>();
    for (const row of rows) {
      if (!row.running || row.pid <= 0 || row.cpuSeconds === null) {
        result.set(row.key, null);
        continue;
      }
      const previous = this.last.get(row.key);
      const samePid = previous?.pid === row.pid;
      if (previous && samePid && now - previous.at < this.minWindowMs) {
        next.set(row.key, previous);
        result.set(row.key, previous.percent);
        continue;
      }
      const deltaCpu = samePid && previous ? row.cpuSeconds - previous.cpuSeconds : NaN;
      const deltaWall = samePid && previous ? (now - previous.at) / 1000 : 0;
      // 累计值回退说明 PID 被复用或读数异常，这一轮只重建基线。
      const percent = deltaWall > 0 && deltaCpu >= 0 ? toPercent(deltaCpu / (deltaWall * this.cores)) : null;
      const entry = { pid: row.pid, cpuSeconds: row.cpuSeconds, at: now, percent };
      next.set(row.key, entry);
      result.set(row.key, percent);
    }
    this.last = next;
    return result;
  }
}
