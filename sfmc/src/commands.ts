import { services, type ServiceName } from "./services.js";
import { c, DIVIDER, highlightLogLine } from "./theme.js";

const SERVICE_NAMES: ServiceName[] = ["bds", "db", "qq", "llbot"];

const HELP = `
${c.bold("Commands")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <service>      View service logs
    ${c.dim("  -n <num>  lines (default 20)")}
    ${c.dim("  -f        follow mode (Ctrl+C to stop)")}
  ${c.green("follow")} <service>    Enter service console (logs + send commands)
  ${c.green("start")} <service>     Start a service
  ${c.green("stop")} <service>      Stop a service
  ${c.green("restart")} <service>   Restart a service
  ${c.green("start-all")}           Start all services (db→qq→llbot→bds)
  ${c.green("stop-all")}            Stop all services
  ${c.green("init")}                Run setup wizard
  ${c.green("update")}              Check/apply BDS update
  ${c.green("version")}             Show version
  ${c.green("help")}                Show this help
  ${c.green("quit")} / ${c.green("exit")}  Exit

${c.dim("Tip: Tab completes commands & service names")}
`;

function parseService(raw: string): ServiceName | null {
  const s = raw.toLowerCase() as ServiceName;
  if (SERVICE_NAMES.includes(s)) return s;
  return null;
}

function statusLine(name: string, running: boolean, pid: number, uptime: string): string {
  const dot = running ? c.green("●") : c.dim("○");
  const status = running ? c.green("Running") : c.dim("Stopped");
  const pidStr = pid ? c.dim(String(pid)) : c.dim("—");
  const upStr = uptime !== "—" ? c.dim(uptime) : c.dim("—");
  return `  ${dot} ${c.bold(name.padEnd(9))} ${status.padEnd(10)} ${pidStr.padEnd(8)} ${upStr}`;
}

export function cmdHelp(): string {
  return HELP;
}

export function cmdStatus(): string {
  const lines = SERVICE_NAMES.map((name) => {
    const s = services[name];
    return statusLine(s.title, s.running, s.pid, s.uptime);
  });
  return (
    `\n${c.bold("Services")}\n` +
    c.dim(`  Name${" ".repeat(7)}Status${" ".repeat(4)}PID${" ".repeat(4)}Uptime\n`) +
    DIVIDER +
    "\n" +
    lines.join("\n") +
    "\n"
  );
}

export function cmdLogs(args: string[], onFollow?: (serviceName: ServiceName) => void): string {
  const argsCopy = [...args];
  const svcRaw = argsCopy.shift();
  if (!svcRaw) return c.yellow("Usage: logs <service> [-n N] [-f]");

  const svc = parseService(svcRaw);
  if (!svc) return c.red(`Unknown service: ${svcRaw} (try: ${SERVICE_NAMES.join(", ")})`);

  const svcObj = services[svc];
  let n = 20;
  let follow = false;

  while (argsCopy.length > 0) {
    const opt = argsCopy.shift();
    if (opt === "-n") {
      n = parseInt(argsCopy.shift() ?? "20", 10);
    } else if (opt === "-f") {
      follow = true;
    }
  }

  const lines = svcObj.getRecentLogs(n);
  if (lines.length === 0) return c.dim("(no logs yet)");

  const header = `\n${c.bold(svcObj.title)} logs (last ${lines.length}):`;
  const body = lines
    .map((l) => {
      const ts = c.dim(l.time.toLocaleTimeString());
      const text = highlightLogLine(l.text);
      const prefix = l.stream === "stderr" ? c.red("!") : c.dim(" ");
      return `${ts} ${prefix} ${text}`;
    })
    .join("\n");

  const result = header + "\n" + DIVIDER + "\n" + body + "\n";

  if (follow && onFollow) {
    onFollow(svc);
    return "";
  }

  return result;
}

const STARTING = new Set<ServiceName>();
const STOPPING = new Set<ServiceName>();

export async function cmdStart(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  if (svcObj.running) return c.yellow(`${svcObj.title} already running (PID ${svcObj.pid})`);
  if (STARTING.has(svc)) return c.dim(`${svcObj.title} already starting...`);
  STARTING.add(svc);
  try {
    await svcObj.start();
    return c.green(`${svcObj.title} started`);
  } catch (e) {
    return c.red(`${svcObj.title} failed: ${(e as Error).message}`);
  } finally {
    STARTING.delete(svc);
  }
}

export async function cmdStop(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  if (!svcObj.running) return c.yellow(`${svcObj.title} already stopped`);
  if (STOPPING.has(svc)) return c.dim(`${svcObj.title} already stopping...`);
  STOPPING.add(svc);
  try {
    await svcObj.stop();
    return c.dim(`${svcObj.title} stopped`);
  } catch (e) {
    return c.red(`${svcObj.title} stop failed: ${(e as Error).message}`);
  } finally {
    STOPPING.delete(svc);
  }
}

export async function cmdRestart(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  try {
    await svcObj.restart();
    return c.green(`${svcObj.title} restarted`);
  } catch (e) {
    return c.red(`${svcObj.title} restart failed: ${(e as Error).message}`);
  }
}

export async function cmdStartAll(): Promise<string> {
  const { startAll } = await import("./services.js");
  await startAll();
  return c.green("All services started");
}

export async function cmdStopAll(): Promise<string> {
  const { stopAll } = await import("./services.js");
  await stopAll();
  return c.dim("All services stopped");
}

export async function cmdUpdate(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const { ROOT } = await import("./services.js");
  try {
    const result = execSync(`node bds-tools/dist/check-update.js`, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120000,
    });
    return c.green(result.toString());
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return c.red(err.stderr?.toString() || err.stdout?.toString() || err.message || "update failed");
  }
}

