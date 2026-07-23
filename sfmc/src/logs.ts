/**
 * logs.ts — sfmc 主进程统一日志聚合层
 *
 * 内部委托 @sfmc-bds/logs 共享包的 createMemoryBuffer + inferLevel,
 * 保持向后兼容的 pushLog / onLog / getAllLogs / getRecentLogs API
 * (services.ts 捕获子进程 stdout 后调用 pushLog 汇聚到此)。
 *
 * formatLog 保留 theme.ts (chalk) 配色,比共享包的纯 ANSI 版本视觉更丰富。
 */

import {
  createMemoryBuffer,
  inferLevel as sharedInferLevel,
  type LogEntry,
  type LogLevel as SharedLogLevel,
} from "@sfmc-bds/sdk/logs";
import { c, highlightLogLine } from "./theme.js";

export type LogLevel = SharedLogLevel;
export type LogSource = string;
export interface UnifiedLog extends LogEntry {}

const buffer = createMemoryBuffer(5000);

/** 推送一条日志到内存缓冲 (services.ts 捕获子进程 stdout 后调用) */
export function pushLog(text: string, source: LogSource, level: LogLevel): void {
  buffer.pushDirect(text, source, level);
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

/** `[BDServer]` 整段染色(含方括号),与 `[INF]`/`[ERR]` 风格一致 */
export function formatSourceTag(source: string): string {
  const meta = SOURCE_META.find((m) => m.value === source);
  if (meta) return meta.paint(`[${meta.name}]`);
  return c.bold(`[${source.padEnd(7).slice(0, 8)}]`);
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

/** 格式化日志用于 REPL 展示 (用 theme.ts chalk 配色) */
export function formatLog(l: UnifiedLog): string {
  const ts = c.dim(l.time.toLocaleTimeString());
  let lvl = levelTag(l.level);
  let txt = highlightLogLine(l.text);
  const src = formatSourceTag(l.source);
  if (l.source === "bds") {
    const parsed = getLogLevel(l.text);
    const mapped: LogLevel =
      parsed === "WARNING" || parsed === "WARN"
        ? "warn"
        : parsed === "ERROR" || parsed === "FATAL"
          ? "error"
          : parsed === "DEBUG" || parsed === "TRACE"
            ? "debug"
            : "info";
    /* 去掉 BDS 自带时间戳前缀后再高亮正文 */
    txt = highlightLogLine(stripLogPrefix(l.text));
    lvl = levelTag(mapped);
  }
  return `${ts} ${src} ${lvl} ${txt}`;
}

function levelTag(lvl: LogLevel): string {
  switch (lvl) {
    case "error":
      return c.red("[ERR]");
    case "warn":
      return c.yellow("[WRN]");
    case "success":
      return c.green(c.bold("[OK]"));
    case "debug":
      return c.dim("[DBG]");
    default:
      return c.blue("[INF]");
  }
}

/* ==================================================================
 *  软换行: 超终端宽度时换行,后续行缩进对齐
 * ================================================================== */

/** 单个字符在终端的显示宽度 (CJK 全角=2, 其余=1) */
function charWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  if (
    c >= 0x1100 &&
    (c <= 0x115f ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x20000 && c <= 0x2fffd))
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
 * 按终端可见宽度换行,后续行左侧缩进 indent 个空格。
 * 保留 ANSI 颜色码:换行时先 reset 避免缩进空格带色,新行恢复颜色状态。
 * 宽字符(CJK)按 2 列计算,避免中文行换行位置偏后。
 */
export function wrapLogLine(s: string, indent: number): string {
  const cols = process.stdout.columns || 80;
  if (visibleWidth(s) <= cols) return s;
  const lines: string[] = [];
  let cur = "";
  let w = 0;
  let limit = cols;
  let activeAnsi = "";
  let i = 0;
  while (i < s.length) {
    const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
    if (m) {
      const code = m[0];
      cur += code;
      if (code === "\x1b[0m") activeAnsi = "";
      else activeAnsi = code;
      i += code.length;
    } else {
      const ch = s[i]!;
      const cw = charWidth(ch);
      if (w + cw > limit) {
        if (activeAnsi) cur += "\x1b[0m";
        lines.push(cur);
        cur = " ".repeat(indent);
        if (activeAnsi) cur += activeAnsi;
        w = 0;
        limit = cols - indent;
      }
      cur += ch;
      w += cw;
      i++;
    }
  }
  if (activeAnsi) cur += "\x1b[0m";
  lines.push(cur);
  return lines.join("\n");
}

