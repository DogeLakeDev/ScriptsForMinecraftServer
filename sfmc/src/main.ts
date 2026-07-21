import fs from "node:fs";
import process from "node:process";
import { configPath } from "@sfmc/sdk/node/config";
import pkg from "../package.json" with { type: "json" };
import { cmdLogs, cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { HELP, startRepl } from "./repl.js";
import { cmdModuleDisable, cmdModuleEnable, cmdModuleInfo, cmdModuleInstall, cmdModuleList, cmdModuleUninstall, cmdModuleVerify, scanAndWarnUnknown } from "./module-commands.js";
import { cmdBehaviorPackBuild, cmdBehaviorPackDeploy } from "./commands-behavior-pack.js";
import { disableRemoteAgent, enrollRemoteAgent, remoteStatus, startRemoteAgent, stopRemoteAgent } from "./remote-agent.js";
import { c } from "./theme.js";

function printVersion(): void {
  `${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}\n`;
}

function printUsage(): void {
  console.log(`${HELP}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    const { ROOT } = await import("./runtime.js");
    const configFile = configPath(ROOT, "db_config.json");
    if (!fs.existsSync(configFile)) {
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
        console.log(c.yellow("Usage: sfmc start <service>|-all"));
      }
      break;
    case "stop":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStopAll());
      } else if (rest[0]) {
        console.log(await cmdStop(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc stop <service>|-all"));
      }
      break;
    case "restart":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        await cmdStopAll();
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdRestart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc restart <service>|-all"));
      }
      break;
    case "update":
      console.log(await cmdUpdate(rest));
      break;
    case "behavior-pack":
    case "bp": {
      const [sub, ...subRest] = rest;
      switch (sub) {
        case "build":
          console.log(await cmdBehaviorPackBuild(subRest));
          break;
        case "deploy":
          console.log(await cmdBehaviorPackDeploy(subRest));
          break;
        default:
          console.log(c.yellow("Usage: sfmc behavior-pack <build|deploy>"));
      }
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
        console.log(`Enrolled remote agent: ${agentId}`);
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
        console.log("Remote agent disabled");
      } else {
        console.log("Usage: sfmc remote enroll <controller-url> <enrollment-token> [name] | sfmc remote status | sfmc remote disable");
      }
      break;
    }
    case "module":
    case "mod": {
      const [sub, ...subRest] = rest;
      switch (sub) {
        case "list":
          console.log(await cmdModuleList(subRest));
          break;
        case "install":
          console.log(await cmdModuleInstall(subRest));
          break;
        case "uninstall":
        case "remove":
          console.log(await cmdModuleUninstall(subRest));
          break;
        case "verify":
          console.log(await cmdModuleVerify(subRest));
          break;
        case "info":
          console.log(await cmdModuleInfo(subRest));
          break;
        case "enable":
          console.log(await cmdModuleEnable(subRest));
          break;
        case "disable":
          console.log(await cmdModuleDisable(subRest));
          break;
        default:
          console.log(c.yellow("Usage: sfmc module <list|install|uninstall|verify|info|enable|disable> [args]"));
      }
      break;
    }
    default:
      console.log(c.red(`Unknown command: ${cmd}`));
      printUsage();
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(c.red(err?.message ? `Error: ${err.message}` : "Fatal"));
  process.exit(1);
});
