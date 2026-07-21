import fs from "node:fs";
import process from "node:process";
import { configPath } from "@sfmc/sdk/node/config";
import pkg from "../package.json" with { type: "json" };
import { cmdLogs, cmdRestart, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { HELP, startRepl } from "./repl.js";
import { disableRemoteAgent, enrollRemoteAgent, remoteStatus, startRemoteAgent, stopRemoteAgent } from "./remote-agent.js";
import { c } from "./theme.js";
function printVersion() {
    `${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}\n`;
}
function printUsage() {
    console.log(`${HELP}`);
}
async function main() {
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
            if (out)
                console.log(out);
            break;
        }
        case "start":
            if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
                console.log(await cmdStartAll());
            }
            else if (rest[0]) {
                console.log(await cmdStart(rest[0]));
            }
            else {
                console.log(c.yellow("Usage: sfmc start <service>|-all"));
            }
            break;
        case "stop":
            if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
                console.log(await cmdStopAll());
            }
            else if (rest[0]) {
                console.log(await cmdStop(rest[0]));
            }
            else {
                console.log(c.yellow("Usage: sfmc stop <service>|-all"));
            }
            break;
        case "restart":
            if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
                await cmdStopAll();
                console.log(await cmdStartAll());
            }
            else if (rest[0]) {
                console.log(await cmdRestart(rest[0]));
            }
            else {
                console.log(c.yellow("Usage: sfmc restart <service>|-all"));
            }
            break;
        case "update":
            console.log(await cmdUpdate(rest));
            break;
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
                const exit = () => {
                    stopRemoteAgent();
                    process.exit(0);
                };
                process.once("SIGINT", exit);
                process.once("SIGTERM", exit);
                /* keep alive so the WS loop can run; ctrl-c exits. */
                await new Promise(() => undefined);
            }
            else if (subcommand === "status") {
                console.log(JSON.stringify(remoteStatus(), null, 2));
            }
            else if (subcommand === "disable") {
                disableRemoteAgent();
                console.log("Remote agent disabled");
            }
            else {
                console.log("Usage: sfmc remote enroll <controller-url> <enrollment-token> [name] | sfmc remote status | sfmc remote disable");
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
//# sourceMappingURL=main.js.map