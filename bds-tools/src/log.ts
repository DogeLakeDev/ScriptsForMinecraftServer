/**
 * log.ts — bds-tools 统一日志实例
 *
 * stdout bare + 落盘 LOG_PATH (<ROOT>/.sfmc/logs/bds-update.log)。
 * check-update.ts 是独立入口,用 source = "updater" 单独创建 logger。
 */

import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { LOG_PATH } from "./paths.js";

export const log = createNodeServiceLogger({
  source: "bds-tools",
  logPath: LOG_PATH,
});

/** 兼容钩子：FileSink 为 sync append，close 为空操作 */
export function closeLog(): void {
  log.close();
}
