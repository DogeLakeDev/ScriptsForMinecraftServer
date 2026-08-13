#!/usr/bin/env node
import process from "node:process";
import { mapPacksSubAlias, parseGlobalArgv } from "./argv-parse.js";
import { cmdRemote } from "./cmd-remote.js";
import { cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { gateModuleSub, gatePacksSub, gateTopLevel } from "./cli-gate.js";
import { resolveModuleTopShorthand } from "./command-surface.js";
import { cmdDebug } from "./debug-command.js";
import { initLocale, stripLangArgs, t } from "./i18n/index.js";
import { cmdLocale } from "./locale-command.js";
import { dispatchModuleCommand, isModuleCommand, scanAndWarnUnknown } from "./module-commands.js";
import { startRemoteAgent } from "./remote-agent.js";
import { getHelp, playWelcomeAnimation, startRepl } from "./repl.js";
import { ROOT } from "./runtime.js";
import { setArgvDaemonize } from "./services.js";
import { c } from "./theme.js";
import { dispatchPacksCommand, isPacksCommand } from "./world-packs.js";

const MODE = "argv" as const;

async function printVersion(): Promise<void> {
  await playWelcomeAnimation();
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

  if (args.length > 0 || packsMode) {
    setArgvDaemonize(true);
  }

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

  const moduleSub = resolveModuleTopShorthand(cmd);
  if (moduleSub) {
    const g = gateModuleSub(moduleSub, MODE);
    if (g) deny(g);
    console.log(await dispatchModuleCommand(moduleSub, rest));
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
      await printVersion();
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
    case "log":
      /* channel=repl：正常由 gateTopLevel 拦截；此处兜底 */
      deny(gateTopLevel("logs", MODE) ?? c.yellow(t("cli.replOnly", { cmd: "logs" })));
      break;
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
    case "remote":
      console.log(await cmdRemote(rest, { daemonAfterEnroll: true }));
      break;
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
