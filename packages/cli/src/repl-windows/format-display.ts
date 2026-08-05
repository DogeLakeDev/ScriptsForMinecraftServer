/**
 * repl-windows/format-display.ts — 仅 TTY 展示；落盘仍用 logs.formatLog / SDK formatLogLine
 */
import { stripBdsLogPrefix } from "@sfmc-bds/sdk/logs";
import {
  formatSourceTag,
  resolveDisplayLevel,
  type UnifiedLog,
  visibleWidth,
} from "../logs.js";
import { c, highlightLogLine } from "../theme.js";

/** 与 logs.ts LEVEL_TAG_TEXT 对齐的无色级别（避免改动落盘路径） */
const LEVEL_PLAIN: Record<string, string> = {
  error: "[ERR]",
  warn: "[WRN]",
  success: "[SUC]",
  debug: "[DBG]",
  info: "[INF]",
};

function levelTagDisplay(lvl: string): string {
  const text = LEVEL_PLAIN[lvl] ?? LEVEL_PLAIN.info!;
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

function levelTagPlain(lvl: string): string {
  return LEVEL_PLAIN[lvl] ?? LEVEL_PLAIN.info!;
}

export type FormatDisplayOpts = {
  /** 服务窗内省略来源标签（落盘不受影响） */
  omitSource?: boolean;
};

/** TTY 展示格式化 */
export function formatLogDisplay(l: UnifiedLog, opts: FormatDisplayOpts = {}): string {
  const ts = c.dim(l.time.toLocaleTimeString());
  const level = resolveDisplayLevel(l);
  const lvl = levelTagDisplay(level);
  const txt = highlightLogLine(l.source === "bds" ? stripBdsLogPrefix(l.text) : l.text);
  if (opts.omitSource) {
    return `${ts} ${lvl} ${txt}`;
  }
  const src = formatSourceTag(l.source);
  return `${ts} ${src} ${lvl} ${txt}`;
}

/** 与 formatLogDisplay 对齐的悬挂缩进宽度 */
export function logDisplayPrefixWidth(l: UnifiedLog, opts: FormatDisplayOpts = {}): number {
  const ts = l.time.toLocaleTimeString();
  const level = resolveDisplayLevel(l);
  const lvl = levelTagPlain(level);
  if (opts.omitSource) {
    return visibleWidth(`${ts} ${lvl} `);
  }
  return visibleWidth(`${ts} ${formatSourceTag(l.source)} ${lvl} `);
}
