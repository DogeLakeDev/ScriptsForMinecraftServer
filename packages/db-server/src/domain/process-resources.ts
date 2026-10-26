/** 受控进程资源采集：仅允许已核验的数字 PID，失败保留未知。 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export interface ProcessResources {
  pid: number;
  running: boolean;
  memoryMb: number | null;
  cpuSeconds: number | null;
  /** 最近一段时间的 CPU 占用率（整机为 100%）。由 status 路由的 ProcessCpuMeter 补上，采集函数本身不填。 */
  cpuPercent?: number | null;
}

export async function collectProcessResources(pid: number, running: boolean): Promise<ProcessResources> {
  const result: ProcessResources = { pid, running, memoryMb: null, cpuSeconds: null };
  if (!running || !Number.isSafeInteger(pid) || pid <= 0) return result;
  if (pid === process.pid) {
    const cpu = process.cpuUsage();
    return {
      ...result,
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      cpuSeconds: (cpu.user + cpu.system) / 1_000_000,
    };
  }
  try {
    if (process.platform === "win32") {
      const script = `$p=Get-Process -Id ${pid} -ErrorAction Stop; @{memoryMb=[Math]::Round($p.WorkingSet64/1MB);cpuSeconds=$p.CPU}|ConvertTo-Json -Compress`;
      const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        timeout: 2000,
      });
      const data = JSON.parse(stdout) as { memoryMb: number; cpuSeconds: number | null };
      if (Number.isFinite(data.memoryMb) && data.memoryMb >= 0) result.memoryMb = data.memoryMb;
      if (typeof data.cpuSeconds === "number" && Number.isFinite(data.cpuSeconds) && data.cpuSeconds >= 0)
        result.cpuSeconds = data.cpuSeconds;
    } else if (process.platform === "linux") {
      const { stdout } = await execute("ps", ["-p", String(pid), "-o", "rss=", "-o", "time="], { timeout: 2000 });
      const match = stdout.trim().match(/^(\d+)\s+(?:(\d+)-)?(\d+):(\d+):(\d+)$/);
      if (match) {
        result.memoryMb = Math.round(Number(match[1]) / 1024);
        result.cpuSeconds =
          Number(match[2] ?? 0) * 86400 + Number(match[3]) * 3600 + Number(match[4]) * 60 + Number(match[5]);
      }
    }
  } catch {
    /* 无权限、进程退出、采集超时均不伪报 0。 */
  }
  return result;
}

/** 一次系统查询得到的单个进程用量。查不到的 PID 不会出现。 */
export interface ProcessUsage {
  memoryMb: number;
  cpuSeconds: number | null;
}

/**
 * 一次查询多个 PID 的工作集和累计 CPU。
 * 使用场景：内存面板除 BDS、数据服务外还要看守护进程、QQ 桥等，避免每个进程各起一次系统命令。
 * 当前进程仍用 process.memoryUsage，与 collectProcessResources 对自身的算法一致。
 * 命令失败时返回空表，调用方按「这次没采到」处理，不把缺失写成 0。
 */
export async function collectProcessResourcesMany(pids: number[]): Promise<Map<number, ProcessUsage>> {
  const unique = [...new Set(pids.filter((pid) => Number.isSafeInteger(pid) && pid > 0))];
  const found = new Map<number, ProcessUsage>();
  if (unique.includes(process.pid)) {
    const cpu = process.cpuUsage();
    found.set(process.pid, {
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      cpuSeconds: (cpu.user + cpu.system) / 1_000_000,
    });
  }
  const external = unique.filter((pid) => pid !== process.pid);
  if (!external.length) return found;
  try {
    if (process.platform === "win32") {
      const script = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        `$ids = @(${external.join(",")})`,
        "$rows = foreach ($id in $ids) {",
        "  $p = Get-Process -Id $id -ErrorAction SilentlyContinue",
        "  if ($null -eq $p) { continue }",
        "  $cpu = $p.CPU",
        "  [pscustomobject]@{ pid = [int]$p.Id; memoryMb = [int][Math]::Round($p.WorkingSet64/1MB); cpuSeconds = $(if ($null -eq $cpu) { $null } else { [double]$cpu }) }",
        "}",
        "if ($null -eq $rows) { '[]' } else { ConvertTo-Json -InputObject @($rows) -Compress }",
      ].join("\n");
      const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        timeout: 2000,
      });
      for (const row of parseUsageRows(JSON.parse(stdout))) found.set(row.pid, row.usage);
    } else if (process.platform === "linux") {
      const { stdout } = await execute("ps", ["-p", external.join(","), "-o", "pid=", "-o", "rss=", "-o", "time="], {
        timeout: 2000,
      });
      for (const line of stdout.split(/\n/)) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)$/);
        if (!match) continue;
        const pid = Number(match[1]);
        const rssKb = Number(match[2]);
        if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isFinite(rssKb)) continue;
        found.set(pid, { memoryMb: Math.round(rssKb / 1024), cpuSeconds: parseCpuClock(match[3] ?? "") });
      }
    }
  } catch {
    /* 采集超时或进程已退出时，已成功的自身读数仍保留，其余按没采到处理。 */
  }
  return found;
}

/** 把系统命令返回的行收成用量。非法行跳过。 */
function parseUsageRows(parsed: unknown): Array<{ pid: number; usage: ProcessUsage }> {
  // Windows PowerShell 5 会把只有一行的结果收成对象，7 则保持数组。
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
  const rows: Array<{ pid: number; usage: ProcessUsage }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as { pid?: unknown; memoryMb?: unknown; cpuSeconds?: unknown };
    if (typeof row.pid !== "number" || !Number.isSafeInteger(row.pid) || row.pid <= 0) continue;
    if (typeof row.memoryMb !== "number" || !Number.isFinite(row.memoryMb) || row.memoryMb < 0) continue;
    const cpuSeconds =
      typeof row.cpuSeconds === "number" && Number.isFinite(row.cpuSeconds) && row.cpuSeconds >= 0 ? row.cpuSeconds : null;
    rows.push({ pid: row.pid, usage: { memoryMb: row.memoryMb, cpuSeconds } });
  }
  return rows;
}

/** ps 的时间列：dd-hh:mm:ss、hh:mm:ss 或 mm:ss。解析不了时返回 null。 */
function parseCpuClock(text: string): number | null {
  const match = text.trim().match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3]);
  const seconds = Number(match[4]);
  if (![days, hours, minutes, seconds].every((value) => Number.isFinite(value))) return null;
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}
