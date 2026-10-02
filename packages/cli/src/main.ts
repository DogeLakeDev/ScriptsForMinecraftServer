#!/usr/bin/env node
/** 作者命令先分流，避免仅提交索引时初始化服务与运行目录配置。 */
import { stripLangArgs } from "./i18n/index.js";

const args = stripLangArgs(process.argv.slice(2)).args;
if (args[0] === "manage" && args[1] === "--stdio") {
  const { runManagementStdio } = await import("./management/stdio.js");
  await runManagementStdio();
} else if ((args[0] === "mod" || args[0] === "module") && args[1] === "submit") {
  try {
    const { runRegistrySubmitCommand } = await import("@sfmc-bds/devkit");
    console.log(await runRegistrySubmitCommand(args.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
  await import("./runtime-main.js");
}
