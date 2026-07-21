/**
 * log.ts — bds-tools 统一日志实例
 *
 * 通过 @sfmc/logs 共享包接入,source = "bds-tools"。
 * 同时输出 stdout + 落盘到 LOG_PATH (update.log)。
 *
 * check-update.ts 是独立入口,用 source = "updater" 单独创建 logger,
 * 见该文件内的 createUpdaterLogger()。
 */

import { createLogger, createStdoutSink, createFileSink } from "@sfmc/sdk/logs";
import { LOG_PATH } from "./paths.js";

const fileSink = createFileSink(LOG_PATH);
process.on("exit", () => fileSink.close());

export const log = createLogger({
  source: "bds-tools",
  sinks: [createStdoutSink(), fileSink],
});

/** 关闭文件流 (进程退出前调用,确保缓冲落盘) */
export function closeLog(): void {
  fileSink.close();
}
