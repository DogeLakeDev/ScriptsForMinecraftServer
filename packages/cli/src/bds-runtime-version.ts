import { stateDir, writeJson } from "@sfmc-bds/sdk/node/config";
import path from "node:path";

/** 仅接受 BDS 启动阶段版本行，避免普通游戏日志被误当作版本。 */
export function recordBdsVersion(root: string, line: string, pid: number, startedAt: number): void {
  if (!pid || Date.now() - startedAt > 60_000) return;
  const match = /^(?:\[(?!Scripting\b)[^\]\r\n]*\]\s*)?Version:\s*(\d+\.\d+\.\d+(?:\.\d+)?)(?:\s|$)/.exec(line.trim());
  if (!match) return;
  try {
    writeJson(path.join(stateDir(root), "bds-runtime-version.json"), { pid, startedAt, version: match[1] });
  } catch {
    /* 版本采集失败不影响服务进程。 */
  }
}
