#!/usr/bin/env node
import process from "node:process";
import pkg from "../package.json" with { type: "json" };
import { cmdLogs, cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { getHelp, startRepl } from "./repl.js";
import { dispatchModuleCommand, isModuleCommand, scanAndWarnUnknown } from "./module-commands.js";
import { dispatchPacksCommand, isPacksCommand } from "./world-packs.js";
import { disableRemoteAgent, enrollRemoteAgent, remoteStatus, startRemoteAgent, stopRemoteAgent } from "./remote-agent.js";
import { cmdLocale } from "./locale-command.js";
import { initLocale, stripLangArgs, t } from "./i18n/index.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";

function printVersion(): void {
  /* 此前模板字符串未写入 stdout,导致 `sfmc --version` 无输出。 */
  console.log(`${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}`);
}

function printUsage(): void {
  console.log(`${getHelp()}`);
}

async function main(): Promise<void> {
  const stripped = stripLangArgs(process.argv.slice(2));
  initLocale({ root: ROOT, flag: stripped.lang });
  const args = stripped.args;

  if (args.length === 0) {
    /* 首次运行:以 runtime.json#initialized_at 为准(非 db_config 是否存在)。
     * 配置骨架由 services.ensureJsonConfig 在启动时创建,不能再当「未初始化」信号。 */
    const { isRuntimeInitialized } = await import("./runtime.js");
    if (!isRuntimeInitialized()) {
      const { runWizard } = await import("./wizard.js");
      await runWizard();
      const { refreshServices } = await import("./services.js");
      refreshServices();
    }
    /* Print yellow warnings for modules from outside the first-party registry.
     * Best-effort: registry unreachable → no warning, no failure. */
    const warn = await scanAndWarnUnknown();
    if (warn) console.log(warn);
    startRemoteAgent();
    await startRepl();
    return;
  }

  const [cmd, ...rest] = args;

  switch (cmd) {
    case "--help":
    case "-h":
    case "help":
      printUsage();
      break;
    case "--version":
    case "-v":
      printVersion();
      break;
    case "locale":
    case "lang":
      console.log(cmdLocale(rest));
      break;
    case "status":
      console.log(cmdStatus());
      break;
    case "logs":
    case "log": {
      const out = cmdLogs(rest);
      if (out) console.log(out);
      break;
    }
    case "start":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdStart(rest[0]));
      } else {
        console.log(c.yellow(t("svc.start.usage")));
      }
      break;
    case "stop":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStopAll());
      } else if (rest[0]) {
        console.log(await cmdStop(rest[0]));
      } else {
        console.log(c.yellow(t("svc.stop.usage")));
      }
      break;
    case "restart":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        await cmdStopAll();
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdRestart(rest[0]));
      } else {
        console.log(c.yellow(t("svc.restart.usage")));
      }
      break;
    case "update":
      console.log(await cmdUpdate(rest));
      break;
    case "packs":
    case "addon": {
      const [sub, ...subRest] = rest;
      console.log(await dispatchPacksCommand(sub, subRest));
      break;
    }
    case "init": {
      const { runWizard } = await import("./wizard.js");
      await runWizard();
      break;
    }
    case "remote": {
      const [subcommand, ...remoteArgs] = rest;
      if (subcommand === "enroll" && remoteArgs[0] && remoteArgs[1]) {
        const name = remoteArgs[2] ?? process.env.COMPUTERNAME ?? "sfmc-agent";
        const agentId = await enrollRemoteAgent(remoteArgs[0], remoteArgs[1], name);
        console.log(t("remote.enrolled", { id: agentId }));
        startRemoteAgent();
        const exit = (): void => {
          stopRemoteAgent();
          process.exit(0);
        };
        process.once("SIGINT", exit);
        process.once("SIGTERM", exit);
        /* keep alive so the WS loop can run; ctrl-c exits. */
        await new Promise(() => undefined);
      } else if (subcommand === "status") {
        console.log(JSON.stringify(remoteStatus(), null, 2));
      } else if (subcommand === "disable") {
        disableRemoteAgent();
        console.log(t("remote.disabled"));
      } else {
        console.log(t("remote.usage"));
      }
      break;
    }
    default:
      /* module/mod 别名只维护 MODULE_CMD_NAMES,避免 main/repl case 链漂移(OCP)。 */
      if (isModuleCommand(cmd)) {
        const [sub, ...subRest] = rest;
        console.log(await dispatchModuleCommand(sub, subRest));
        break;
      }
      if (isPacksCommand(cmd)) {
        const [sub, ...subRest] = rest;
        console.log(await dispatchPacksCommand(sub, subRest));
        break;
      }
      console.log(c.red(t("common.unknownCommand", { cmd: cmd ?? "" })));
      printUsage();
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(c.red(err?.message ? t("common.error", { message: err.message }) : t("common.fatal")));
  process.exit(1);
});
