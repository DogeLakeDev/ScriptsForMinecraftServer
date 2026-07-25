/**
 * log.ts — remote-controller 统一日志实例
 *
 * stdout bare + 落盘 `<SFMC_ROOT>/.sfmc/logs/remote-controller.log`。
 */
import { createNodeServiceLogger } from "@sfmc-bds/sdk/logs";
import { logFile } from "@sfmc-bds/sdk/node/config";
import { PROJECT_ROOT } from "./project-root.js";

export const log = createNodeServiceLogger({
  source: "remote-controller",
  logPath: logFile(PROJECT_ROOT, "remote-controller"),
});

process.on("exit", () => log.close());
