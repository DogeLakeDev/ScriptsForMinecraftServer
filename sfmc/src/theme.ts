import chalk from "chalk";

export const T = {
  bg: "#282c34",
  panel: "#21252b",
  surface: "#2c313c",
  surfaceHi: "#3e4452",
  subtle: "#4b5263",
  text: "#dcdfe4",
  muted: "#888888",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  cyan: "#56b6c2",
  purple: "#c678dd",
  orange: "#d19a66",
} as const;

export const c = {
  dim: chalk.hex(T.muted),
  text: chalk.hex(T.text),
  green: chalk.hex(T.green),
  red: chalk.hex(T.red),
  yellow: chalk.hex(T.yellow),
  blue: chalk.hex(T.blue),
  cyan: chalk.hex(T.cyan),
  purple: chalk.hex(T.purple),
  orange: chalk.hex(T.orange),
  bold: chalk.bold,
};

export const W = 58;

type HighlightRule = {
  re: RegExp;
  paint: (match: string) => string;
};

function paintHttpExchange(m: string): string {
  return m
    .replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/, (method) => c.purple(method))
    .replace(/[1-5]\d{2}$/, (code) => {
      const n = Number(code);
      if (n >= 500) return c.red(code);
      if (n >= 400) return c.yellow(code);
      if (n >= 300) return c.cyan(code);
      return c.green(code);
    });
}

function paintHttpStatus(m: string): string {
  return m.replace(/[1-5]\d{2}$/i, (code) => {
    const n = Number(code);
    if (n >= 500) return c.red(code);
    if (n >= 400) return c.yellow(code);
    if (n >= 300) return c.cyan(code);
    return c.green(code);
  });
}

/** 规则按优先级排列;重叠区间只保留先匹配到的。 */
const LOG_HIGHLIGHT_RULES: HighlightRule[] = [
  { re: /\[FATAL\]/gi, paint: (m) => c.red(c.bold(m)) },
  { re: /\[ERROR\]|\[ERR\]|\[X\]/gi, paint: (m) => c.red(m) },
  { re: /\[WARN(?:ING)?\]|\[WRN\]|\[!\]/gi, paint: (m) => c.yellow(m) },
  { re: /\[SUCCESS\]|\[OK\]|\[√\]/gi, paint: (m) => c.green(c.bold(m)) },
  { re: /\[INFO\]|\[INF\]/gi, paint: (m) => c.blue(m) },
  { re: /\[DEBUG\]|\[DBG\]|\[TRACE\]/gi, paint: (m) => c.dim(m) },
  { re: /\[PLAYER\]/gi, paint: (m) => c.green(m) },
  { re: /\[TPS\]/gi, paint: (m) => c.cyan(m) },
  { re: /\[SFMC\]/gi, paint: (m) => c.purple(m) },

  { re: /\b(FATAL|ERROR|ERR)\b(?=\s*:)/gi, paint: (m) => c.red(m) },
  { re: /\b(WARN(?:ING)?|WRN)\b(?=\s*:)/gi, paint: (m) => c.yellow(m) },
  { re: /\b(INFO|INF)\b(?=\s*:)/gi, paint: (m) => c.blue(m) },
  { re: /\b(DEBUG|DBG|TRACE)\b(?=\s*:)/gi, paint: (m) => c.dim(m) },

  {
    re: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,:]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
    paint: (m) => c.dim(m),
  },
  { re: /\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\b/g, paint: (m) => c.dim(m) },

  { re: /\bhttps?:\/\/[^\s"'<>]+/gi, paint: (m) => c.blue(m) },
  { re: /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/g, paint: (m) => c.cyan(m) },
  { re: /\b(?:port|listening on|bound to)\s*[:=]?\s*\d{2,5}\b/gi, paint: (m) => c.cyan(m) },

  {
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    paint: (m) => c.purple(m),
  },
  { re: /\bv\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/gi, paint: (m) => c.orange(m) },
  { re: /\b(?:pid|PID)\s*[:=]?\s*\d+\b/g, paint: (m) => c.orange(m) },

  {
    re: /(?:[A-Za-z]:\\|\/)(?:[^\s"'<>|*?]+[/\\])*[^\s"'<>|*?]+\.(?:json|js|mjs|cjs|ts|tsx|exe|dll|log|db|sqlite|zip|mcpack|mcaddon)\b/gi,
    paint: (m) => c.orange(m),
  },

  { re: /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+[1-5]\d{2}\b/g, paint: paintHttpExchange },
  { re: /\b(?:status|HTTP\/\d(?:\.\d)?)\s*[:=]?\s*[1-5]\d{2}\b/gi, paint: paintHttpStatus },
  { re: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g, paint: (m) => c.purple(m) },

  { re: /\bPlayer (?:connected|disconnected|joined|left)\b:?/gi, paint: (m) => c.green(m) },
  { re: /\bServer (?:started|stopped|starting|stopping)\b/gi, paint: (m) => c.green(m) },
  { re: /\b(?:listening|ready|healthy|online)\b/gi, paint: (m) => c.green(m) },
  { re: /\b(?:offline|disconnected)\b/gi, paint: (m) => c.yellow(m) },

  {
    re: /\b(TPS|MSPT|tick|chunks?|entities|dimension|spawn(?:ed)?|loaded|saved|autosave)\b/gi,
    paint: (m) => c.cyan(m),
  },

  {
    re: /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|Error|Exception|ECONNREFUSED|EADDRINUSE|ENOENT|ETIMEDOUT|ENOTFOUND)\b/g,
    paint: (m) => c.red(c.bold(m)),
  },
  {
    re: /\b(?:failed|failure|fatal|crash(?:ed)?|timeout|rejected|abort(?:ed)?)\b/gi,
    paint: (m) => c.red(m),
  },
  { re: /\b(?:success(?:fully)?|done|passed|complete(?:d)?)\b/gi, paint: (m) => c.green(m) },

  {
    re: /\b(?:db-server|qq-bridge|bds-tools|llbot|bedrock[_-]?server|sfmc)\b/gi,
    paint: (m) => c.purple(m),
  },
];

/**
 * 高亮日志正文。
 * 在原文上收集匹配(先到先得、跳过重叠),再从后往前着色,避免 ANSI 二次污染。
 */
export function highlightLogLine(raw: string): string {
  let s = raw.replace(/§[0-9a-fklmnor]/gi, "");
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

function visibleLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export const DIVIDER = c.dim("─".repeat(W - 2));

export function padRight(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - visibleLen(s)));
}
