import { stdin, stdout } from "node:process";
import { c, DIVIDER, boxHeader, highlightLogLine, padRight } from "./theme.js";
import { cmdHelp, cmdStatus, cmdLogs, cmdStart, cmdStop, cmdRestart, cmdStartAll, cmdStopAll, cmdUpdate } from "./commands.js";
import { services, type ServiceName, type LogLine } from "./services.js";

const SERVICE_NAMES: ServiceName[] = ["bds", "db", "qq", "llbot"];

function setRaw(v: boolean): void {
  try { if (stdin.isTTY && typeof (stdin as Record<string, unknown>).setRawMode === "function") (stdin as Record<string, unknown>).setRawMode(v); } catch {}
}

const HELP = `
${c.bold("Commands")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <svc>          View service logs
  ${c.green("start")} <svc>         Start a service
  ${c.green("stop")} <svc>          Stop a service
  ${c.green("restart")} <svc>       Restart a service
  ${c.green("follow")} <svc>        Enter service console (logs + stdin)
  ${c.green("start-all")}           Start all services
  ${c.green("stop-all")}            Stop all services
  ${c.green("init")}                Run setup wizard
  ${c.green("update")}              Check/apply BDS update
  ${c.green("version")}             Show version
  ${c.green("help")}                Show this help
  ${c.green("quit")} / ${c.green("exit")}  Exit

${c.dim("Shortcuts:")}
  ${c.dim("Ctrl+P")}   Quick service console switcher
  ${c.dim("Alt+P")}    Command palette
  ${c.dim("Tab")}      Complete commands & arguments
  ${c.dim("↑↓")}       History navigation
`;

function getServiceDots(): string {
  return SERVICE_NAMES.map((n) => {
    const s = services[n];
    const dot = s.running ? c.green("●") : c.dim("○");
    return `${dot}${c.bold(s.title)}`;
  }).join(" ");
}

function printHeader(): void {
  console.log(boxHeader("sfmc", getServiceDots()));
}

/* ============================================================
 *  Escape sequence consumer (arrows, F-keys, Alt+letter, …)
 * ============================================================ */
/** returns new index `i` after consuming the escape sequence, or `null` if `chunk[i]` is not ESC */
function consumeEscapeSeq(chunk: Buffer, i: number): number | null {
  if (chunk[i] !== 0x1B) return null;
  const rem = chunk.length - i - 1;

  /* CSI: \x1B[ param… intermed… finalbyte */
  if (rem >= 2 && chunk[i + 1] === 0x5B) {
    let j = i + 2;
    while (j < chunk.length && chunk[j] >= 0x30 && chunk[j] <= 0x3F) j++;
    while (j < chunk.length && chunk[j] >= 0x20 && chunk[j] <= 0x2F) j++;
    if (j < chunk.length && chunk[j] >= 0x40 && chunk[j] <= 0x7E) j++;
    return j;
  }

  /* SS3: \x1BO letter (F1-F4) */
  if (rem >= 2 && chunk[i + 1] === 0x4F) return i + 3;

  /* Alt+letter or unknown 2-byte */
  if (rem >= 1) return i + 2;

  /* Standalone ESC at end of chunk */
  return i + 1;
}

/* ============================================================
 *  Popup — filtered select list (raw mode)
 * ============================================================ */
interface PopupItem {
  label: string;
  value: string;
}

async function popupSelect(items: PopupItem[], title: string, filterHint = ""): Promise<string | null> {
  const wasRaw = (stdin as Record<string, boolean>).isRaw ?? false;
  setRaw(true);
  stdin.resume();

  let filtered = items;
  let selected = 0;
  let filter = filterHint;
  let lastLines = 0;

  function popHeight(): number {
    return Math.min(filtered.length, 8);
  }

  function popTotalLines(): number {
    const h = popHeight();
    // top ─ search ─ divider ─ h items ─ "more" line ─ bottom
    let lines = 4 + h;
    if (filtered.length > h) lines += 1;
    return lines;
  }

  function render(first = false): void {
    const lines = popTotalLines();
    const h = popHeight();
    if (!first) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    } else {
      stdout.write("\x1B[J");
    }
    lastLines = lines;

    let out = `\r${c.dim("╭─ ")}${c.bold(title)}${c.dim(` ─${"─".repeat(40)}╮`)}\n`;
    out += `${c.dim("│")} ${c.dim("search:")} ${filter}${" ".repeat(Math.max(0, 22 - filter.length))}${c.dim("│")}\n`;
    out += c.dim(`├─${"─".repeat(42)}┤`) + "\n";

    for (let i = 0; i < h; i++) {
      const item = filtered[i];
      if (!item) break;
      const cursor = i === selected ? c.cyan("▶") : " ";
      const style = i === selected ? c.bold : (s: string) => s;
      out += `${c.dim("│")} ${cursor} ${style(padRight(item.label, 38))} ${c.dim("│")}\n`;
    }
    if (filtered.length > h) {
      out += `${c.dim("│")}  ${c.dim(`… ${filtered.length - h} more`)}${" ".repeat(28)}${c.dim("│")}\n`;
    }
    out += c.dim("╰" + "─".repeat(44) + "╯");
    stdout.write(out);
  }

  function clearPop(): void {
    if (lastLines > 0) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    }
  }

  render(true);

  const result: string | null = await new Promise((resolve) => {
    const handler = (chunk: Buffer) => {
      let i = 0;
      while (i < chunk.length) {
        /* ---------- escape sequences ---------- */
        if (chunk[i] === 0x1B) {
          const rem = chunk.length - i - 1;
          if (rem === 0) {
            // Standalone ESC — cancel
            clearPop();
            stdin.removeListener("data", handler);
            setRaw(wasRaw);
            resolve(null);
            return;
          }
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) i = next;
          else i++;
          continue; // never fall through to char handling
        }

        const byte = chunk[i];
        i++;

        if (byte === 0x0D || byte === 0x0A) {
          clearPop();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(filtered[selected]?.value ?? null);
          return;
        }

        if (byte === 0x03) {
          clearPop();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }

        if (byte === 0x7F || byte === 0x08) {
          if (filter.length > 0) {
            filter = filter.slice(0, -1);
            filtered = items.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase()));
            selected = 0;
            render();
          }
          continue;
        }

        if (byte >= 0x20 && byte <= 0x7E) {
          filter += String.fromCharCode(byte);
          filtered = items.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase()));
          selected = 0;
          render();
          continue;
        }

        /* all other control chars silently dropped */
      }
    };

    stdin.on("data", handler);
  });

  return result;
}

/* ============================================================
 *  Line reader (raw mode, no readline dependency)
 * ============================================================ */
const history: string[] = [];
let historyIdx = -1;

async function readLine(prompt: string): Promise<string | null> {
  const wasRaw = (stdin as Record<string, boolean>).isRaw ?? false;
  setRaw(true);
  stdin.resume();

  let line = "";
  stdout.write(prompt);

  return new Promise((resolve) => {
    const handler = (chunk: Buffer) => {
      let i = 0;
      while (i < chunk.length) {
        /* ---------- escape sequences ---------- */
        if (chunk[i] === 0x1B) {
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            // Check if consumed exactly 3 bytes for a CSI arrow
            const consumed = next - i;
            if (consumed === 3 && chunk[i + 1] === 0x5B) {
              const fin = chunk[i + 2];
              if (fin === 0x41) { // ↑
                if (historyIdx > 0) {
                  historyIdx--;
                  const prev = history[historyIdx] ?? "";
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt + prev);
                  line = prev;
                }
              } else if (fin === 0x42) { // ↓
                if (historyIdx < history.length - 1) {
                  historyIdx++;
                  const nextLn = history[historyIdx] ?? "";
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt + nextLn);
                  line = nextLn;
                } else if (historyIdx === history.length - 1) {
                  historyIdx = history.length;
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt);
                  line = "";
                }
              }
            }
            i = next;
          } else {
            i++;
          }
          continue; // never fall through to char handling
        }

        const byte = chunk[i];
        i++;

        if (byte === 0x0D || byte === 0x0A) {
          stdout.write("\r\n");
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          if (line.length > 0) {
            history.push(line);
            if (history.length > 100) history.shift();
          }
          historyIdx = history.length;
          resolve(line);
          return;
        }

        if (byte === 0x03) {
          stdout.write("\r\n");
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }

        if (byte === 0x09) {
          stdin.removeListener("data", handler);
          stdout.write("\r\n");
          setRaw(wasRaw);
          resolve("__TAB__" + line);
          return;
        }

        if (byte === 0x10) {
          stdin.removeListener("data", handler);
          stdout.write("\r\n");
          setRaw(wasRaw);
          resolve("__CTRLP__");
          return;
        }

        if (byte === 0x7F || byte === 0x08) {
          if (line.length > 0) {
            line = line.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }

        if (byte >= 0x20 && byte <= 0x7E) {
          line += String.fromCharCode(byte);
          stdout.write(String.fromCharCode(byte));
          continue;
        }

        /* all other control chars silently dropped */
      }
    };

    stdin.on("data", handler);
  });
}

const COMMAND_ITEMS: PopupItem[] = [
  { label: "status          Show service status", value: "status" },
  { label: "logs <svc>      View service logs", value: "logs " },
  { label: "follow <svc>    Service console (logs + stdin)", value: "follow " },
  { label: "start <svc>     Start a service", value: "start " },
  { label: "stop <svc>      Stop a service", value: "stop " },
  { label: "restart <svc>   Restart a service", value: "restart " },
  { label: "start-all       Start all services", value: "start-all" },
  { label: "stop-all        Stop all services", value: "stop-all" },
  { label: "init            Setup wizard", value: "init" },
  { label: "update          BDS update", value: "update" },
  { label: "help            Show help", value: "help" },
  { label: "quit            Exit", value: "quit" },
];

const SERVICE_ITEMS: PopupItem[] = SERVICE_NAMES.map((n) => {
  const s = services[n];
  const dot = s.running ? c.green("●") : c.dim("○");
  return { label: `${dot} ${padRight(s.title, 34)} ${c.dim(s.running ? `PID ${s.pid}` : "stopped")}`, value: n };
});

/* ============================================================
 *  REPL loop
 * ============================================================ */
export async function startRepl(): Promise<void> {
  printHeader();

  if (!stdin.isTTY) {
    console.log(c.dim(" Non-interactive mode (pipe detected)\n"));
    await startReplSimple();
    return;
  }

  console.log(c.dim(" Type help · Ctrl+P services · Alt+P commands · Tab/↑↓\n"));

  while (true) {
    const raw = await readLine(c.cyan(" > "));
    if (raw === null) break;

    if (raw.startsWith("__TAB__")) {
      const partial = raw.slice(7);
      const parts = partial.trim().split(/\s+/);
      const cmd = parts[0];
      const rest = parts.slice(1).join(" ");

      if (!cmd) {
        const sel = await popupSelect(COMMAND_ITEMS, "Commands");
        if (sel) await execCmd(sel.split(/\s+/));
        continue;
      }

      if ((cmd === "logs" || cmd === "follow" || cmd === "start" || cmd === "stop" || cmd === "restart") && !rest) {
        const items = SERVICE_ITEMS.map((i) => ({ label: i.label, value: `${cmd} ${i.value}` }));
        const sel = await popupSelect(items, `Pick service for: ${cmd}`);
        if (sel) await execCmd(sel.split(/\s+/));
        continue;
      }

      const sel = await popupSelect(COMMAND_ITEMS, "Commands");
      if (sel) await execCmd(sel.split(/\s+/));
      continue;
    }

    if (raw === "__CTRLP__") {
      const sel = await popupSelect(SERVICE_ITEMS, "Service Console");
      if (sel) await enterServiceConsole(sel as ServiceName);
      continue;
    }

    if (raw.startsWith("/")) {
      const sel = await popupSelect(COMMAND_ITEMS, "Commands", raw.slice(1));
      if (sel) await execCmd(sel.split(/\s+/));
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    await execCmd(parts);
  }

  console.log(c.dim("bye"));
}

async function startReplSimple(): Promise<void> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0] === "quit" || parts[0] === "exit" || parts[0] === "q") break;
    if (parts[0] === "init") {
      const { runWizard } = await import("./wizard.js");
      await runWizard();
      continue;
    }
    await execCmd(parts);
  }
}

async function execCmd(parts: string[]): Promise<void> {
  const [cmd, ...args] = parts;

  try {
    switch (cmd) {
      case "help":
      case "h":
      case "?":
        console.log(HELP);
        break;
      case "version":
        console.log(`sfmc v${process.env["npm_package_version"] || "0.1.0"}`);
        break;
      case "status":
        console.log(cmdStatus());
        break;
      case "logs":
      case "log": {
        const out = cmdLogs(args, (svc) => {
          if (!stdin.isTTY) {
            console.log(c.yellow("follow mode requires TTY (interactive terminal)"));
            return;
          }
          enterServiceConsole(svc);
        });
        if (out) console.log(out);
        break;
      }
      case "follow": {
        const svcName = args[0];
        if (!stdin.isTTY) {
          console.log(c.yellow("console mode requires TTY (interactive terminal)"));
          break;
        }
        if (svcName && (SERVICE_NAMES as readonly string[]).includes(svcName.toLowerCase())) {
          await enterServiceConsole(svcName.toLowerCase() as ServiceName);
        } else {
          const sel = await popupSelect(SERVICE_ITEMS, "Service Console");
          if (sel) await enterServiceConsole(sel as ServiceName);
        }
        break;
      }
      case "start":
        if (args[0] === "all" || args[0] === "--all") {
          console.log(await cmdStartAll());
        } else if (args[0]) {
          console.log(await cmdStart(args[0]));
        } else {
          console.log(c.yellow("Usage: start <service>"));
        }
        break;
      case "stop":
        if (args[0] === "all" || args[0] === "--all") {
          console.log(await cmdStopAll());
        } else if (args[0]) {
          console.log(await cmdStop(args[0]));
        } else {
          console.log(c.yellow("Usage: stop <service>"));
        }
        break;
      case "restart":
        if (args[0]) {
          console.log(await cmdRestart(args[0]));
        } else {
          console.log(c.yellow("Usage: restart <service>"));
        }
        break;
      case "start-all":
        console.log(await cmdStartAll());
        break;
      case "stop-all":
        console.log(await cmdStopAll());
        break;
      case "init": {
        const { runWizard } = await import("./wizard.js");
        await runWizard();
        break;
      }
      case "update":
        console.log(await cmdUpdate());
        break;
      case "quit":
      case "exit":
      case "q":
        throw "QUIT";
      default:
        if (cmd.startsWith("/")) {
          const sel = await popupSelect(COMMAND_ITEMS, "Commands", cmd.slice(1));
          if (sel) await execCmd(sel.split(/\s+/));
        } else {
          console.log(c.yellow(`Unknown: ${cmd}  (try: help)`));
        }
    }
  } catch (e) {
    if (e === "QUIT") throw e;
    console.log(c.red(`Error: ${(e as Error).message}`));
  }
}

/* ============================================================
 *  Service Console (follow mode with stdin → service)
 * ============================================================ */
async function enterServiceConsole(svc: ServiceName): Promise<void> {
  const svcObj = services[svc];
  const wasRaw = (stdin as Record<string, boolean>).isRaw ?? false;

  setRaw(true);
  stdin.resume();

  let running = true;
  let inputBuf = "";

  const PROMPT = c.cyan(`[${svcObj.title}] `);

  function fmtLog(l: LogLine): string {
    const ts = c.dim(l.time.toLocaleTimeString());
    const text = highlightLogLine(l.text);
    const pfx = l.stream === "stderr" ? c.red("!") : c.dim(" ");
    return `${ts} ${pfx} ${text}`;
  }

  function redrawInput(): void {
    stdout.write(`\r${PROMPT}${inputBuf}\x1B[K`);
  }

  stdout.write(`\n${c.bold(svcObj.title)} console — type and press Enter to send to service\n`);
  stdout.write(`${c.dim("Ctrl+C or /exit to leave · Ctrl+L to clear logs")}\n`);
  stdout.write(`${DIVIDER}\n`);

  for (const l of svcObj.getRecentLogs(10)) {
    stdout.write(fmtLog(l) + "\n");
  }

  redrawInput();

  const onLog = (l: LogLine) => {
    if (!running) return;
    stdout.write(`\r\x1B[K${fmtLog(l)}\n`);
    redrawInput();
  };
  svcObj.events.on("log", onLog);

  const dataHandler = (chunk: Buffer) => {
    if (!running) return;

    let i = 0;
    while (i < chunk.length) {
      /* ---------- escape sequences — silently ignore ---------- */
      if (chunk[i] === 0x1B) {
        const next = consumeEscapeSeq(chunk, i);
        i = next !== null ? next : i + 1;
        continue;
      }

      const byte = chunk[i];
      i++;

      if (byte === 0x03) {
        running = false;
        stdin.removeListener("data", dataHandler);
        svcObj.events.removeListener("log", onLog);
        setRaw(wasRaw);
        stdout.write(`\n${c.dim("left console")}\n`);
        return;
      }

      if (byte === 0x0D || byte === 0x0A) {
        const cmd = inputBuf.trim();
        stdout.write(`\r\x1B[K${c.dim(`> ${cmd}`)}\n`);

        if (cmd.toLowerCase() === "/exit") {
          running = false;
          stdin.removeListener("data", dataHandler);
          svcObj.events.removeListener("log", onLog);
          setRaw(wasRaw);
          stdout.write(`${c.dim("left console")}\n`);
          return;
        }

        if (cmd) {
          try { svcObj.proc?.stdin?.write(cmd + "\n"); } catch {}
        }

        inputBuf = "";
        redrawInput();
        continue;
      }

      if (byte === 0x08 || byte === 0x7F) {
        if (inputBuf.length > 0) {
          inputBuf = inputBuf.slice(0, -1);
          stdout.write("\b \b");
        }
        continue;
      }

      if (byte >= 0x20 && byte <= 0x7E) {
        inputBuf += String.fromCharCode(byte);
        stdout.write(String.fromCharCode(byte));
        continue;
      }

      /* all other control chars silently dropped */
    }
  };

  stdin.on("data", dataHandler);
}
