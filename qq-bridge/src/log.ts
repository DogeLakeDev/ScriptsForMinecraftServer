/**
 * log.ts — qq-bridge 统一日志实例
 *
 * stdout bare + 落盘 `<SFMC_ROOT>/.sfmc/logs/qq.log`。
 * bare: 只输出纯 text,由 sfmc 捕获后统一加前缀;error 走 stderr。
 */

import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { logFile } from "@sfmc-bds/sdk/node/config";
import { PROJECT_ROOT } from "./project-root.js";

export const log = createNodeServiceLogger({
  source: "qq",
  logPath: logFile(PROJECT_ROOT, "qq"),
});
