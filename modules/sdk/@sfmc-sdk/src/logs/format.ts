/**
 * format.ts — 日志格式化纯函数
 *
 * 两种格式:
 *   - formatLogLine: 子进程 stdout / 文件落盘用,完整带 ISO 时间戳 + [source] + [LEVEL]
 *   - formatLog:     sfmc 主进程展示用,本地时间 + 对齐 source + 紧凑 level tag,text 原样
 */

import type { FormatOptions, LogEntry, LogLevel } from "./types.js";
import { ansi, visibleLen, wrap } from "./ansi.js";

/**
 * BDS 行首时间戳+级别（大小写不敏感：WARN / warn / Warning 均可）。
 * Bedrock 常见为 WARN（非 WARNING）；WARNING 一并兼容。
 * 权威源：本模块；sfmc 展示层应委托而非再抄一份正则。
 */
const BDS_LEVEL_TOKEN = "INFO|WARN(?:ING)?|ERROR|FATAL|DEBUG|VERBOSE|TRACE";
const BDS_TS_PREFIX_RE = new RegExp(
  `^\\[\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}(?:[.,:]\\d{1,3})?\\s+(${BDS_LEVEL_TOKEN})\\]\\s*`,
  "i"
);
/** 正文任意位置的 BDS 时间戳级别（防行首有杂讯时仍能提取）。 */
const BDS_TS_LEVEL_ANYWHERE_RE = new RegExp(
  `\\[\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}(?:[.,:]\\d{1,3})?\\s+(${BDS_LEVEL_TOKEN})\\]`,
  "i"
);

/**
 * 将 BDS 级别词字符串映射为平台标准的 LogLevel 枚举（大小写不敏感）。
 *
 * @param token BDS 输出中的日志级别词。
 * @returns 标准的 LogLevel 级别。
 */
export function mapBdsLevelToken(token: string): LogLevel {
  const u = String(token ?? "").toUpperCase();
  if (u === "ERROR" || u === "FATAL") return "error";
  if (u === "WARN" || u === "WARNING") return "warn";
  if (u === "DEBUG" || u === "TRACE" || u === "VERBOSE") return "debug";
  return "info";
}

/**
 * 去掉 BDS 自带的 `[时间 等级]` 前缀，使正文从真正的有效消息开始。
 * 具有幂等性：若已剥离过则原样返回。
 *
 * @param line 原始日志文本行。
 * @returns 剥离前缀后的日志正文。
 */
export function stripBdsLogPrefix(line: string): string {
  return String(line ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^\s+/, "")
    .replace(BDS_TS_PREFIX_RE, "");
}

/**
 * 从单行文本中提取 BDS 内嵌的日志级别（优先提取行首前缀，未命中时在全文中查找首次出现的标记）。
 * 例如：`[2026-07-25 18:42:27:626 warn] [Commands] ...` → `"warn"`。
 *
 * @param line 日志文本行。
 * @returns 提取到的级别枚举，未找到时返回 `null`。
 */
export function parseBdsEmbeddedLevel(line: string): LogLevel | null {
  const s = String(line ?? "");
  const head = BDS_TS_PREFIX_RE.exec(s.replace(/^\uFEFF/, "").replace(/^\s+/, ""));
  if (head?.[1]) return mapBdsLevelToken(head[1]);
  const any = BDS_TS_LEVEL_ANYWHERE_RE.exec(s);
  if (any?.[1]) return mapBdsLevelToken(any[1]);
  return null;
}

/**
 * 从原始文本行推断日志级别（BDS 时间戳前缀优先，未命中时按常见关键词推断）。
 *
 * @param text 待分析的日志文本。
 * @returns 推断出的日志级别。
 */
export function inferLevel(text: string): LogLevel {
  const embedded = parseBdsEmbeddedLevel(text);
  if (embedded) return embedded;

  const t = text.toUpperCase();
  if (t.includes("[FATAL]") || t.includes("[ERROR]") || t.includes("[X]")) return "error";
  if (t.includes("[WARN") || t.includes("[WARNING]") || t.includes("[!]")) return "warn";
  if (t.includes("[SUCCESS]") || t.includes("[OK]") || t.includes("[√]")) return "success";
  if (t.includes("[DEBUG]") || t.includes("[DBG]")) return "debug";
  return "info";
}

/**
 * 将 source 来源标识字段右侧填充空格至指定的终端可见宽度。
 *
 * @param s 原始来源标识字符串。
 * @param n 期望对齐的可见字符宽度（默认为 7）。
 * @returns 对齐填充后的字符串。
 */
export function padSource(s: string, n = 7): string {
  const v = visibleLen(s);
  return v >= n ? s : s + " ".repeat(n - v);
}

/**
 * 生成紧凑形式的级别标签字符串（例如 `[INF]`、`[WRN]`、`[ERR]`、`[OK]`、`[DBG]`）。
 *
 * @param lvl 日志级别。
 * @param color 是否应用 ANSI 颜色样式代码。
 * @returns 紧凑级别标签。
 */
export function levelTag(lvl: LogLevel, color = true): string {

  switch (lvl) {
    case "error":
      return color ? wrap("red", "[ERR]") : "[ERR]";
    case "warn":
      return color ? wrap("yellow", "[WRN]") : "[WRN]";
    case "success":
      return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
    case "debug":
      return color ? `${ansi.dim}[DBG]${ansi.reset}` : "[DBG]";
    default:
      return color ? wrap("blue", "[INF]") : "[INF]";
  }
}

/** 完整级别标签: [INFO] [WARN] [ERROR] [OK] [DEBUG] */
export function levelTagFull(lvl: LogLevel, color = true): string {
  switch (lvl) {
    case "error":
      return color ? wrap("red", "[ERROR]") : "[ERROR]";
    case "warn":
      return color ? wrap("yellow", "[WARN]") : "[WARN]";
    case "success":
      return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
    case "debug":
      return color ? `${ansi.dim}[DEBUG]${ansi.reset}` : "[DEBUG]";
    default:
      return color ? wrap("blue", "[INFO]") : "[INFO]";
  }
}

type HighlightRule = {
  re: RegExp;
  paint: (match: string) => string;
};

function paintHttpExchange(m: string): string {
  return m
    .replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/, (method) => wrap("magenta", method))
    .replace(/[1-5]\d{2}$/, (code) => {
      const n = Number(code);
      if (n >= 500) return wrap("red", code);
      if (n >= 400) return wrap("yellow", code);
      if (n >= 300) return wrap("cyan", code);
      return wrap("green", code);
    });
}

function paintHttpStatus(m: string): string {
  return m.replace(/[1-5]\d{2}$/i, (code) => {
    const n = Number(code);
    if (n >= 500) return wrap("red", code);
    if (n >= 400) return wrap("yellow", code);
    if (n >= 300) return wrap("cyan", code);
    return wrap("green", code);
  });
}

const LOG_HIGHLIGHT_RULES: HighlightRule[] = [
  { re: /\[FATAL\]/gi, paint: (m) => `${ansi.bold}${wrap("red", m)}` },
  { re: /\[ERROR\]|\[ERR\]|\[X\]/gi, paint: (m) => wrap("red", m) },
  { re: /\[WARN(?:ING)?\]|\[WRN\]|\[!\]/gi, paint: (m) => wrap("yellow", m) },
  { re: /\[SUCCESS\]|\[OK\]|\[√\]/gi, paint: (m) => `${ansi.bold}${wrap("green", m)}` },
  { re: /\[INFO\]|\[INF\]/gi, paint: (m) => wrap("blue", m) },
  { re: /\[DEBUG\]|\[DBG\]|\[TRACE\]/gi, paint: (m) => `${ansi.dim}${m}${ansi.reset}` },
  { re: /\[PLAYER\]/gi, paint: (m) => wrap("green", m) },
  { re: /\[TPS\]/gi, paint: (m) => wrap("cyan", m) },
  { re: /\[SFMC\]/gi, paint: (m) => wrap("magenta", m) },

  { re: /\b(FATAL|ERROR|ERR)\b(?=\s*:)/gi, paint: (m) => wrap("red", m) },
  { re: /\b(WARN(?:ING)?|WRN)\b(?=\s*:)/gi, paint: (m) => wrap("yellow", m) },
  { re: /\b(INFO|INF)\b(?=\s*:)/gi, paint: (m) => wrap("blue", m) },
  { re: /\b(DEBUG|DBG|TRACE)\b(?=\s*:)/gi, paint: (m) => `${ansi.dim}${m}${ansi.reset}` },

  {
    re: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,:]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
    paint: (m) => `${ansi.dim}${m}${ansi.reset}`,
  },
  { re: /\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\b/g, paint: (m) => `${ansi.dim}${m}${ansi.reset}` },

  { re: /\bhttps?:\/\/[^\s"'<>]+/gi, paint: (m) => wrap("blue", m) },
  { re: /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/g, paint: (m) => wrap("cyan", m) },
  { re: /\b(?:port|listening on|bound to)\s*[:=]?\s*\d{2,5}\b/gi, paint: (m) => wrap("cyan", m) },

  {
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    paint: (m) => wrap("magenta", m),
  },
  { re: /\bv\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/gi, paint: (m) => wrap("yellow", m) },
  { re: /\b(?:pid|PID)\s*[:=]?\s*\d+\b/g, paint: (m) => wrap("yellow", m) },

  {
    re: /(?:[A-Za-z]:\\|\/)(?:[^\s"'<>|*?]+[/\\])*[^\s"'<>|*?]+\.(?:json|js|mjs|cjs|ts|tsx|exe|dll|log|db|sqlite|zip|mcpack|mcaddon)\b/gi,
    paint: (m) => wrap("yellow", m),
  },

  { re: /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+[1-5]\d{2}\b/g, paint: paintHttpExchange },
  { re: /\b(?:status|HTTP\/\d(?:\.\d)?)\s*[:=]?\s*[1-5]\d{2}\b/gi, paint: paintHttpStatus },
  { re: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g, paint: (m) => wrap("magenta", m) },

  { re: /\bPlayer (?:connected|disconnected|joined|left)\b:?/gi, paint: (m) => wrap("green", m) },
  { re: /\bServer (?:started|stopped|starting|stopping)\b/gi, paint: (m) => wrap("green", m) },
  { re: /\b(?:listening|ready|healthy|online)\b/gi, paint: (m) => wrap("green", m) },
  { re: /\b(?:offline|disconnected)\b/gi, paint: (m) => wrap("yellow", m) },

  {
    re: /\b(TPS|MSPT|tick|chunks?|entities|dimension|spawn(?:ed)?|loaded|saved|autosave)\b/gi,
    paint: (m) => wrap("cyan", m),
  },

  {
    re: /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|Error|Exception|ECONNREFUSED|EADDRINUSE|ENOENT|ETIMEDOUT|ENOTFOUND)\b/g,
    paint: (m) => `${ansi.bold}${wrap("red", m)}`,
  },
  {
    re: /\b(?:failed|failure|fatal|crash(?:ed)?|timeout|rejected|abort(?:ed)?)\b/gi,
    paint: (m) => wrap("red", m),
  },
  { re: /\b(?:success(?:fully)?|done|passed|complete(?:d)?)\b/gi, paint: (m) => wrap("green", m) },

  {
    re: /\b(?:db-server|qq-bridge|bds-tools|llbot|bedrock[_-]?server|sfmc)\b/gi,
    paint: (m) => wrap("magenta", m),
  },
];

/**
 * 高亮文本中的关键系统词，并剥离 Minecraft 原生的 `§` 样式颜色代码。
 *
 * @param raw 原始文本字符串。
 * @param color 是否应用 ANSI 颜色进行高亮渲染（默认为 `true`）。
 * @returns 处理后的文本字符串。
 */
export function highlightText(raw: string, color = true): string {
  let s = raw.replace(/§[0-9a-fklmnor]/gi, "");
  if (!color) return s;

  const hits: Array<{ start: number; end: number; text: string; paint: (m: string) => string }> = [];
  for (const rule of LOG_HIGHLIGHT_RULES) {
    const flags = rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`;
    const re = new RegExp(rule.re.source, flags);
    for (const match of s.matchAll(re)) {
      const text = match[0];
      const start = match.index ?? 0;
      const end = start + text.length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ start, end, text, paint: rule.paint });
    }
  }

  hits.sort((a, b) => b.start - a.start);
  for (const hit of hits) {
    s = `${s.slice(0, hit.start)}${hit.paint(hit.text)}${s.slice(hit.end)}`;
  }
  return s;
}

/**
 * 格式化单行日志（供子进程 stdout 输出及持久化日志文件落盘）。
 * 输出格式：`<ISO时间> [source] [LEVEL] text`。
 *
 * @param entry 日志条目结构。
 * @param color 是否包含 ANSI 彩色样式代码（默认为 `true`）。
 * @returns 格式化后的单行日志文本。
 */
export function formatLogLine(entry: LogEntry, color = true): string {
  const ts = entry.time.toISOString().replace("T", " ").slice(0, 19);
  const tsStr = color ? `${ansi.dim}${ts}${ansi.reset}` : ts;
  const srcStr = color ? `${ansi.bold}${entry.source}${ansi.reset}` : entry.source;
  const lvlStr = levelTagFull(entry.level, color);
  return `${tsStr} [${srcStr}] ${lvlStr} ${highlightText(entry.text, color)}`;
}

/**
 * 格式化日志条目供控制台或 REPL 界面展示。
 * 输出格式：`<localTime> <paddedSource> <levelTag> <text>`。
 *
 * @param entry 日志条目结构。
 * @param opts 格式化选项（可指定是否开启彩色和来源列对齐宽度）。
 * @returns 用于终端显示的格式化字符串。
 */
export function formatLog(entry: LogEntry, opts: FormatOptions = {}): string {
  const color = opts.color ?? true;
  const padW = opts.padSourceWidth ?? 7;
  const ts = color
    ? `${ansi.dim}${entry.time.toLocaleTimeString()}${ansi.reset}`
    : entry.time.toLocaleTimeString();
  const src = color
    ? `${ansi.bold}${padSource(entry.source, padW)}${ansi.reset}`
    : padSource(entry.source, padW);
  const lvl = levelTag(entry.level, color);
  const txt = highlightText(entry.text, color);
  return `${ts} ${src} ${lvl} ${txt}`;
}

