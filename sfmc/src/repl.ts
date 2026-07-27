import { pauseAllProgress, resumeAllProgress } from "@sfmc-bds/sdk/logs";
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
} from "./commands.js";
import { t } from "./i18n/index.js";
import {
  formatLog,
  getAllLogs,
  getRecentLogs,
  logPrefixWidth,
  onLog,
  SOURCE_META,
  wrapLogLine,
  type LogLevel,
  type LogSource,
  type UnifiedLog,
} from "./logs.js";
import {
  dispatchModuleCommand,
  getVisibleModuleSubcommands,
  isModuleCommand,
  listInstalledModuleIdsSync,
} from "./module-commands.js";
import {
  listVisiblePacksSubs,
  listVisibleTopLevelNames,
  type CommandMode,
} from "./command-surface.js";
import { gateModuleSub, gatePacksSub, gateTopLevel } from "./cli-gate.js";
import {
  activeNode,
  clampPaletteSelection,
  commitSelection,
  formatPaletteCascadeLines,
  paletteGhost,
  promptSlashColumn,
  resolvePaletteView,
} from "./command-palette.js";
import { getHelp as buildHelp } from "./help-text.js";
import { listRegistryModuleIdsSync } from "./registry.js";
import { stopRemoteAgent } from "./remote-agent.js";
import { listActiveSendTargets, paintSendPrompt, plainPrompt } from "./send-target.js";
import { forceStopAll, SERVICE_NAMES, stopAll, type ServiceName } from "./services.js";
import { listSfmcModulePackages, resolveSfmcModulesRoot } from "./sfmc-modules-root.js";
import { c } from "./theme.js";
import { dispatchPacksCommand, isPacksCommand } from "./world-packs.js";

const REPL_MODE: CommandMode = "repl";

function setRaw(v: boolean): void {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {}
}

const welcome = `\n
  ${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`/ · Tab · Ctrl+P · Ctrl+L · ←→ · ↑↓`)}\n
`;

const version = `\n
  ${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}\n
`;

export function getHelp(mode: CommandMode = "argv"): string {
  return buildHelp(mode);
}

/** @deprecated 请用 getHelp(mode)；保留别名以兼容旧导入。 */
export const HELP = {
  toString() {
    return getHelp("argv");
  },
  valueOf() {
    return getHelp("argv");
  },
} as unknown as string;

function getCommands(): string[] {
  return listVisibleTopLevelNames(REPL_MODE);
}

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
  const { words, argIndex, current } = parsed;
  const cmd = (parsed.cmd.startsWith("/") ? parsed.cmd.slice(1) : parsed.cmd);
  const sw = (s: string): boolean => s.startsWith(current);
  if (!cmd) {
    const cmds = getCommands().map((n) => (n.startsWith("/") ? n : n));
    return ["/", ...cmds].filter(sw);
  }
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
      if (argIndex === 0) return [...listVisiblePacksSubs(REPL_MODE)].filter(sw);
      if (argIndex === 1 && ["list"].includes(words[0] ?? "")) {
        return ["--kind", "--search"].filter(sw);
      }
      return [];
    default: {
      if (!isModuleCommand(cmd)) return [];
      if (argIndex === 0) return [...getVisibleModuleSubcommands(REPL_MODE)].filter(sw);
      const verb = words[0] ?? "";
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

/** 当前 readLine 的重绘函数 (窗口 resize / 日志推送时调用) */
let currentRedraw: (() => void) | null = null;

type ReadLineOpts = {
  getPrompt: () => string;
  /** 无活跃服务时，普通字符自动前置 / */
  autoSlash: boolean;
  /** Tab：在非 / 行上切换发送目标；返回 true 表示已处理 */
  cycleSendTarget: () => boolean;
  initial?: string;
};

type ReadLineResult =
  | { kind: "line"; value: string }
  | { kind: "cancel" }
  | { kind: "filter"; pending: string }
  | { kind: "run"; parts: string[] };

async function readLine(opts: ReadLineOpts): Promise<ReadLineResult> {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();

  let line = opts.initial ?? "";
  let cursor = line.length;
  let suggestion = "";
  /** 各级列选中 / 滚动（仅最右列可导航） */
  let palSels: number[] = [0];
  let palScrolls: number[] = [0];
  let overlayRows = 0;

  function prompt(): string {
    return opts.getPrompt();
  }

  function slashMode(): boolean {
    return line.startsWith("/");
  }

  function paletteView() {
    return resolvePaletteView(line, palSels, palScrolls);
  }

  function syncPaletteState(view: ReturnType<typeof resolvePaletteView>): void {
    for (let i = 0; i < view.columns.length; i++) {
      palSels[i] = view.columns[i]!.selected;
      palScrolls[i] = view.columns[i]!.scroll;
    }
  }

  function resetPalette(): void {
    palSels = [0];
    palScrolls = [0];
  }

  function clearOverlay(): void {
    stdout.write("\r\x1B[J");
    overlayRows = 0;
  }

  function redraw(): void {
    const p = prompt();
    suggestion = "";

    if (slashMode()) {
      const view = paletteView();
      syncPaletteState(view);
      if (cursor === line.length) {
        suggestion = paletteGhost(view);
      }
    } else {
      const parsed = parseLine(line);
      const candidates = getCompletions(parsed);
      const first = candidates[0];
      if (
        cursor === line.length &&
        parsed.current &&
        first &&
        first !== parsed.current &&
        first.startsWith(parsed.current)
      ) {
        suggestion = first.slice(parsed.current.length);
      }
    }

    clearOverlay();
    stdout.write(p + line);
    if (suggestion) stdout.write(c.dim(suggestion));

    if (slashMode()) {
      const view = paletteView();
      const indent = promptSlashColumn(p);
      const list = formatPaletteCascadeLines(view, indent);
      if (list.length > 0) {
        stdout.write("\n" + list.join("\n"));
        overlayRows = list.length;
        stdout.write(`\x1B[${overlayRows}A`);
      }
    }

    const col = promptSlashColumn(p) + cursor + 1;
    stdout.write(`\r\x1B[${col}G`);
  }

  redraw();
  currentRedraw = redraw;

  return new Promise<ReadLineResult>((resolve) => {
    const done = (value: ReadLineResult): void => {
      stdin.removeListener("data", handler);
      setRaw(wasRaw);
      currentRedraw = null;
      resolve(value);
    };

    const finishLine = (value: string): void => {
      clearOverlay();
      stdout.write(prompt() + value + "\r\n");
      if (value.length > 0) {
        history.push(value);
        if (history.length > 100) history.shift();
      }
      historyIdx = history.length;
      done({ kind: "line", value });
    };

    /** ↑↓/Tab：仅在最右列轮换选中，写入灰字，不改输入框 */
    const movePalSel = (delta: number): boolean => {
      const view = paletteView();
      if (view.hidden) return false;
      const col = view.columns[view.active];
      if (!col || col.items.length === 0) return false;
      const len = col.items.length;
      const cur = clampPaletteSelection(col.selected, len);
      const next = ((cur + delta) % len + len) % len;
      palSels[view.active] = next;
      redraw();
      return true;
    };

    const handler = (chunk: Buffer) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 0x1b) {
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const len = next - i;
            if (len === 3 && chunk[i + 1] === 0x5b) {
              const fin = chunk[i + 2];
              if (fin === 0x41) {
                /* ↑ */
                if (slashMode() && movePalSel(-1)) {
                  i = next;
                  continue;
                }
                if (historyIdx > 0) {
                  historyIdx--;
                  line = history[historyIdx] ?? "";
                  cursor = line.length;
                  resetPalette();
                  redraw();
                }
              } else if (fin === 0x42) {
                /* ↓ */
                if (slashMode() && movePalSel(1)) {
                  i = next;
                  continue;
                }
                if (historyIdx < history.length - 1) {
                  historyIdx++;
                  line = history[historyIdx] ?? "";
                  cursor = line.length;
                  resetPalette();
                  redraw();
                } else if (historyIdx === history.length - 1) {
                  historyIdx = history.length;
                  line = "";
                  cursor = 0;
                  resetPalette();
                  redraw();
                }
              } else if (fin === 0x43) {
                /* →：接受灰字或移光标（不切换面板焦点） */
                if (cursor < line.length) {
                  cursor++;
                  redraw();
                } else if (suggestion) {
                  line += suggestion;
                  cursor = line.length;
                  redraw();
                }
              } else if (fin === 0x44) {
                if (cursor > 0) {
                  cursor--;
                  redraw();
                }
              } else if (fin === 0x48) {
                cursor = 0;
                redraw();
              } else if (fin === 0x46) {
                cursor = line.length;
                redraw();
              }
            }
            i = next;
          } else i++;
          continue;
        }

        const byte = chunk[i]!;
        i++;

        if (byte === 0x0d || byte === 0x0a) {
          if (slashMode()) {
            const view = paletteView();
            syncPaletteState(view);
            if (!view.hidden && view.columns.some((col) => col.items.length > 0) && activeNode(view)) {
              const acc = commitSelection(line, view);
              if (acc.submit) {
                finishLine(acc.line);
                return;
              }
              line = acc.line;
              cursor = line.length;
              /* 新层选中归零 */
              const depth = Math.max(0, acc.line.trimEnd().split(/\s+/).length - 1);
              while (palSels.length <= depth + 1) palSels.push(0);
              while (palScrolls.length <= depth + 1) palScrolls.push(0);
              palSels[depth + 1] = 0;
              palScrolls[depth + 1] = 0;
              redraw();
              continue;
            }
          }
          finishLine(line);
          return;
        }

        if (byte === 0x03) {
          if (line.length > 0) {
            line = "";
            cursor = 0;
            resetPalette();
            redraw();
            continue;
          }
          clearOverlay();
          stdout.write("\r\n");
          done({ kind: "cancel" });
          return;
        }

        /* Ctrl+P — 确保以 / 开头 */
        if (byte === 0x10) {
          if (!line.startsWith("/")) {
            line = "/" + line;
            cursor = Math.min(cursor + 1, line.length);
          }
          resetPalette();
          redraw();
          continue;
        }

        if (byte === 0x09) {
          /* Tab：/ 模式 = 列表轮换；否则切换发送目标 */
          if (slashMode()) {
            movePalSel(1);
            continue;
          }
          if (opts.cycleSendTarget()) {
            redraw();
            continue;
          }
          continue;
        }

        if (byte === 0x0c) {
          clearOverlay();
          done({ kind: "filter", pending: line });
          return;
        }

        if (byte === 0x7f || byte === 0x08) {
          if (cursor > 0) {
            line = line.slice(0, cursor - 1) + line.slice(cursor);
            cursor--;
          }
          if (slashMode()) {
            const view = paletteView();
            palSels[view.active] = 0;
            palScrolls[view.active] = 0;
          }
          redraw();
          continue;
        }

        if (byte >= 0x20 && byte <= 0x7e) {
          let ch = String.fromCharCode(byte);
          if (opts.autoSlash && line.length === 0 && ch !== "/") {
            ch = "/" + ch;
          }
          line = line.slice(0, cursor) + ch + line.slice(cursor);
          cursor += ch.length;
          if (slashMode()) {
            const view = paletteView();
            palSels[view.active] = 0;
            palScrolls[view.active] = 0;
          }
          redraw();
          continue;
        }
      }
    };
    stdin.on("data", handler);
  });
}

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
    stdout.write(`\r\x1B[K${wrapLogLine(formatLog(log), logPrefixWidth(log))}\n`);
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
  const onSigint = (): void => {
    stdout.write(c.yellow("\n" + t("repl.forceStop") + "\n"));
    forceStopAll();
    stopRemoteAgent();
    process.exit(130);
  };
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    process.off("SIGINT", onSigint);
    stdout.write(c.dim(t("repl.stopping") + "\n"));
    await stopAll();
    stopRemoteAgent();
    try {
      setRaw(false);
      stdin.pause();
    } catch {
      /* ignore */
    }
    stdout.write(c.dim(t("repl.bye") + "\n"));
    process.exit(0);
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
      const wrapped = wrapLogLine(formatLog(log), logPrefixWidth(log));
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
  let preferredTarget: ServiceName | null = null;
  let activeTargets: ServiceName[] = [];

  function currentTarget(): ServiceName | null {
    if (activeTargets.length === 0) return null;
    if (preferredTarget && activeTargets.includes(preferredTarget)) return preferredTarget;
    preferredTarget = activeTargets[0]!;
    return preferredTarget;
  }

  function buildPrompt(): string {
    const tgt = currentTarget();
    return tgt ? paintSendPrompt(tgt) : plainPrompt();
  }

  while (true) {
    activeTargets = await listActiveSendTargets();
    const result = await readLine({
      getPrompt: buildPrompt,
      autoSlash: activeTargets.length === 0,
      cycleSendTarget: () => {
        if (activeTargets.length === 0) return false;
        const cur = currentTarget();
        const idx = cur ? activeTargets.indexOf(cur) : -1;
        const next = activeTargets[(idx + 1) % activeTargets.length]!;
        preferredTarget = next;
        return true;
      },
      initial: pendingInput,
    });
    pendingInput = "";

    if (result.kind === "cancel") break;

    if (result.kind === "filter") {
      pendingInput = result.pending;
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
          stdout.write(`${wrapLogLine(formatLog(log), logPrefixWidth(log))}\n`);
        }
      }

      const histLabel = histChoices.find((i) => i.value === hist)?.label ?? hist;
      stdout.write(c.dim(t("repl.filter", { level: lvl || "*", source: src || "*", history: histLabel }) + "\n"));
      continue;
    }

    if (result.kind === "run") {
      try {
        await execCmd(result.parts);
      } catch (e) {
        if (e === "QUIT") break;
        console.log(c.red(t("common.error", { message: (e as Error).message })));
      }
      continue;
    }

    const trimmed = result.value.trim();
    if (!trimmed) continue;

    try {
      if (trimmed.startsWith("/")) {
        await execCmd(trimmed.split(/\s+/));
      } else {
        const tgt = currentTarget();
        if (!tgt) {
          /* 无活跃服务时应已被 autoSlash 转为命令 */
          await execCmd(("/" + trimmed).split(/\s+/));
        } else {
          const sent = await cmdSend(tgt, trimmed);
          if (sent) stdout.write(sent + "\n");
        }
      }
    } catch (e) {
      if (e === "QUIT") break;
      console.log(c.red(t("common.error", { message: (e as Error).message })));
    }
  }

  process.stdout.off("resize", onResize);
  unsub();
  await shutdown();
}

async function execCmd(parts: string[]): Promise<void> {
  const normalized = parts.map((p, i) => (i === 0 && p.startsWith("/") ? p.slice(1) : p));
  const [cmd, ...args] = normalized;

  if (cmd && !["help", "h", "?", "version"].includes(cmd)) {
    const topGate = gateTopLevel(cmd, REPL_MODE);
    if (topGate) {
      stdout.write(topGate + "\n");
      return;
    }
  }

  switch (cmd) {
    case "help":
    case "h":
    case "?":
      stdout.write(getHelp(REPL_MODE));
      break;
    case "version":
      stdout.write(`${version}\n`);
      break;
    case "status":
      stdout.write((await cmdStatus()) + "\n");
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
      {
        const sent = await cmdSend(svc, msg);
        if (sent) stdout.write(sent + "\n");
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
        const g = gateModuleSub(sub, REPL_MODE);
        if (g) {
          stdout.write(g + "\n");
          break;
        }
        stdout.write((await dispatchModuleCommand(sub, subRest)) + "\n");
        break;
      }
      if (isPacksCommand(cmd)) {
        const [sub, ...subRest] = args;
        const g = gatePacksSub(sub, REPL_MODE);
        if (g) {
          stdout.write(g + "\n");
          break;
        }
        stdout.write((await dispatchPacksCommand(sub, subRest)) + "\n");
        break;
      }
      stdout.write(c.yellow(t("common.unknownShort", { cmd: cmd ?? "" }) + "\n"));
  }
}

