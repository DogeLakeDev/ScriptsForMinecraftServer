import { pauseAllProgress, resumeAllProgress } from "@sfmc-bds/sdk/logs";
import chalk from "chalk";
import process, { stdin, stdout } from "node:process";
import pkg from "../package.json" with { type: "json" };
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
import {
  listVisiblePacksSubs,
  listVisibleTopLevelNames,
  resolveModuleTopShorthand,
  type CommandMode,
} from "./command-surface.js";
import { cmdRestart, cmdSend, cmdStart, cmdStartAll, cmdStatus, cmdStop, cmdStopAll, cmdUpdate } from "./commands.js";
import { cmdRemote } from "./cmd-remote.js";
import { cmdDebug } from "./debug-command.js";
import { getHelp as buildHelp } from "./help-text.js";
import { t } from "./i18n/index.js";
import { cmdLocale } from "./locale-command.js";
import {
  formatLog,
  getAllLogs,
  logPrefixWidth,
  onLog,
  readDiskLogs,
  SOURCE_META,
  wrapLogLine,
  type LogLevel,
  type UnifiedLog,
} from "./logs.js";
import {
  dispatchModuleCommand,
  getVisibleModuleSubcommands,
  isModuleCommand,
  listInstalledModuleIdsSync,
} from "./module-commands.js";
import { listRegistryModuleIdsSync } from "./registry.js";
import { stopRemoteAgent } from "./remote-agent.js";
import {
  createLogsFilterWindow,
  createServiceWindow,
  serviceWindowId,
  WindowHost,
  type LogsFilterState,
  type WindowChrome,
  type WindowKeyEvent,
  type WindowKeyResult,
} from "./repl-windows/index.js";
import { listActiveSendTargets, paintSendPrompt, plainPrompt } from "./send-target.js";
import { forceStopAll, onServiceStateChange, SERVICE_NAMES, stopAll, type ServiceName } from "./services.js";
import { c, T } from "./theme.js";
import { dispatchPacksCommand, isPacksCommand } from "./world-packs.js";

const REPL_MODE: CommandMode = "repl";

function getDisplayWidth(str: string) {
  // 先去除 ANSI 码
  const plain = str.replace(/\x1b\[[0-9;]*m/g, "");
  let width = 0;
  for (const ch of plain) {
    // 粗略判断：非 ASCII 字符（如中文）视为占 2 列
    if (ch.codePointAt(0)! > 127) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function charDisplayWidth(ch: string): number {
  return ch.codePointAt(0)! > 127 ? 2 : 1;
}

function setRaw(v: boolean): void {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {}
}

/** 左侧 SFMC logo 三行（底行含接横线的 ╰───，与最终布局一致） */
const LOGO_ROWS = ["╭─╮╭─╴╭┬╮╭─╴", "╰─╮├╴ ││││  ", "╰─╯╵  ╵ ╵╰───"] as const;
const LOGO_PAD = "  ";
const LOGO_TOP_GAP = "    ";
const LOGO_MID_GAP = "      ";
const SHORTCUT_HINT = `  / · Tab · Ctrl+P · Ctrl+L · ←→ · ↑↓`;
/** S→F→M→C 手写笔顺（row, col）；空格格在构建时过滤 */
const LOGO_STROKE_RAW: ReadonlyArray<readonly [number, number]> = [
  // S
  [0, 1],
  [0, 2],
  [0, 0],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 2],
  [2, 1],
  [2, 0],
  // F
  [0, 3],
  [1, 3],
  [2, 3],
  [0, 4],
  [0, 5],
  [1, 4],
  // M
  [0, 6],
  [1, 6],
  [2, 6],
  [0, 7],
  [1, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  // C（末笔落到 ╰───，随后无缝接横线延长）
  [0, 10],
  [0, 11],
  [0, 9],
  [1, 9],
  [2, 9],
  [2, 10],
  [2, 11],
  [2, 12],
];
const LOGO_STROKES = LOGO_STROKE_RAW.filter(([r, col]) => {
  const ch = LOGO_ROWS[r]?.[col];
  return ch !== undefined && ch !== " ";
});

/** 欢迎条纯文本（与下方样式化 meta 内容一致） */
const metaPlain = `Scripts For Minecraft Server v${pkg.version}`;
/** 强调首字母下标：S / F / M / c */
const META_ACCENT_INDEX = new Set([0, 8, 12, 16]);
const metaUnlit = chalk.hex(T.subtle);
const meta = `${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${pkg.version}`;
const metaWidth = getDisplayWidth(metaPlain);
const lineLength = metaWidth + 5;

/** 按显示列进度点亮纯文本；paintLit 决定已亮字符样式 */
function buildTextAtProgress(
  plain: string,
  litColumns: number,
  paintLit: (ch: string, index: number) => string
): string {
  let cols = 0;
  let out = "";
  for (let i = 0; i < plain.length; i++) {
    const ch = plain[i]!;
    const w = charDisplayWidth(ch);
    if (cols + w <= litColumns) {
      out += paintLit(ch, i);
    } else {
      out += metaUnlit(ch);
    }
    cols += w;
  }
  return out;
}

/** 按显示列进度点亮 meta：已亮保留最终样式，未亮用 subtle */
function buildMetaAtProgress(litColumns: number): string {
  return buildTextAtProgress(metaPlain, litColumns, (ch, i) => (META_ACCENT_INDEX.has(i) ? c.text(ch) : c.dim(ch)));
}

/** 快捷键提示与横线/meta 共用同一列进度 */
function buildShortcutsAtProgress(litColumns: number): string {
  return buildTextAtProgress(SHORTCUT_HINT, litColumns, (ch) => c.dim(ch));
}

/** 按笔顺进度渲染 logo；未写出的墨迹用空格占位，保持布局稳定 */
function buildLogoRows(strokeCount: number): [string, string, string] {
  const lit = new Set<string>();
  const n = Math.min(Math.max(0, strokeCount), LOGO_STROKES.length);
  for (let i = 0; i < n; i++) {
    const [r, col] = LOGO_STROKES[i]!;
    lit.add(`${r},${col}`);
  }
  return LOGO_ROWS.map((row, r) => {
    let out = "";
    for (let col = 0; col < row.length; col++) {
      const ch = row[col]!;
      if (ch === " ") {
        out += " ";
      } else if (lit.has(`${r},${col}`)) {
        out += c.text(ch);
      } else {
        out += " ";
      }
    }
    return out;
  }) as [string, string, string];
}

function buildWelcomeLines(
  strokeCount: number,
  lineProgress: number,
  metaContent: string,
  shortcutContent: string
): string[] {
  const [topLogo, midLogo, botLogo] = buildLogoRows(strokeCount);
  const line = "─".repeat(Math.max(0, lineProgress));
  return [
    `\n`,
    `${LOGO_PAD}${topLogo}${LOGO_TOP_GAP}${shortcutContent}`,
    `${LOGO_PAD}${midLogo}${LOGO_MID_GAP}${metaContent}`,
    `${LOGO_PAD}${botLogo}${line}`,
  ];
}

/** 回卷重绘：首帧直接写，之后光标上移并逐行 ESC[2K 清行重写 */
function paintWelcomeLines(lines: string[], firstFrame: boolean): void {
  if (!firstFrame) {
    process.stdout.write(`\x1b[${lines.length}A`);
  }
  for (let i = 0; i < lines.length; i++) {
    process.stdout.write(`\x1b[2K\r${lines[i]}`);
    if (i < lines.length - 1) process.stdout.write("\n");
  }
}

export async function playWelcomeAnimation(): Promise<void> {
  const strokeTotal = LOGO_STROKES.length;
  const totalSteps = strokeTotal + lineLength;
  const finalShortcuts = c.dim(SHORTCUT_HINT);

  // 非 TTY：直接输出最终帧，避免控制序列污染管道输出
  if (!process.stdout.isTTY) {
    const lines = buildWelcomeLines(strokeTotal, lineLength, c.bold(meta), finalShortcuts);
    process.stdout.write(`\n${lines.join("\n")}\n\n`);
    return;
  }

  let step = 0;
  let firstFrame = true;

  process.stdout.write("\x1b[?25l");
  // 先空一行，把欢迎块与上方输出隔开
  process.stdout.write("\n");

  return new Promise((resolve) => {
    const done = (): void => {
      const finalLines = buildWelcomeLines(strokeTotal, lineLength, c.bold(meta), finalShortcuts);
      paintWelcomeLines(finalLines, firstFrame);
      process.stdout.write("\x1b[?25h\n\n");
      resolve();
    };

    const tick = (): void => {
      const inLogo = step < strokeTotal;
      const strokeCount = Math.min(step + 1, strokeTotal);
      // 右侧三行（shortcut / meta / 横线）共用同一列进度
      const lineProgress = inLogo ? 0 : Math.min(step - strokeTotal + 1, lineLength);
      const metaContent = buildMetaAtProgress(Math.min(lineProgress, metaWidth));
      const shortcutContent = buildShortcutsAtProgress(lineProgress);
      const lines = buildWelcomeLines(strokeCount, lineProgress, metaContent, shortcutContent);
      paintWelcomeLines(lines, firstFrame);
      firstFrame = false;

      if (step >= totalSteps - 1) {
        done();
        return;
      }
      step += 1;
      // logo 笔顺稍慢；接上横线后恢复较快节奏
      setTimeout(tick, step < strokeTotal ? 22 : 5);
    };

    setTimeout(tick, 22);
  });
}

/* let welcome = `\n
  ${c.text(`⠪⡁⡯⠁`)}
  ${c.text(`⠒⠁⠃`)}${c.purple(`⠄`)}
  ${c.text(`⡷⡇⡎⠁`)}      ${meta}
  ${c.text(`⠃⠃⠑⠂`)}      ${c.dim(`/ · Tab · Ctrl+P · Ctrl+L · ←→ · ↑↓`)}\n
`; */

/* welcome = `\n
  ╭─╮╭─╴╭┬╮╭─╴    ${c.dim(`/ · Tab · Ctrl+P · Ctrl+L · ←→ · ↑↓`)}
  ╰─╮├╴ ││││      ${meta}
  ╰─╯╵  ╵ ╵╰───${"─".repeat(getDisplayWidth(meta) + 3)}\n`; */

export function getHelp(mode: CommandMode = "argv"): string {
  return buildHelp(mode);
}

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
  const cmd = parsed.cmd.startsWith("/") ? parsed.cmd.slice(1) : parsed.cmd;
  const sw = (s: string): boolean => s.startsWith(current);
  if (!cmd) {
    const cmds = getCommands().map((n) => (n.startsWith("/") ? n : n));
    return ["/", ...cmds].filter(sw);
  }
  switch (cmd) {
    case "logs":
    case "log":
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
      if (argIndex >= 1 && verb === "install") {
        return ["--from", "--sha256", "--link"].filter(sw);
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
 *  Line reader
 * ================================================================== */
const history: string[] = [];
let historyIdx = -1;

/** 当前 readLine 的重绘函数 (窗口 resize / 日志推送时调用) */
let currentRedraw: (() => void) | null = null;

type ReadLineOpts = {
  getPrompt: () => string;
  /** 无活跃服务时，普通字符自动前置 /；可为 getter 以便服务退出后即时生效 */
  autoSlash: boolean | (() => boolean);
  /** Tab：在非 / 行上切换发送目标；返回 true 表示已处理 */
  cycleSendTarget: () => boolean;
  /** 当前窗口 chrome（无输入窗画 shortcut 条） */
  getChrome?: () => WindowChrome;
  /** 交给活动窗的按键（Esc / L / S 等） */
  onWindowKey?: (ev: WindowKeyEvent) => WindowKeyResult;
  initial?: string;
};

type ReadLineResult =
  | { kind: "line"; value: string }
  | { kind: "cancel" }
  | { kind: "open-logs"; pending: string }
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

  function showsInput(): boolean {
    return opts.getChrome?.().showsInput !== false;
  }

  function slashMode(): boolean {
    return showsInput() && line.startsWith("/");
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

  function applyWindowKey(ev: WindowKeyEvent): boolean {
    if (!opts.onWindowKey) return false;
    const r = opts.onWindowKey(ev);
    if (r.action === "none") return false;
    if (r.action === "redraw") redraw();
    return true;
  }

  function redraw(): void {
    const chrome = opts.getChrome?.();
    if (chrome && !chrome.showsInput) {
      clearOverlay();
      const foot = chrome.footerShortcuts || "";
      stdout.write(foot);
      stdout.write("\r");
      return;
    }

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
      const next = (((cur + delta) % len) + len) % len;
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
            /* 单独 Esc → 交给窗口（/logs 返回） */
            if (len === 1) {
              if (applyWindowKey({ type: "escape" })) {
                i = next;
                continue;
              }
              i = next;
              continue;
            }
            if (!showsInput()) {
              i = next;
              continue;
            }
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
          if (!showsInput()) continue;
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
          if (!showsInput()) {
            /* 无输入窗：Ctrl+C 返回上一窗，再按才退出 */
            if (applyWindowKey({ type: "escape" })) continue;
            clearOverlay();
            stdout.write("\r\n");
            done({ kind: "cancel" });
            return;
          }
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
          if (!showsInput()) continue;
          if (!line.startsWith("/")) {
            line = "/" + line;
            cursor = Math.min(cursor + 1, line.length);
          }
          resetPalette();
          redraw();
          continue;
        }

        if (byte === 0x09) {
          /* Tab：/ 模式 = 列表轮换；否则切换服务窗 */
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
          /* Ctrl+L → 打开 /logs 筛选窗 */
          clearOverlay();
          done({ kind: "open-logs", pending: showsInput() ? line : "" });
          return;
        }

        if (byte === 0x7f || byte === 0x08) {
          if (!showsInput()) continue;
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
          const ch = String.fromCharCode(byte);
          if (!showsInput()) {
            applyWindowKey({ type: "char", ch });
            continue;
          }
          let insert = ch;
          const autoSlash =
            typeof opts.autoSlash === "function" ? opts.autoSlash() : opts.autoSlash;
          if (autoSlash && line.length === 0 && insert !== "/") {
            insert = "/" + insert;
          }
          line = line.slice(0, cursor) + insert + line.slice(cursor);
          cursor += insert.length;
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

/** 来源选择项:方括号 3 字符标签染色（供外部/测试复用） */
export const SOURCE_ITEMS: Array<{ label: string; value: string }> = SOURCE_META.map((m) => ({
  label: m.paint(`[${m.name}]`),
  value: m.value,
}));

/** REPL 交互态：无参 /logs 打开筛选窗（由 startRepl 注入） */
let openLogsWindowHook: (() => void) | null = null;

function writeLogLineToTty(wrapped: string): void {
  pauseAllProgress();
  try {
    stdout.write(`\r\x1B[K${wrapped}\n`);
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
    openLogsWindowHook = null;
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
  await playWelcomeAnimation();

  let logsFilterState: LogsFilterState = { levels: [], sources: [] };
  let preferredTarget: ServiceName | null = null;
  let activeTargets: ServiceName[] = [];
  let pendingInput = "";

  const host = new WindowHost({
    writeLog: writeLogLineToTty,
    onChromeChange: () => currentRedraw?.(),
  });

  function clearTerminal(): void {
    /* 清视口；再清 scrollback，避免往上滑仍看到上一窗内容 */
    console.clear();
    stdout.write("\x1B[3J");
  }

  /** 首次进入窗口：从内存/落盘拉一次作为种子缓存 */
  function seedWindowBuffer(w: {
    id: string;
    acceptLog: (l: UnifiedLog) => boolean;
    formatLogLine: (l: UnifiedLog) => { text: string; indent: number };
    getReplayFilter?: () => { levels: string[]; sources: string[] };
  }): string[] {
    const lines: string[] = [];
    if (w.id === "logs") {
      const f = w.getReplayFilter?.() ?? { levels: [], sources: [] };
      const disk = readDiskLogs({
        levels: f.levels as LogLevel[],
        sources: f.sources,
      });
      for (const log of disk) {
        if (!w.acceptLog(log)) continue;
        const { text, indent } = w.formatLogLine(log);
        lines.push(wrapLogLine(text, indent));
      }
    } else {
      for (const log of getAllLogs()) {
        if (!w.acceptLog(log)) continue;
        const { text, indent } = w.formatLogLine(log);
        lines.push(wrapLogLine(text, indent));
      }
    }
    host.setBuffer(w.id, lines);
    return lines;
  }

  /**
   * 展示活动窗：先清屏，再恢复/seed。
   * - /logs：用落盘种子缓存（改筛选才 reseed），避免重复读文件
   * - 服务主面板：每次从内存重 seed，保证离开 /logs 或 Tab 回来时内容实时
   */
  function showActiveWindow(opts?: { reseed?: boolean }): void {
    clearTerminal();
    const w = host.getActive();
    if (!w) {
      currentRedraw?.();
      return;
    }
    let lines: readonly string[];
    if (w.id === "logs") {
      if (opts?.reseed) host.invalidateBuffer(w.id);
      lines = host.hasBuffer(w.id) ? host.getBuffer(w.id) : seedWindowBuffer(w);
    } else {
      /* 主面板实时：不作废也无妨，直接重拉内存缓冲 */
      host.invalidateBuffer(w.id);
      lines = seedWindowBuffer(w);
    }
    for (const l of lines) stdout.write(l + "\n");
    currentRedraw?.();
  }

  host.register(
    createLogsFilterWindow({
      getState: () => logsFilterState,
      setState: (next) => {
        logsFilterState = next;
      },
      /* 筛选变更：作废 /logs 缓存并重新读盘一次 */
      onFilterChanged: () => showActiveWindow({ reseed: true }),
    })
  );

  function syncServiceWindows(targets: ServiceName[]): void {
    for (const name of targets) {
      const id = serviceWindowId(name);
      if (!host.has(id)) host.register(createServiceWindow(name));
    }
    host.setServiceOrder(targets.map(serviceWindowId));
    const svc = host.getActive()?.serviceName;
    if (svc) preferredTarget = svc;
  }

  function openLogsWindow(): void {
    /* 离开主面板：其缓存可留着，但展示上先清屏再进 /logs；Esc 回来会按实时重 seed 主面板 */
    host.open("logs");
    showActiveWindow();
  }

  openLogsWindowHook = openLogsWindow;

  const unsub = onLog((log) => {
    if (host.getActive()) {
      host.routeLog(log);
      return;
    }
    /* 无活动窗：全量展示（带源标签），与旧空闲行为一致 */
    writeLogLineToTty(wrapLogLine(formatLog(log), logPrefixWidth(log)));
  });

  async function refreshTargetsFromRuntime(): Promise<void> {
    const prevId = host.getActiveId();
    activeTargets = await listActiveSendTargets();
    syncServiceWindows(activeTargets);
    if (preferredTarget && !activeTargets.includes(preferredTarget)) {
      preferredTarget = activeTargets[0] ?? null;
    }
    const nextId = host.getActiveId();
    /* 新激活窗或首次尚无缓存：清屏并 seed/恢复 */
    if (nextId && (nextId !== prevId || !host.hasBuffer(nextId))) {
      showActiveWindow();
    } else if (!nextId && prevId) {
      clearTerminal();
      currentRedraw?.();
    } else {
      currentRedraw?.();
    }
  }

  const unsubState = onServiceStateChange(() => {
    void refreshTargetsFromRuntime();
  });

  function onResize(): void {
    if (!currentRedraw) return;
    const id = host.getActiveId();
    if (id) host.invalidateBuffer(id);
    showActiveWindow();
  }

  process.stdout.on("resize", onResize);

  function currentTarget(): ServiceName | null {
    if (activeTargets.length === 0) return null;
    const fromWin = host.getActive()?.serviceName;
    if (fromWin && activeTargets.includes(fromWin)) {
      preferredTarget = fromWin;
      return fromWin;
    }
    if (preferredTarget && activeTargets.includes(preferredTarget)) return preferredTarget;
    preferredTarget = activeTargets[0]!;
    return preferredTarget;
  }

  function buildPrompt(): string {
    const tgt = currentTarget();
    return tgt ? paintSendPrompt(tgt) : plainPrompt();
  }

  while (true) {
    await refreshTargetsFromRuntime();
    const result = await readLine({
      getPrompt: buildPrompt,
      /* 无服务时默认加 /（与窗口系统前行为一致）；用 getter 以便进程退出后即时生效 */
      autoSlash: () => activeTargets.length === 0,
      getChrome: () => host.getChrome(),
      onWindowKey: (ev) => {
        const r = host.onKey(ev);
        if (r.action === "redraw") showActiveWindow();
        return r;
      },
      cycleSendTarget: () => {
        const name = host.cycleServiceWindows();
        if (!name) return false;
        preferredTarget = name;
        showActiveWindow();
        return true;
      },
      initial: pendingInput,
    });
    pendingInput = "";

    if (result.kind === "cancel") break;

    if (result.kind === "open-logs") {
      pendingInput = result.pending;
      openLogsWindow();
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
  unsubState();
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
      await playWelcomeAnimation();
      break;
    case "status":
      stdout.write((await cmdStatus()) + "\n");
      break;
    case "logs":
    case "log": {
      /* 无参叶命令：打开筛选窗 */
      if (openLogsWindowHook) {
        openLogsWindowHook();
        break;
      }
      stdout.write(c.yellow(t("repl.logsReplOnly") + "\n"));
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
    case "update":
      stdout.write((await cmdUpdate(args)) + "\n");
      break;
    case "locale":
    case "lang":
      stdout.write(cmdLocale(args) + "\n");
      break;
    case "debug":
      stdout.write((await cmdDebug(args)) + "\n");
      break;
    case "remote":
      stdout.write((await cmdRemote(args, { daemonAfterEnroll: false })) + "\n");
      break;
    case "init": {
      const wasRaw = stdin.isRaw ?? false;
      setRaw(false);
      try {
        const { runWizard } = await import("./wizard.js");
        await runWizard();
      } finally {
        setRaw(wasRaw);
      }
      break;
    }
    case "quit":
    case "exit":
    case "q":
      throw "QUIT";
    default: {
      const modShort = resolveModuleTopShorthand(cmd);
      if (modShort) {
        const g = gateModuleSub(modShort, REPL_MODE);
        if (g) {
          stdout.write(g + "\n");
          break;
        }
        stdout.write((await dispatchModuleCommand(modShort, args)) + "\n");
        break;
      }
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
}

