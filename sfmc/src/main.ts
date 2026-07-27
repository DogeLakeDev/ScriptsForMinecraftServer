#!/usr/bin/env node
import process from "node:process";
import pkg from "../package.json" with { type: "json" };
import {
  isModuleInstallShorthand,
  mapPacksSubAlias,
  parseGlobalArgv,
} from "./argv-parse.js";
import { cmdLogs, cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { gateLogsFollow, gateModuleSub, gatePacksSub, gateTopLevel } from "./cli-gate.js";
import { cmdDebug } from "./debug-command.js";
import { initLocale, stripLangArgs, t } from "./i18n/index.js";
import { cmdLocale } from "./locale-command.js";
import { dispatchModuleCommand, isModuleCommand, scanAndWarnUnknown } from "./module-commands.js";
import {
  disableRemoteAgent,
  enrollRemoteAgent,
  remoteStatus,
  startRemoteAgent,
  stopRemoteAgent,
} from "./remote-agent.js";
import { getHelp, startRepl } from "./repl.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";
import { dispatchPacksCommand, isPacksCommand } from "./world-packs.js";

const MODE = "argv" as const;

function printVersion(): void {
  console.log(`${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}`);
}

function printUsage(): void {
  console.log(`${getHelp("argv")}`);
}

function deny(msg: string): never {
  console.log(msg);
  process.exit(1);
}

async function main(): Promise<void> {
  const stripped = stripLangArgs(process.argv.slice(2));
  initLocale({ root: ROOT, flag: stripped.lang });
  const { packsMode, args } = parseGlobalArgv(stripped.args);

  if (args.length === 0 && !packsMode) {
    const { isRuntimeInitialized } = await import("./runtime.js");
    if (!isRuntimeInitialized()) {
      const { runWizard } = await import("./wizard.js");
      await runWizard();
      const { refreshServices } = await import("./services.js");
      refreshServices();
    }
    const warn = await scanAndWarnUnknown();
    if (warn) console.log(warn);
    startRemoteAgent();
    await startRepl();
    return;
  }

  if (packsMode) {
    const [subRaw, ...subRest] = args;
    const sub = mapPacksSubAlias(subRaw);
    const g = gatePacksSub(sub, MODE);
    if (g) deny(g);
    console.log(await dispatchPacksCommand(sub, subRest));
    process.exit(0);
  }

  const [cmd, ...rest] = args;

  if (cmd && !["--help", "-h", "--version", "-v"].includes(cmd)) {
    const topGate = gateTopLevel(cmd, MODE);
    if (topGate) deny(topGate);
  }

  if (isModuleInstallShorthand(cmd)) {
    const g = gateModuleSub("install", MODE);
    if (g) deny(g);
    console.log(await dispatchModuleCommand("install", rest));
    process.exit(0);
  }

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
    case "debug":
      console.log(await cmdDebug(rest));
      break;
    case "status":
      console.log(await cmdStatus());
      break;
    case "logs":
    case "log": {
      const followGate = gateLogsFollow(rest, MODE);
      if (followGate) deny(followGate);
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
      const g = gatePacksSub(sub, MODE);
      if (g) deny(g);
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
      if (isModuleCommand(cmd)) {
        const [sub, ...subRest] = rest;
        const g = gateModuleSub(sub, MODE);
        if (g) deny(g);
        console.log(await dispatchModuleCommand(sub, subRest));
        break;
      }
      if (isPacksCommand(cmd)) {
        const [sub, ...subRest] = rest;
        const g = gatePacksSub(sub, MODE);
        if (g) deny(g);
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
