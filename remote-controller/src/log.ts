/**
 * log.ts — remote-controller 统一日志实例
 *
 * stdout bare + 落盘 `<SFMC_ROOT>/.sfmc/logs/remote-controller.log`。
 */
import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { logFile, resolveRuntimeRoot } from "@sfmc-bds/sdk/node/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolveRuntimeRoot(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));

export const log = createNodeServiceLogger({
  source: "remote-controller",
  logPath: logFile(ROOT, "remote-controller"),
});

process.on("exit", () => log.close());
