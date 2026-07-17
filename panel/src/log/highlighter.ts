/**
 * log/highlighter.ts — 日志分词着色器
 */

import { T, type Level, LEVEL_COLOR, LEVEL_PREFIX } from "../theme.js";

export type Token = { text: string; color: string; bold?: boolean };

type Rule = { re: RegExp; color: string; bold?: boolean };

const RULES: Rule[] = [
  { re: /\b(ERROR|FAIL|FATAL|panic|Traceback|失败|错误|异常)\b/g, color: T.red, bold: true },
  { re: /\b(WARN|WARNING|警告)\b/gi, color: T.yellow },
  { re: /\b(OK|SUCCESS|成功|started|listening|READY|connected)\b/gi, color: T.green },
  { re: /\b[A-Z][a-z]+(?:Error|Exception)\b/g, color: T.red },
  { re: /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, color: T.orange },
  { re: /(?:^|\s)(\d{2,5})(?=\s|$)/g, color: T.orange },
  { re: /\bqq_\d+\b/g, color: T.purple },
  { re: /"([^"\n]{1,32})"/g, color: T.purple },
  { re: /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]*)/g, color: T.blue },
  { re: /\/api\/[a-zA-Z0-9/_-]+/g, color: T.cyan },
  { re: /https?:\/\/[^\s)]+/g, color: T.cyan },
  { re: /\b[a-zA-Z]:\\(?:[\w .\\-]+\\)*[\w .-]+\.[a-zA-Z0-9]{1,5}\b/g, color: T.cyan },
];

export function tokenize(line: string, level: Level = "info"): Token[] {
  const prefix = LEVEL_PREFIX[level];
  const prefixColor = LEVEL_COLOR[level];
  const body = line.startsWith(prefix) ? line.slice(prefix.length).replace(/^\s+/, "") : line;

  const tokens: Token[] = [{ text: `${prefix} `, color: prefixColor, bold: true }];

  const ranges: Array<[number, number, Rule]> = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(body))) {
      let start = m.index;
      let length = m[0].length;
      if (m[1] && m[1].length > 0 && m[1].length < m[0].length) {
        // 有捕获组（如 "xxx" 引号内的内容，HTTP 方法后的路径）：高亮子串
        const innerIdx = m[0].indexOf(m[1]);
        if (innerIdx >= 0) {
          start = m.index + innerIdx;
          length = m[1].length;
        }
      }
      ranges.push([start, start + length, rule]);
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number, Rule]> = [];
  for (const r of ranges) {
    const top = merged[merged.length - 1];
    if (top && r[0] <= top[1]) {
      top[1] = Math.max(top[1], r[1]);
    } else {
      merged.push(r);
    }
  }

  let cursor = 0;
  for (const [s, e, rule] of merged) {
    if (s > cursor) {
      tokens.push({ text: body.slice(cursor, s), color: T.text });
    }
    const token: Token = { text: body.slice(s, e), color: rule.color };
    if (rule.bold) token.bold = true;
    tokens.push(token);
    cursor = e;
  }
  if (cursor < body.length) {
    tokens.push({ text: body.slice(cursor), color: T.text });
  }
  return tokens;
}

export function truncate(s: string, width: number): string {
  if (width <= 0) return "";
  let used = 0;
  let out = "";
  for (const ch of s) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (used + w > width) {
      out += "…";
      break;
    }
    used += w;
    out += ch;
  }
  return out;
}
