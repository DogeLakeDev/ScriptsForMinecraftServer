import process, { stdin, stdout } from "node:process";
import pkg from "../package.json" with { type: "json" };
import { cmdLogs, cmdRestart, cmdSend, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { formatLog, getAllLogs, onLog, wrapLogLine, type LogLevel, type LogSource, type UnifiedLog } from "./logs.js";
import {
  dispatchModuleCommand,
  isModuleCommand,
  listInstalledModuleIdsSync,
  MODULE_CMD_NAMES,
  MODULE_SUBCOMMANDS,
  paintModuleCmdAlias,
} from "./module-commands.js";
import { listRegistryModuleIdsSync } from "./registry.js";
import { disableRemoteAgent, enrollRemoteAgent, remoteStatus, startRemoteAgent } from "./remote-agent.js";
import { forceStopAll, SERVICE_NAMES, stopAll } from "./services.js";
import { c } from "./theme.js";

function setRaw(v: boolean): void {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {}
}

/** HELP 行首:一次染色 MODULE_CMD_NAMES(与 paintModuleCmdAlias 同源,DRY)。 */
const MODULE_HELP_LABEL = paintModuleCmdAlias(c.green);

const welcome = `\n
  ${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`help · Ctrl+L · ↹ · → · ↑↓`)}\n
`;

const version = `\n
  ${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}\n
`;

export const HELP = `
${c.bold("Commands")}
  ${c.green("status")}                    Show all services status
  ${c.green("logs")} <svc> [-n N] [-f]    View / follow service logs
  ${c.green("start")} <svc>|-all          Start (or all)
  ${c.green("stop")} <svc>|-all           Stop (or all)
  ${c.green("restart")} <svc>|-all        Restart (or all)
  ${c.green("send")} <svc> <msg>          Send command to a service's stdin
  ${c.green("init")}                      Setup wizard
  ${c.green("update")} [--check-only] [--channel=release|preview]
                          Check/apply BDS update
  ${c.green("remote status")}             Show remote-agent enrollment status
  ${c.green("remote enroll")} <url> <token> [name]
                          Enroll this supervisor with a controller
  ${c.green("remote disable")}            Disable + disconnect remote agent
  ${MODULE_HELP_LABEL} list
                          List installed modules
  ${MODULE_HELP_LABEL} search [id]
                          Fetch registry list / show one module's registry info
  ${MODULE_HELP_LABEL} install <id> [--from <source>]
                          Fetch + install a module
  ${MODULE_HELP_LABEL} uninstall <id>
                          Remove an installed module
  ${MODULE_HELP_LABEL} verify [id]
                          Verify installed modules (SHA-256)
  ${MODULE_HELP_LABEL} info <id>
                          Show one installed module's details
  ${MODULE_HELP_LABEL} enable|disable <id>
                          Toggle module (needs db-server)
  ${c.green("version")}                   Show version
  ${c.green("help")}                      Show this
  ${c.green("quit")} / ${c.green("exit")} Exit

${c.dim("Shortcuts:")}
  ${c.dim("Tab")}      Complete (cycle on repeat)
  ${c.dim("→")}        Accept gray suggestion
  ${c.dim("Ctrl+L")}   Filter log level / source
  ${c.dim("↑↓")}       History
`;

const COMMANDS = [
  "status",
  "logs",
  "start",
  "stop",
  "restart",
  "send",
  "init",
  "update",
  "remote",
  ...MODULE_CMD_NAMES,
  "version",
  "help",
  "quit",
  "exit",
];

/* ==================================================================
 *  Context-aware completion
 * ================================================================== */
interface ParsedLine {
  cmd: string;
  /** cmd 之后的全部 token(不含正在输入的 current,若末尾无空格则不含最后一个半词) */
  words: string[];
  argIndex: number;
  current: string;
}

/**
 * 解析当前输入行,提取命令名、参数位置、正在输入的 word。
 * 末尾空格视为"刚结束一个 word,准备输入下一个"。
 */
function parseLine(line: string): ParsedLine {
  const endsWithSpace = line.length > 0 && /\s$/.test(line);
  const trimmed = line.trim();
  if (!trimmed) return { cmd: "", words: [], argIndex: 0, current: "" };
  const tokens = trimmed.split(/\s+/);
  if (endsWithSpace) {
    return {
      cmd: tokens[0] ?? "",
      words: tokens.slice(1),
      argIndex: tokens.length - 1,
      current: "",
    };
  }
  if (tokens.length === 1) return { cmd: "", words: [], argIndex: 0, current: tokens[0]! };
  return {
    cmd: tokens[0]!,
    words: tokens.slice(1, -1),
    argIndex: tokens.length - 2,
    current: tokens[tokens.length - 1]!,
  };
}

/**
 * 根据命令 + 参数位置返回补全候选 (区分命令,不再把服务名当成所有指令的二级参数)。
 */
function getCompletions(parsed: ParsedLine): string[] {
  const { cmd, words, argIndex, current } = parsed;
  const sw = (s: string): boolean => s.startsWith(current);
  if (!cmd) return COMMANDS.filter(sw);
  switch (cmd) {
    case "logs":
    case "log":
      if (argIndex === 0) return SERVICE_NAMES.filter(sw);
      if (argIndex === 1) return ["-n", "-f"].filter(sw);
      return [];
    case "start":
    case "stop":
    case "restart":
      if (argIndex === 0) return ["-all", ...SERVICE_NAMES].filter(sw);
      return [];
    case "send":
      if (argIndex === 0) return SERVICE_NAMES.filter(sw);
      return [];
    case "update":
      return ["--check-only", "--force", "--channel=release", "--channel=preview"].filter(sw);
    case "remote":
      if (argIndex === 0) return ["status", "enroll", "disable"].filter(sw);
      return [];
    default: {
      /* 与 MODULE_CMD_NAMES 对齐,新增别名无需再改 case(OCP/DRY) */
      if (!isModuleCommand(cmd)) return [];
      if (argIndex === 0) return [...MODULE_SUBCOMMANDS].filter(sw);
      const verb = words[0] ?? "";
      /* search:补全 registry 缓存中的 id;其余本地已装 id */
      if (argIndex === 1 && verb === "search") {
        return listRegistryModuleIdsSync().filter(sw);
      }
      if (
        argIndex === 1 &&
        ["info", "uninstall", "remove", "verify", "enable", "disable"].includes(verb)
      ) {
        return listInstalledModuleIdsSync().filter(sw);
      }
      if (argIndex >= 1 && ["install", "list"].includes(verb)) {
        return ["--from", "--sha256"].filter(sw);
      }
      return [];
    }
  }
}

/* ==================================================================
 *  Escape sequence consumer
 * ================================================================== */
function consumeEscapeSeq(chunk: Buffer, i: number): number | null {
  if (chunk[i] !== 0x1b) return null;
  const rem = chunk.length - i - 1;
  if (rem >= 2 && chunk[i + 1] === 0x5b) {
    let j = i + 2;
    while (j < chunk.length && chunk[j]! >= 0x30 && chunk[j]! <= 0x3f) j++;
    while (j < chunk.length && chunk[j]! >= 0x20 && chunk[j]! <= 0x2f) j++;
    if (j < chunk.length && chunk[j]! >= 0x40 && chunk[j]! <= 0x7e) j++;
    return j;
  }
  if (rem >= 2 && chunk[i + 1] === 0x4f) return i + 3;
  if (rem >= 1) return i + 2;
  return i + 1;
}

/* ==================================================================
 *  Simple select
 * ================================================================== */
interface SelectItem {
  label: string;
  value: string;
}

async function simpleSelect(items: SelectItem[]): Promise<string | null> {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let selected = 0;
  const h = Math.min(items.length, 8);
  let lastLines = h;
  function render(first: boolean): void {
    if (!first) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    } else {
      stdout.write("\x1B[J");
    }
    lastLines = h;
    let out = "";
    for (let i = 0; i < h; i++) {
      const cur = i === selected ? `◉ ${c.text(items[i]!.label)}` : `○ ${c.text(items[i]!.label)}`;
      out += `${cur}\n`;
    }
    stdout.write(out);
  }

  function clear(): void {
    stdout.write(`\x1B[${lastLines}A\x1B[J`);
  }

  render(true);

  return new Promise<string | null>((resolve) => {
    const handler = (chunk: Buffer) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 0x1b) {
          const rem = chunk.length - i - 1;
          if (rem === 0) {
            clear();
            stdin.removeListener("data", handler);
            setRaw(wasRaw);
            resolve(null);
            return;
          }
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const c = next - i;
            if (c === 3 && chunk[i + 1] === 0x5b) {
              if (chunk[i + 2] === 0x41 && selected > 0) {
                selected--;
                render(false);
              }
              if (chunk[i + 2] === 0x42 && selected < items.length - 1) {
                selected++;
                render(false);
              }
            }
            i = next;
          } else i++;
          continue;
        }
        const byte = chunk[i];
        i++;
        if (byte === 0x0d || byte === 0x0a) {
          clear();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(items[selected]?.value ?? null);
          return;
        }
        if (byte === 0x03) {
          clear();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }
      }
    };
    stdin.on("data", handler);
  });
}

/* ==================================================================
 *  Line reader
 * ================================================================== */
const history: string[] = [];
let historyIdx = -1;

/** 当前 readLine 的重绘函数 (窗口 resize 时调用,重绘输入行) */
let currentRedraw: (() => void) | null = null;

async function readLine(prompt: string, initial = ""): Promise<string | null> {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();

  let line = initial;
  let suggestion = "";
  let tabState: { candidates: string[]; idx: number; wordStart: number; completedLine: string } | null = null;

  /**
   * 重绘当前行:prompt + line + 灰色 autosuggestion,光标停在 line 末尾。
   * autosuggestion 取当前 word 的第一个补全候选的剩余部分 (仅当 current 非空时)。
   */
  function redraw(): void {
    const parsed = parseLine(line);
    const candidates = getCompletions(parsed);
    const first = candidates[0];
    suggestion =
      parsed.current && first && first !== parsed.current && first.startsWith(parsed.current)
        ? first.slice(parsed.current.length)
        : "";
    stdout.write("\r\x1B[K" + prompt + line);
    if (suggestion) {
      stdout.write(c.dim(suggestion));
      stdout.write("\x1B[" + suggestion.length + "D");
    }
  }

  redraw();

  currentRedraw = redraw;
  return new Promise<string | null>((resolve) => {
    const handler = (chunk: Buffer) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 0x1b) {
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const len = next - i;
            if (len === 3 && chunk[i + 1] === 0x5b) {
              const fin = chunk[i + 2];
              if (fin === 0x41 && historyIdx > 0) {
                historyIdx--;
                line = history[historyIdx] ?? "";
                tabState = null;
                redraw();
              } else if (fin === 0x42) {
                if (historyIdx < history.length - 1) {
                  historyIdx++;
                  line = history[historyIdx] ?? "";
                  tabState = null;
                  redraw();
                } else if (historyIdx === history.length - 1) {
                  historyIdx = history.length;
                  line = "";
                  tabState = null;
                  redraw();
                }
              } else if (fin === 0x43 && suggestion) {
                /* → 接受 autosuggestion */
                line += suggestion;
                tabState = null;
                redraw();
              }
            }
            i = next;
          } else i++;
          continue;
        }

        const byte = chunk[i];
        i++;

        if (byte === 0x0d || byte === 0x0a) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          /* 清掉灰色 suggestion,留下干净的 prompt+line 再换行 */
          stdout.write("\r\x1B[K" + prompt + line + "\r\n");
          if (line.length > 0) {
            history.push(line);
            if (history.length > 100) history.shift();
          }
          historyIdx = history.length;
          resolve(line);
          return;
        }

        if (byte === 0x03) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          if (line.length > 0) {
            line = "";
            tabState = null;
            /* Ctrl+C 清空当前输入,不弹 suggestion */
            stdout.write("\r\x1B[K" + prompt);
            continue;
          }
          stdout.write("\r\n");
          resolve(null);
          return;
        }

        /* Tab — context-aware completion, cycle on repeated Tab, no auto-space */
        if (byte === 0x09) {
          if (tabState && line === tabState.completedLine) {
            tabState.idx = (tabState.idx + 1) % tabState.candidates.length;
          } else {
            const parsed = parseLine(line);
            const candidates = getCompletions(parsed);
            if (candidates.length === 0) {
              tabState = null;
              redraw();
              continue;
            }
            tabState = {
              candidates,
              idx: 0,
              wordStart: line.length - parsed.current.length,
              completedLine: "",
            };
          }
          const match = tabState.candidates[tabState.idx]!;
          line = line.slice(0, tabState.wordStart) + match;
          tabState.completedLine = line;
          redraw();
          continue;
        }

        /* Ctrl+L */
        if (byte === 0x0c) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve("__CTRLL__" + line);
          return;
        }

        if (byte === 0x7f || byte === 0x08) {
          if (line.length > 0) {
            line = line.slice(0, -1);
          }
          tabState = null;
          redraw();
          continue;
        }

        if (byte! >= 0x20 && byte! <= 0x7e) {
          line += String.fromCharCode(byte!);
          tabState = null;
          redraw();
          continue;
        }
      }
    };
    stdin.on("data", handler);
  }).finally(() => {
    currentRedraw = null;
  });
}

/* ==================================================================
 *  REPL
 * ================================================================== */
interface LogFilter {
  levels: LogLevel[];
  sources: LogSource[];
}

const LEVEL_ITEMS: SelectItem[] = [
  { label: c.blue("INFO"), value: "info" },
  { label: c.yellow("WARN"), value: "warn" },
  { label: c.red("ERROR"), value: "error" },
  { label: c.dim("DEBUG"), value: "debug" },
  { label: c.green("SUCCESS"), value: "success" },
];
export const SOURCE_ITEMS: SelectItem[] = [
  { label: c.green("BDServer"), value: "bds" },
  { label: c.blue("DataBase"), value: "db" },
  { label: c.purple("QQBridge"), value: "qq" },
  { label: c.yellow(" LL-BOT "), value: "llbot" },
  { label: c.cyan(" SYSTEM "), value: "system" },
  { label: c.orange(" UPDATE "), value: "update" },
  { label: c.red("BDSTools"), value: "bds-tools" },
];

function pushAndRender(log: UnifiedLog, filter: LogFilter): void {
  if (filter.levels.length && !filter.levels.includes(log.level)) return;
  if (filter.sources.length && !filter.sources.includes(log.source)) return;
  stdout.write(`\r\x1B[K${wrapLogLine(formatLog(log), 26)}\n`);
}

/* ==================================================================
 *  START REPL
 * ================================================================== */

export async function startRepl(): Promise<void> {
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    stdout.write(c.dim("stopping services...\n"));
    await stopAll();
    stdout.write(c.dim("bye\n"));
  };
  const onSigint = (): void => {
    stdout.write(c.yellow("\nforce stopping services...\n"));
    forceStopAll();
    process.exit(130);
  };
  process.on("SIGINT", onSigint);

  if (!stdin.isTTY) {
    console.log(c.dim(" Non-interactive mode (pipe detected)\n"));
    for await (const line of (await import("node:readline/promises")).createInterface({
      input: stdin,
      output: stdout,
      terminal: false,
    })) {
      const t = line.trim();
      if (!t) continue;
      const p = t.split(/\s+/);
      if (["quit", "exit", "q"].includes(p[0]!)) break;
      if (p[0] === "init") {
        (await import("./wizard.js")).runWizard();
        continue;
      }
      await execCmd(p);
    }
    await shutdown();
    process.off("SIGINT", onSigint);
    return;
  }
  console.clear();
  stdout.write(welcome);

  let filter: LogFilter = { levels: [], sources: [] };

  const unsub = onLog((log) => pushAndRender(log, filter));

  /** 窗口大小变化时重绘可见日志 + 输入行 (按新宽度换行) */
  function onResize(): void {
    if (!currentRedraw) return;
    const rows = process.stdout.rows || 24;
    stdout.write("\x1B[H\x1B[2J");
    const all = getAllLogs();
    const out: string[] = [];
    let usedRows = 0;
    for (let i = all.length - 1; i >= 0; i--) {
      const log = all[i]!;
      if (filter.levels.length && !filter.levels.includes(log.level)) continue;
      if (filter.sources.length && !filter.sources.includes(log.source)) continue;
      const wrapped = wrapLogLine(formatLog(log), 26);
      const logRows = wrapped.split("\n").length;
      if (usedRows + logRows > rows - 2) break;
      out.unshift(wrapped);
      usedRows += logRows;
    }
    for (const l of out) stdout.write(l + "\n");
    currentRedraw();
  }

  process.stdout.on("resize", onResize);

  let pendingInput = "";

  while (true) {
    const raw = await readLine(c.text(" ❯ "), pendingInput);
    pendingInput = "";

    if (raw === null) break;

    /* Ctrl+L — filter */
    if (raw.startsWith("__CTRLL__")) {
      stdout.write(c.dim(`\nLEVEL──────────SOURCE\n`));
      const lvl = await simpleSelect([{ label: "ALL", value: "" }, ...LEVEL_ITEMS]);
      if (lvl === null) continue;
      const src = await simpleSelect([{ label: "ALL", value: "" }, ...SOURCE_ITEMS]);
      if (src === null) continue;
      filter = { levels: lvl ? [lvl as LogLevel] : [], sources: src ? [src as LogSource] : [] };
      stdout.write(c.dim(`filter: ${lvl || "*"} / ${src || "*"}\n`));
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) continue;

    try {
      await execCmd(trimmed.split(/\s+/));
    } catch (e) {
      if (e === "QUIT") break;
      console.log(c.red(`Error: ${(e as Error).message}`));
    }
  }

  process.stdout.off("resize", onResize);
  unsub();
  await shutdown();
  process.off("SIGINT", onSigint);
}

async function execCmd(parts: string[]): Promise<void> {
  const [cmd, ...args] = parts;

  switch (cmd) {
    case "help":
    case "h":
    case "?":
      stdout.write(HELP);
      break;
    case "version":
      stdout.write(`${version}\n`);
      break;
    case "status":
      stdout.write(cmdStatus() + "\n");
      break;
    case "logs":
    case "log": {
      const out = cmdLogs(args, () => {
        if (!stdin.isTTY) {
          stdout.write(c.yellow("follow mode requires TTY\n"));
          return;
        }
      });
      if (out) stdout.write(out + "\n");
      break;
    }
    case "start":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write((await cmdStartAll()) + "\n");
      else if (args[0]) stdout.write((await cmdStart(args[0])) + "\n");
      else stdout.write(c.yellow("Usage: start <service>|-all\n"));
      break;
    case "stop":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write((await cmdStopAll()) + "\n");
      else if (args[0]) stdout.write((await cmdStop(args[0])) + "\n");
      else stdout.write(c.yellow("Usage: stop <service>|-all\n"));
      break;
    case "restart":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") {
        await cmdStopAll();
        stdout.write((await cmdStartAll()) + "\n");
      } else if (args[0]) stdout.write((await cmdRestart(args[0])) + "\n");
      else stdout.write(c.yellow("Usage: restart <service>|-all\n"));
      break;
    case "send": {
      const svc = args[0] ?? "";
      const msg = args.slice(1).join(" ");
      stdout.write((await cmdSend(svc, msg)) + "\n");
      break;
    }
    case "init": {
      const { runWizard } = await import("./wizard.js");
      await runWizard();
      break;
    }
    case "update":
      await cmdUpdate(args);
      break;
    case "remote": {
      const [subcommand, controllerUrl, enrollmentToken, name] = args;
      if (subcommand === "status") {
        stdout.write(JSON.stringify(remoteStatus(), null, 2) + "\n");
      } else if (subcommand === "enroll" && controllerUrl && enrollmentToken) {
        const agentName = name ?? process.env.COMPUTERNAME ?? "sfmc-agent";
        stdout.write(`Enrolled remote agent: ${await enrollRemoteAgent(controllerUrl, enrollmentToken, agentName)}\n`);
        startRemoteAgent();
      } else if (subcommand === "disable") {
        disableRemoteAgent();
        stdout.write(c.dim("Remote agent disabled\n"));
      } else {
        stdout.write("Usage: remote enroll <controller-url> <enrollment-token> [name] | remote status | remote disable\n");
      }
      break;
    }
    case "quit":
    case "exit":
    case "q":
      throw "QUIT";
    default:
      if (isModuleCommand(cmd)) {
        const [sub, ...subRest] = args;
        stdout.write((await dispatchModuleCommand(sub, subRest)) + "\n");
        break;
      }
      stdout.write(c.yellow(`Unknown: ${cmd}  (try: help)\n`));
  }
}
