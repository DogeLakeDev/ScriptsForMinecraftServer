import process from "node:process";
import { cmdLogs, cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { startRepl } from "./repl.js";
import { c } from "./theme.js";

function printVersion(): void {
  console.log(`sfmc v${process.env["npm_package_version"] || "0.1.0"}`);
}

function printUsage(): void {
  console.log(`${c.bold("sfmc")} — Server Manager for Minecraft BDS

${c.dim("Usage:")}
  ${c.green("sfmc")}                  Enter interactive REPL
  ${c.green("sfmc")} ${c.blue("<command>")}       Run command once and exit

${c.dim("Commands:")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <service>      View service logs
  ${c.green("follow")} <service>    Follow service logs (live tail)
  ${c.green("start")} <service>     Start a service
  ${c.green("stop")} <service>      Stop a service
  ${c.green("restart")} <service>   Restart a service
  ${c.green("update")}              Check/apply BDS update
  ${c.green("init")}                Run setup wizard
  ${c.green("help")}                Show this help
  ${c.green("--version")} / ${c.green("-v")}  Print version
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
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
    case "log":
      {
        const result = cmdLogs(rest);
        if (result) console.log(result);
      }
      break;
    case "follow":
      {
        const followArgs = rest.length > 0 ? [`${rest[0]}`, "-f"] : [];
        const result = cmdLogs(followArgs);
        if (result) console.log(result);
      }
      break;
    case "start":
      if (rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdStart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc start <service>"));
      }
      break;
    case "stop":
      if (rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStopAll());
      } else if (rest[0]) {
        console.log(await cmdStop(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc stop <service>"));
      }
      break;
    case "restart":
      if (rest[0]) {
        console.log(await cmdRestart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc restart <service>"));
      }
      break;
    case "update":
      console.log(await cmdUpdate());
      break;
    case "init":
      {
        const { runWizard } = await import("./wizard.js");
        await runWizard();
      }
      break;
    default:
      console.log(c.red(`Unknown command: ${cmd}`));
      printUsage();
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err: Error) => {
  console.error(c.red(`Fatal: ${err.message}`));
  process.exit(1);
});

