/** 受控进程资源采集：仅允许已核验的数字 PID，失败保留未知。 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export interface ProcessResources {
  pid: number;
  running: boolean;
  memoryMb: number | null;
  cpuSeconds: number | null;
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
