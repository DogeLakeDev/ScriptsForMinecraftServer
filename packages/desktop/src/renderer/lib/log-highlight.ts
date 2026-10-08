/**
 * log-highlight.ts — 把日志正文拆成和 REPL 一样的关键词着色片段。
 *
 * 使用场景：桌面端日志控制台渲染每一行正文。规则与 packages/cli/src/theme.ts
 * 的 highlightLogLine 保持同一顺序、同一正则；这里只给出色相，不输出 ANSI。
 * 重叠区间只保留先匹配到的那段。
 */

/** 与 REPL 调色板对应的色相：红/绿/黄/蓝/青/紫/橙，以及弱化 */
export type LogTone = "red" | "green" | "yellow" | "blue" | "cyan" | "purple" | "orange" | "dim";

/** 正文里的一段。没有 tone 时保持所在行的默认字色。 */
export interface LogSpan {
  text: string;
  tone?: LogTone;
  /** 对应 REPL 里的粗体，例如 [FATAL]、异常类名 */
  bold?: boolean;
}

interface HighlightRule {
  re: RegExp;
  tone?: LogTone;
  bold?: boolean;
  /** 一段匹配内部还要再分色时使用，片段拼起来必须等于原文 */
  paint?: (match: string) => LogSpan[];
}

function statusTone(code: string): LogTone {
  const status = Number(code);
  if (status >= 500) return "red";
  if (status >= 400) return "yellow";
  if (status >= 300) return "cyan";
  return "green";
}

/**
 * 同一段里给方法、状态码分色，中间的路径或 “status:” 保持原色。
 * 使用场景：REPL 里 paintHttpExchange / paintHttpStatus 的桌面端对应实现。
 */
function paintHttp(match: string): LogSpan[] {
  const method = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.exec(match);
  const code = /[1-5]\d{2}$/i.exec(match);
  const spans: LogSpan[] = [];
  let cursor = 0;
  if (method && method.index === 0) {
    spans.push({ text: method[0], tone: "purple" });
    cursor = method[0].length;
  }
  const codeStart = code ? match.length - code[0].length : match.length;
  if (codeStart > cursor) spans.push({ text: match.slice(cursor, codeStart) });
  if (code && codeStart >= cursor) spans.push({ text: code[0], tone: statusTone(code[0]) });
  return spans.length ? spans : [{ text: match }];
}

/** 规则按优先级排列；与 REPL 的 LOG_HIGHLIGHT_RULES 一一对应。 */
const LOG_HIGHLIGHT_RULES: HighlightRule[] = [
  { re: /\[FATAL\]/gi, tone: "red", bold: true },
  { re: /\[ERROR\]|\[ERR\]|\[X\]/gi, tone: "red" },
  { re: /\[WARN(?:ING)?\]|\[WRN\]|\[!\]/gi, tone: "yellow" },
  { re: /\[SUCCESS\]|\[SUC\]|\[OK\]|\[√\]/gi, tone: "green", bold: true },
  { re: /\[INFO\]|\[INF\]/gi, tone: "blue" },
  { re: /\[DEBUG\]|\[DBG\]|\[TRACE\]/gi, tone: "dim" },
  { re: /\[PLAYER\]/gi, tone: "green" },
  { re: /\[TPS\]/gi, tone: "cyan" },
  { re: /\[SFMC\]/gi, tone: "purple" },

  { re: /\b(FATAL|ERROR|ERR)\b(?=\s*:)/gi, tone: "red" },
  { re: /\b(WARN(?:ING)?|WRN)\b(?=\s*:)/gi, tone: "yellow" },
  { re: /\b(INFO|INF)\b(?=\s*:)/gi, tone: "blue" },
  { re: /\b(DEBUG|DBG|TRACE)\b(?=\s*:)/gi, tone: "dim" },

  { re: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,:]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, tone: "dim" },
  { re: /\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\b/g, tone: "dim" },

  { re: /\bhttps?:\/\/[^\s"'<>]+/gi, tone: "blue" },
  { re: /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/g, tone: "cyan" },
  { re: /\b(?:port|listening on|bound to)\s*[:=]?\s*\d{2,5}\b/gi, tone: "cyan" },

  { re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, tone: "purple" },
  { re: /\bv\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/gi, tone: "orange" },
  { re: /\b(?:pid|PID)\s*[:=]?\s*\d+\b/g, tone: "orange" },

  { re: /(?:[A-Za-z]:\\|\/)(?:[^\s"'<>|*?]+[/\\])*[^\s"'<>|*?]+\.(?:json|js|mjs|cjs|ts|tsx|exe|dll|log|db|sqlite|zip|mcpack|mcaddon)\b/gi, tone: "orange" },

  { re: /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+[1-5]\d{2}\b/g, paint: paintHttp },
  { re: /\b(?:status|HTTP\/\d(?:\.\d)?)\s*[:=]?\s*[1-5]\d{2}\b/gi, paint: paintHttp },
  { re: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g, tone: "purple" },

  { re: /\bPlayer (?:connected|disconnected|joined|left)\b:?/gi, tone: "green" },
  { re: /\bServer (?:started|stopped|starting|stopping)\b/gi, tone: "green" },
  { re: /\b(?:listening|ready|healthy|online)\b/gi, tone: "green" },
  { re: /\b(?:offline|disconnected)\b/gi, tone: "yellow" },

  { re: /\b(TPS|MSPT|tick|chunks?|entities|dimension|spawn(?:ed)?|loaded|saved|autosave)\b/gi, tone: "cyan" },

  { re: /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|Error|Exception|ECONNREFUSED|EADDRINUSE|ENOENT|ETIMEDOUT|ENOTFOUND)\b/g, tone: "red", bold: true },
  { re: /\b(?:failed|failure|fatal|crash(?:ed)?|timeout|rejected|abort(?:ed)?)\b/gi, tone: "red" },
  { re: /\b(?:success(?:fully)?|done|passed|complete(?:d)?)\b/gi, tone: "green" },

  { re: /\b(?:db-server|qq-bridge|bds-tools|llbot|bedrock[_-]?server|sfmc)\b/gi, tone: "purple" },
];

/** 控制台最多缓存约 5000 条，按原文复用拆分结果，避免实时日志每次整表重算。 */
const spanCache = new Map<string, LogSpan[]>();
const SPAN_CACHE_LIMIT = 5000;

function spansFor(rule: HighlightRule, text: string): LogSpan[] {
  if (rule.paint) return rule.paint(text);
  return [{ text, ...(rule.tone ? { tone: rule.tone } : {}), ...(rule.bold ? { bold: true } : {}) }];
}

/**
 * 去掉 Minecraft 的 § 颜色码，再按 REPL 规则拆开。
 * 使用场景：日志控制台渲染一行正文。
 */
export function highlightLogSpans(raw: string): LogSpan[] {
  const cached = spanCache.get(raw);
  if (cached) return cached;
  const text = raw.replace(/§[0-9a-fklmnor]/gi, "");
  const hits: Array<{ start: number; end: number; spans: LogSpan[] }> = [];
  for (const rule of LOG_HIGHLIGHT_RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      const matched = match[0];
      const start = match.index ?? 0;
      const end = start + matched.length;
      if (!matched || hits.some((hit) => start < hit.end && end > hit.start)) continue;
      hits.push({ start, end, spans: spansFor(rule, matched) });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const spans: LogSpan[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) spans.push({ text: text.slice(cursor, hit.start) });
    spans.push(...hit.spans);
    cursor = hit.end;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor) });
  if (!spans.length) spans.push({ text });
  if (spanCache.size >= SPAN_CACHE_LIMIT) spanCache.clear();
  spanCache.set(raw, spans);
  return spans;
}
