import process, { stdin, stdout } from "node:process";
import pkg from "../package.json" with { type: "json" };
import {
  cmdLogs,
  cmdRestart,
  cmdSend,
  cmdStart,
  cmdStartAll,
  cmdStatus,
  cmdStop,
  cmdStopAll,
  cmdUpdate,
} from "./commands.js";
import {
  formatLog,
  getAllLogs,
  getRecentLogs,
  onLog,
  SOURCE_META,
  wrapLogLine,
  type LogLevel,
  type LogSource,
  type UnifiedLog,
} from "./logs.js";
import { pauseAllProgress, resumeAllProgress } from "@sfmc-bds/sdk/logs";
import {
  dispatchModuleCommand,
  isModuleCommand,
  listInstalledModuleIdsSync,
  MODULE_CMD_NAMES,
  MODULE_SUBCOMMANDS,
} from "./module-commands.js";
import { listRegistryModuleIdsSync } from "./registry.js";
import { disableRemoteAgent, enrollRemoteAgent, remoteStatus, startRemoteAgent } from "./remote-agent.js";
import { forceStopAll, SERVICE_NAMES, stopAll } from "./services.js";
import { cmdLocale } from "./locale-command.js";
import { t } from "./i18n/index.js";
import { listSfmcModulePackages, resolveSfmcModulesRoot } from "./sfmc-modules-root.js";
import { c } from "./theme.js";
import { dispatchPacksCommand, isPacksCommand, PACKS_SUBCOMMANDS } from "./world-packs.js";

function setRaw(v: boolean): void {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {}
}

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

/** 按当前语言生成帮助（勿缓存为常量，locale 可切换）。 */
export function getHelp(): string {
  return `
${c.bold("╭──────────────────────────────────────────────────────────╮")}
${c.bold("│")}  ${c.green(t("help.title"))}${" ".repeat(Math.max(1, 52 - t("help.title").length))}${c.bold("│")}
${c.bold("╰──────────────────────────────────────────────────────────╯")}

${c.bold(t("help.section.service"))}
  ${c.green("status")}                    ${t("help.status")}
  ${c.green("logs")} <svc> [-n N] [-f]    ${t("help.logs")}
  ${c.green("start")}  <svc>|-all         ${t("help.start")}
  ${c.green("stop")}   <svc>|-all         ${t("help.stop")}
  ${c.green("restart")}<svc>|-all         ${t("help.restart")}
  ${c.green("send")}   <svc> <msg>        ${t("help.send")}

${c.bold(t("help.section.update"))}
  ${c.green("update")} [--check-only] [--channel=release|preview]
                                   ${t("help.update")}

${c.bold(t("help.section.remote"))}  ${c.dim("[beta]")}
  ${c.green("remote")} status            ${t("help.remote.status")}
  ${c.green("remote")} enroll <url> <token> [name]
                                   ${t("help.remote.enroll")}
  ${c.green("remote")} disable           ${t("help.remote.disable")}

${c.bold(t("help.section.module"))}
  ${c.green("module")}/${c.green("mod")} list
                                   ${t("help.module.list")}
  ${c.green("module")} search [id]       ${t("help.module.search")}
  ${c.green("module")} install <id> [--from <source>] [--link]
                                   ${t("help.module.install")}
  ${c.green("module")} uninstall <id>    ${t("help.module.uninstall")}
  ${c.green("module")} verify [id]       ${t("help.module.verify")}
  ${c.green("module")} info <id>         ${t("help.module.info")}
  ${c.green("module")} enable|disable <id>
                                   ${t("help.module.toggle")}
  ${c.green("module")} create            ${t("help.module.create")}
  ${c.green("module")} link [id]         ${t("help.module.link")}
  ${c.green("module")} dev               ${t("help.module.dev")}
  ${c.green("module")} build             ${t("help.module.build")}
  ${c.green("module")} reload [--build-only]
                                   ${t("help.module.reload")}

${c.bold(t("help.section.addon"))}
  ${c.green("addon")}/${c.green("packs")} list|search|enable|disable|bump|install|scan|doctor|path
                                   ${t("help.addon")}

${c.bold(t("help.section.general"))}
  ${c.green("init")}                     ${t("help.init")}
  ${c.green("locale")} [zh|en]           ${t("help.locale")}
  ${c.green("version")}                  ${t("help.version")}
  ${c.green("help")}                     ${t("help.help")}
  ${c.green("quit")} / ${c.green("exit")}  ${t("help.quit")}

${c.dim("────────────────────────────────────────────────────────────")}
${c.dim(t("help.shortcuts"))}
  ${c.dim("Tab")}       ${t("help.shortcut.tab")}
  ${c.dim("→")}         ${t("help.shortcut.right")}
  ${c.dim("Ctrl+L")}    ${t("help.shortcut.ctrll")}
  ${c.dim("↑↓")}        ${t("help.shortcut.history")}
`;
}

/** @deprecated 请用 getHelp()；保留别名以兼容旧导入。 */
export const HELP = {
  toString() {
    return getHelp();
  },
  valueOf() {
    return getHelp();
  },
} as unknown as string;

const COMMANDS = [
  "status",
  "logs",
  "start",
  "stop",
  "restart",
  "send",
  "init",
  "locale",
  "lang",
  "update",
  "remote",
  ...MODULE_CMD_NAMES,
  "packs",
  "addon",
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
    case "packs":
    case "addon":
      if (argIndex === 0) return [...PACKS_SUBCOMMANDS].filter(sw);
      if (argIndex === 1 && ["list"].includes(words[0] ?? "")) {
        return ["--kind", "--search"].filter(sw);
      }
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
      if (argIndex === 1 && ["info", "uninstall", "remove", "verify", "enable", "disable"].includes(verb)) {
        return listInstalledModuleIdsSync().filter(sw);
      }
      if (argIndex === 1 && verb === "reload") {
        return ["--build-only"].filter(sw);
      }
      if (argIndex === 1 && verb === "link") {
        const root = resolveSfmcModulesRoot();
        if (root) {
          const ids = listSfmcModulePackages(root)
            .map((p) => p.id)
            .filter(sw);
          if (ids.length) return ids;
        }
        return ["--from"].filter(sw);
      }
      if (argIndex >= 1 && verb === "install") {
        return ["--from", "--sha256", "--link"].filter(sw);
      }
      if (argIndex >= 2 && verb === "link") {
        return ["--from"].filter(sw);
      }
      if (argIndex >= 1 && verb === "list") {
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

/** 来源选择项:标签整段染色(含后续 formatSourceTag 的方括号风格) */
export const SOURCE_ITEMS: SelectItem[] = SOURCE_META.map((m) => ({
  label: m.paint(m.name),
  value: m.value,
}));

/**
 * 历史回放档位 — 复用 createMemoryBuffer(5000) 内存落盘。
 * value 约定: none | all | count:N | time:MS
 */
function historyItems(): SelectItem[] {
  return [
    { label: t("repl.history.live"), value: "none" },
    { label: t("repl.history.last50"), value: "count:50" },
    { label: t("repl.history.last100"), value: "count:100" },
    { label: t("repl.history.last500"), value: "count:500" },
    { label: t("repl.history.last1000"), value: "count:1000" },
    { label: t("repl.history.last1min"), value: "time:60000" },
    { label: t("repl.history.last5min"), value: "time:300000" },
    { label: t("repl.history.last15min"), value: "time:900000" },
    { label: t("repl.history.last1hour"), value: "time:3600000" },
    { label: t("repl.history.all"), value: "all" },
  ];
}

/** 按当前过滤条件从内存缓冲取历史日志 */
function queryHistory(filter: LogFilter, window: string): UnifiedLog[] {
  if (!window || window === "none") return [];

  const match = (l: UnifiedLog): boolean => {
    if (filter.levels.length && !filter.levels.includes(l.level)) return false;
    if (filter.sources.length && !filter.sources.includes(l.source)) return false;
    return true;
  };

  if (window === "all") return getAllLogs().filter(match);

  if (window.startsWith("count:")) {
    const n = Number(window.slice("count:".length));
    if (!Number.isFinite(n) || n <= 0) return [];
    return getRecentLogs(n, filter.levels, filter.sources);
  }

  if (window.startsWith("time:")) {
    const ms = Number(window.slice("time:".length));
    if (!Number.isFinite(ms) || ms <= 0) return [];
    const since = Date.now() - ms;
    return getAllLogs().filter((l) => match(l) && l.time.getTime() >= since);
  }

  return [];
}

function pushAndRender(log: UnifiedLog, filter: LogFilter): void {
  if (filter.levels.length && !filter.levels.includes(log.level)) return;
  if (filter.sources.length && !filter.sources.includes(log.source)) return;
  /* 进度条 pause → 清输入行写日志 → resume → 重绘 ❯ */
  pauseAllProgress();
  try {
    stdout.write(`\r\x1B[K${wrapLogLine(formatLog(log), 26)}\n`);
  } finally {
    resumeAllProgress();
  }
  currentRedraw?.();
}

/* ==================================================================
 *  START REPL
 * ================================================================== */

export async function startRepl(): Promise<void> {
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    stdout.write(c.dim(t("repl.stopping") + "\n"));
    await stopAll();
    stdout.write(c.dim(t("repl.bye") + "\n"));
  };
  const onSigint = (): void => {
    stdout.write(c.yellow("\n" + t("repl.forceStop") + "\n"));
    forceStopAll();
    process.exit(130);
  };
  process.on("SIGINT", onSigint);

  if (!stdin.isTTY) {
    console.log(c.dim(t("repl.nonInteractive")));
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

    /* Ctrl+L — filter level / source / history window */
    if (raw.startsWith("__CTRLL__")) {
      stdout.write(c.dim(`\nLEVEL──────────SOURCE──────────HISTORY\n`));
      const histChoices = historyItems();
      const lvl = await simpleSelect([{ label: t("common.all"), value: "" }, ...LEVEL_ITEMS]);
      if (lvl === null) continue;
      const src = await simpleSelect([{ label: t("common.all"), value: "" }, ...SOURCE_ITEMS]);
      if (src === null) continue;
      const hist = await simpleSelect(histChoices);
      if (hist === null) continue;

      filter = { levels: lvl ? [lvl as LogLevel] : [], sources: src ? [src as LogSource] : [] };

      const replay = queryHistory(filter, hist);
      if (replay.length > 0) {
        stdout.write(c.dim(t("repl.historyHeader", { count: replay.length }) + "\n"));
        for (const log of replay) {
          stdout.write(`${wrapLogLine(formatLog(log), 26)}\n`);
        }
      }

      const histLabel = histChoices.find((i) => i.value === hist)?.label ?? hist;
      stdout.write(
        c.dim(t("repl.filter", { level: lvl || "*", source: src || "*", history: histLabel }) + "\n")
      );
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) continue;

    try {
      await execCmd(trimmed.split(/\s+/));
    } catch (e) {
      if (e === "QUIT") break;
      console.log(c.red(t("common.error", { message: (e as Error).message })));
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
      stdout.write(getHelp());
      break;
    case "version":
      stdout.write(`${version}\n`);
      break;
    case "locale":
    case "lang":
      stdout.write(cmdLocale(args) + "\n");
      break;
    case "status":
      stdout.write(cmdStatus() + "\n");
      break;
    case "logs":
    case "log": {
      const out = cmdLogs(args, () => {
        if (!stdin.isTTY) {
          stdout.write(c.yellow(t("repl.followRequiresTty") + "\n"));
          return;
        }
      });
      if (out) stdout.write(out + "\n");
      break;
    }
    case "start":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write((await cmdStartAll()) + "\n");
      else if (args[0]) stdout.write((await cmdStart(args[0])) + "\n");
      else stdout.write(c.yellow(t("svc.start.usageShort") + "\n"));
      break;
    case "stop":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write((await cmdStopAll()) + "\n");
      else if (args[0]) stdout.write((await cmdStop(args[0])) + "\n");
      else stdout.write(c.yellow(t("svc.stop.usageShort") + "\n"));
      break;
    case "restart":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") {
        await cmdStopAll();
        stdout.write((await cmdStartAll()) + "\n");
      } else if (args[0]) stdout.write((await cmdRestart(args[0])) + "\n");
      else stdout.write(c.yellow(t("svc.restart.usageShort") + "\n"));
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
        const id = await enrollRemoteAgent(controllerUrl, enrollmentToken, agentName);
        stdout.write(t("remote.enrolled", { id }) + "\n");
        startRemoteAgent();
      } else if (subcommand === "disable") {
        disableRemoteAgent();
        stdout.write(c.dim(t("remote.disabled") + "\n"));
      } else {
        stdout.write(t("remote.usageShort") + "\n");
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
      if (isPacksCommand(cmd)) {
        const [sub, ...subRest] = args;
        stdout.write((await dispatchPacksCommand(sub, subRest)) + "\n");
        break;
      }
      stdout.write(c.yellow(t("common.unknownShort", { cmd: cmd ?? "" }) + "\n"));
  }
}
