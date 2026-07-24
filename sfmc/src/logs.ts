/**
 * logs.ts — sfmc 主进程统一日志聚合层
 *
 * 内部委托 @sfmc-bds/logs 共享包的 createMemoryBuffer + inferLevel,
 * 保持向后兼容的 pushLog / onLog / getAllLogs / getRecentLogs API
 * (services.ts 捕获子进程 stdout 后调用 pushLog 汇聚到此)。
 *
 * 落盘策略(与子进程自写文件分工,避免重复):
 *   - db / qq / update → 子进程已写 `.sfmc/logs/{db,qq,bds-update}.log`,此处跳过
 *   - bds / llbot → `.sfmc/logs/{bds,llbot}.log`(外部进程无自带 file sink)
 *   - 其余(system / pack / …) → `.sfmc/logs/sfmc.log`
 *
 * formatLog 保留 theme.ts (chalk) 配色,比共享包的纯 ANSI 版本视觉更丰富。
 */

import {
  createFileSink,
  createMemoryBuffer,
  formatLogLine,
  inferLevel as sharedInferLevel,
  type FileSink,
  type LogEntry,
  type LogLevel as SharedLogLevel,
} from "@sfmc-bds/sdk/logs";
import { logFile } from "@sfmc-bds/sdk/node/config";
import { c, highlightLogLine } from "./theme.js";
import { ROOT } from "./runtime.js";

export type LogLevel = SharedLogLevel;
export type LogSource = string;
export interface UnifiedLog extends LogEntry {}

const buffer = createMemoryBuffer(5000);

/** 子进程已用 createNodeServiceLogger 自行落盘的 source */
const CHILD_OWNED_SOURCES = new Set(["db", "qq", "update"]);

const fileSinks = new Map<string, FileSink>();

/** 解析本条日志应写入的文件名(不含 .log);null 表示跳过(子进程已写) */
function resolveDiskLogName(source: string): string | null {
  if (CHILD_OWNED_SOURCES.has(source)) return null;
  if (source === "bds" || source === "llbot") return source;
  return "sfmc";
}

function sinkFor(source: string): FileSink | null {
  const name = resolveDiskLogName(source);
  if (!name) return null;
  let sink = fileSinks.get(name);
  if (!sink) {
    sink = createFileSink(logFile(ROOT, name));
    fileSinks.set(name, sink);
  }
  return sink;
}

process.on("exit", () => {
  for (const sink of fileSinks.values()) sink.close();
});

/** 推送一条日志到内存缓冲,并按策略落盘 */
export function pushLog(text: string, source: LogSource, level: LogLevel): void {
  buffer.pushDirect(text, source, level);
  const sink = sinkFor(source);
  if (!sink) return;
  const entry: LogEntry = { time: new Date(), text, source, level };
  try {
    sink.write(entry, formatLogLine(entry, false));
  } catch {
    /* 落盘失败不阻断主流程 */
  }
}

/** 订阅新日志事件,返回取消订阅函数 */
export function onLog(fn: (log: UnifiedLog) => void): () => void {
  return buffer.subscribe(fn);
}

/** 获取全部日志 (按时间顺序) */
export function getAllLogs(): UnifiedLog[] {
  return buffer.getAll();
}

/** 获取最近 n 条,可按 level / source 过滤 */
export function getRecentLogs(n: number, levels: LogLevel[], sources: LogSource[]): UnifiedLog[] {
  return buffer.getRecent(n, levels, sources);
}

/** 从原始文本推断日志级别 (委托共享包) */
export function inferLevel(text: string): LogLevel {
  return sharedInferLevel(text);
}

/* ==================================================================
 *  来源标签元数据 (方括号与文字同色,对齐 levelTag)
 * ================================================================== */

export interface SourceMeta {
  value: string;
  /** 显示名,尽量 8 宽对齐 */
  name: string;
  paint: (s: string) => string;
}

export const SOURCE_META: SourceMeta[] = [
  { value: "bds", name: "BDServer", paint: (s) => c.green(s) },
  { value: "db", name: "DataBase", paint: (s) => c.blue(s) },
  { value: "qq", name: "QQBridge", paint: (s) => c.purple(s) },
  { value: "llbot", name: " LL-BOT ", paint: (s) => c.yellow(s) },
  { value: "system", name: " SYSTEM ", paint: (s) => c.cyan(s) },
  { value: "update", name: " UPDATE ", paint: (s) => c.orange(s) },
  { value: "pack", name: "  PACK  ", paint: (s) => c.purple(s) },
  { value: "bds-tools", name: "BDSTools", paint: (s) => c.red(s) },
];

/** 源标签无色文本（formatSourceTag / logPrefixWidth 共用） */
function sourceTagPlain(source: string): string {
  const meta = SOURCE_META.find((m) => m.value === source);
  if (meta) return `[${meta.name}]`;
  return `[${source.padEnd(7).slice(0, 8)}]`;
}

export function formatSourceTag(source: string): string {
  const meta = SOURCE_META.find((m) => m.value === source);
  const plain = sourceTagPlain(source);
  if (meta) return meta.paint(plain);
  return c.bold(plain);
}

/** 简化BDS日志 */
function stripLogPrefix(line: string): string {
  // 匹配格式: [2026-07-18 23:56:06:778 INFO]
  const prefixRegex = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3} (INFO|WARNING|ERROR|FATAL|DEBUG)\]\s*/;
  return line.replace(prefixRegex, "");
}

/**
 * 从一行 BDS 日志中提取日志等级
 * @param line 日志行字符串
 * @returns 日志等级（大写），若无法识别则返回 'UNKNOWN'
 */
function getLogLevel(line: string): string {
  const levelNames = ["INFO", "WARNING", "ERROR", "FATAL", "DEBUG", "TRACE", "WARN"];
  const levelPattern = levelNames.join("|");

  let match = line.match(new RegExp(`\\[(${levelPattern})\\]`, "i"));
  if (match && match[1]) return match[1].toUpperCase();

  match = line.match(new RegExp(`^\\[.*?\\]\\s*(${levelPattern})`, "i"));
  if (match && match[1]) return match[1].toUpperCase();

  match = line.match(new RegExp(`^(${levelPattern})\\s*:`, "i"));
  if (match && match[1]) return match[1].toUpperCase();

  match = line.match(new RegExp(`\\[.*?\\]\\s*(${levelPattern})\\s*:`, "i"));
  if (match && match[1]) return match[1].toUpperCase();

  return "UNKNOWN";
}

/** 展示用级别：BDS 行从正文解析，其余用 entry.level（DRY：formatLog / logPrefixWidth 共用） */
export function resolveDisplayLevel(l: UnifiedLog): LogLevel {
  if (l.source !== "bds") return l.level;
  const parsed = getLogLevel(l.text);
  if (parsed === "WARNING" || parsed === "WARN") return "warn";
  if (parsed === "ERROR" || parsed === "FATAL") return "error";
  if (parsed === "DEBUG" || parsed === "TRACE") return "debug";
  return "info";
}

/** 无色级别标签文本（可见宽度权威源） */
const LEVEL_TAG_TEXT: Record<LogLevel, string> = {
  error: "[ERR]",
  warn: "[WRN]",
  success: "[OK]",
  debug: "[DBG]",
  info: "[INF]",
};

function levelTagPlain(lvl: LogLevel): string {
  return LEVEL_TAG_TEXT[lvl] ?? LEVEL_TAG_TEXT.info;
}

function levelTag(lvl: LogLevel): string {
  const text = levelTagPlain(lvl);
  switch (lvl) {
    case "error":
      return c.red(text);
    case "warn":
      return c.yellow(text);
    case "success":
      return c.green(c.bold(text));
    case "debug":
      return c.dim(text);
    default:
      return c.blue(text);
  }
}

/** 格式化日志用于 REPL 展示 (用 theme.ts chalk 配色) */
export function formatLog(l: UnifiedLog): string {
  const ts = c.dim(l.time.toLocaleTimeString());
  const level = resolveDisplayLevel(l);
  const lvl = levelTag(level);
  const src = formatSourceTag(l.source);
  /* BDS：去掉自带时间戳前缀后再高亮正文 */
  const txt = highlightLogLine(l.source === "bds" ? stripLogPrefix(l.text) : l.text);
  return `${ts} ${src} ${lvl} ${txt}`;
}

/* ==================================================================
 *  软换行: 超终端宽度时换行,后续行缩进对齐
 * ================================================================== */

/** 单个字符在终端的显示宽度 (CJK 全角=2, 其余=1) */
function charWidth(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (
    cp >= 0x1100 &&
    (cp <= 0x115f ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x2fffd))
  )
    return 2;
  return 1;
}

/** 字符串在终端的可见宽度 (strip ANSI 后按 CJK 宽度累加) */
export function visibleWidth(s: string): number {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  let w = 0;
  for (const ch of stripped) w += charWidth(ch);
  return w;
}

/**
 * 日志前缀可见宽度(时间 + 源 + 级别 + 尾空格),供悬挂缩进对齐正文起点。
 * 与 formatLog 拼接顺序保持一致（共用 resolveDisplayLevel / sourceTagPlain / levelTagPlain）。
 */
export function logPrefixWidth(l: UnifiedLog): number {
  const ts = l.time.toLocaleTimeString();
  const src = sourceTagPlain(l.source);
  const level = resolveDisplayLevel(l);
  return visibleWidth(`${ts} ${src} ${levelTagPlain(level)} `);
}

/**
 * 按终端可见宽度换行;显式 \\n 与软换行的后续行一律左侧缩进 indent 列。
 * 保留 ANSI:换行时 reset,新行恢复当前颜色状态(可多层叠加)。
 * 宽字符(CJK)按 2 列;cols 预留 1 列,避免 Windows Terminal 边界再软折到第 0 列。
 */
export function wrapLogLine(s: string, indent: number): string {
  const rawCols = process.stdout.columns || 80;
  /* 至少留给正文若干列,避免 indent >= cols 时死循环 */
  const cols = Math.max(rawCols - 1, indent + 4);
  const segments = s.split(/\r?\n/);
  const out: string[] = [];
  for (let si = 0; si < segments.length; si++) {
    const raw = segments[si]!;
    /* 显式换行段去掉文案自带的左空格,统一由 hang indent 对齐正文 */
    const piece = si === 0 ? raw : raw.replace(/^[ \t]+/, "");
    out.push(wrapSegment(piece, cols, si === 0 ? 0 : indent, indent));
  }
  return out.join("\n");
}

/** 单段(无内嵌 \\n)软换行;startPad>0 表示本段开头已占用的列(显式换行后的悬挂) */
function wrapSegment(s: string, cols: number, startPad: number, hangIndent: number): string {
  if (s.length === 0) return startPad > 0 ? " ".repeat(startPad) : "";

  const lines: string[] = [];
  let cur = startPad > 0 ? " ".repeat(startPad) : "";
  let w = startPad;
  /** 当前生效的 ANSI 开码栈(不含 reset),换行后重放 */
  const ansiStack: string[] = [];

  const resetIfNeeded = (): void => {
    if (ansiStack.length) cur += "\x1b[0m";
  };
  const replayAnsi = (): void => {
    for (const code of ansiStack) cur += code;
  };

  let i = 0;
  while (i < s.length) {
    const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
    if (m) {
      const code = m[0]!;
      cur += code;
      if (code === "\x1b[0m") ansiStack.length = 0;
      else ansiStack.push(code);
      i += code.length;
      continue;
    }

    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const cw = charWidth(ch);
    const advance = ch.length;

    /* w > startPad:当前行除左垫外已有内容,可以拆行;否则强制塞入避免死循环 */
    if (w + cw > cols && w > startPad) {
      resetIfNeeded();
      lines.push(cur);
      cur = " ".repeat(hangIndent);
      replayAnsi();
      w = hangIndent;
      startPad = hangIndent;
    }

    cur += ch;
    w += cw;
    i += advance;
  }

  if (ansiStack.length) cur += "\x1b[0m";
  lines.push(cur);
  return lines.join("\n");
}

