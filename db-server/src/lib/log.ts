/**
 * log.ts — db-server 统一日志实例
 *
 * stdout bare + 落盘 `<SFMC_ROOT>/.sfmc/logs/db.log`。
 * bare: 只输出纯 text,由 sfmc 捕获后统一加前缀;error 走 stderr。
 */

import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { logFile, resolveRuntimeRoot } from "@sfmc-bds/sdk/node/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** src/lib → 仓根(与 env.ts 的 src 上溯差一层) */
const ROOT = resolveRuntimeRoot(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));

export const log = createNodeServiceLogger({
  source: "db",
  logPath: logFile(ROOT, "db"),
});

process.on("exit", () => log.close());
