/**
 * runtime-status.ts — 写/清 `.sfmc/qq.runtime.json`，供 CLI 探测外部 qq
 */

import {
  qqRuntimeStatusPath,
  type QqRuntimeStatus,
} from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./project-root.js";

export function writeQqRuntimeStatus(backend: "official" | "llbot"): void {
  const status: QqRuntimeStatus = {
    pid: process.pid,
    backend,
    startedAt: Date.now(),
  };
  const file = qqRuntimeStatusPath(PROJECT_ROOT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

export function clearQqRuntimeStatus(): void {
  const file = qqRuntimeStatusPath(PROJECT_ROOT);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

/** 注册进程退出时清理心跳文件 */
export function installQqRuntimeStatusHooks(backend: "official" | "llbot"): void {
  writeQqRuntimeStatus(backend);
  const clear = (): void => {
    clearQqRuntimeStatus();
  };
  process.once("exit", clear);
  process.once("SIGINT", () => {
    clear();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    clear();
    process.exit(0);
  });
}
