/**
 * log.ts — qq-bridge 统一日志实例
 *
 * stdout bare + 落盘 `<SFMC_ROOT>/.sfmc/logs/qq.log`。
 * bare: 只输出纯 text,由 sfmc 捕获后统一加前缀;error 走 stderr。
 */

import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { logFile, resolveRuntimeRoot } from "@sfmc-bds/sdk/node/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolveRuntimeRoot(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));

export const log = createNodeServiceLogger({
  source: "qq",
  logPath: logFile(ROOT, "qq"),
});

process.on("exit", () => log.close());
