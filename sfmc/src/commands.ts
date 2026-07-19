import { pushLog as pushUnifiedLog } from "./logs.js";
import { spawnService } from "./runtime.js";
import { ROOT, SERVICE_NAMES, services, type ServiceName } from "./services.js";
import { c, DIVIDER, highlightLogLine } from "./theme.js";

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
  let n = 20;
  let follow = false;
  const positional: string[] = [];

  for (const a of args) {
    if (a === "-n") continue; /* handled below */
    if (a === "-f") {
      follow = true;
      continue;
    }
    positional.push(a);
  }

  /* -n takes the next argument as value */
  const nIdx = args.indexOf("-n");
  if (nIdx >= 0 && nIdx + 1 < args.length) n = parseInt(args[nIdx + 1] ?? "0", 10);

  const svcRaw = positional[0];
  if (!svcRaw) return c.yellow("Usage: logs <service> [-n N] [-f]");

  const svc = parseService(svcRaw);
  if (!svc) return c.red(`Unknown service: ${svcRaw} (try: ${SERVICE_NAMES.join(", ")})`);

  const svcObj = services[svc];

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

export async function cmdUpdate(args: string[] = []): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawnService("update", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    proc.stdout?.on("data", (d: Buffer) => {
      const s = d.toString();
      out += s;
      for (const line of s.split("\n").filter(Boolean)) pushUnifiedLog(line, "system", "info");
    });
    proc.stderr?.on("data", (d: Buffer) => {
      const s = d.toString();
      out += s;
      for (const line of s.split("\n").filter(Boolean)) pushUnifiedLog(line, "system", "error");
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        pushUnifiedLog("update complete", "system", "success");
        resolve((out ? out + "\n" : "") + "update complete");
      } else {
        resolve(out || `update exited with code ${code}`);
      }
    });
    proc.on("error", (e) => {
      pushUnifiedLog(`update error: ${e.message}`, "system", "error");
      resolve(`update error: ${e.message}`);
    });
  });
}

