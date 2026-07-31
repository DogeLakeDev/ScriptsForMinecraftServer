/**
 * 扩展日志 — 经 @sfmc-bds/sdk/logs 写入 VS Code Output「SFMC 扩展」
 * 脚本沙箱 Webview 不再内嵌日志面板；断言缓冲仍在 Webview 静默保留。
 * 支持 level 下限与 scope 过滤（仅影响新写入；历史需「清除并应用过滤」）。
 */

import * as vscode from "vscode";
import {
  createCallbackSink,
  createLogger,
  formatLog,
  stripAnsi,
  type LogEntry,
  type LogLevel,
  type Logger,
} from "@sfmc-bds/sdk/logs";

const FILTER_STATE_KEY = "sfmc.extLog.filter";

/** 级别序：debug < info/success < warn < error */
export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
};

export type ExtLogFilter = {
  /** 最低级别（含）；默认 debug=全显 */
  minLevel: LogLevel;
  /**
   * scope 白名单（对应 logger source）。
   * 空=全部；否则 source 等于或包含任一项（不区分大小写）。
   */
  scopes: string[];
};

const DEFAULT_FILTER: ExtLogFilter = { minLevel: "debug", scopes: [] };

let channel: vscode.OutputChannel | undefined;
const loggers = new Map<string, Logger>();
let filter: ExtLogFilter = { ...DEFAULT_FILTER, scopes: [] };
let filterContext: vscode.ExtensionContext | undefined;

function ensureChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("SFMC 扩展");
  }
  return channel;
}

export function normalizeExtLogFilter(raw: unknown): ExtLogFilter {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { minLevel: "debug", scopes: [] };
  }
  const o = raw as Record<string, unknown>;
  const minLevel =
    o.minLevel === "debug" ||
    o.minLevel === "info" ||
    o.minLevel === "warn" ||
    o.minLevel === "error" ||
    o.minLevel === "success"
      ? o.minLevel === "success"
        ? "info"
        : o.minLevel
      : "debug";
  const scopes = Array.isArray(o.scopes)
    ? o.scopes.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
    : [];
  return { minLevel, scopes };
}

export function passesExtLogFilter(entry: LogEntry, f: ExtLogFilter = filter): boolean {
  if (LOG_LEVEL_RANK[entry.level] < LOG_LEVEL_RANK[f.minLevel]) return false;
  if (f.scopes.length === 0) return true;
  const src = entry.source.toLowerCase();
  return f.scopes.some((s) => {
    const needle = s.toLowerCase();
    return src === needle || src.includes(needle);
  });
}

function sinkWrite(entry: LogEntry): void {
  if (!passesExtLogFilter(entry)) return;
  const line = stripAnsi(formatLog(entry, { color: false, padSourceWidth: 10 }));
  ensureChannel().appendLine(line);
}

function logger(source: string): Logger {
  let lg = loggers.get(source);
  if (!lg) {
    lg = createLogger({
      source,
      color: false,
      sinks: [createCallbackSink(sinkWrite)],
    });
    loggers.set(source, lg);
  }
  return lg;
}

function describeFilter(f: ExtLogFilter): string {
  const scope =
    f.scopes.length === 0 ? "全部 scope" : `scope∈[${f.scopes.join(", ")}]`;
  return `级别≥${f.minLevel} · ${scope}`;
}

export const ExtLog = {
  channel(): vscode.OutputChannel {
    return ensureChannel();
  },

  /** 从 workspaceState 恢复过滤（activate 时调用） */
  init(context: vscode.ExtensionContext): void {
    filterContext = context;
    filter = normalizeExtLogFilter(context.workspaceState.get(FILTER_STATE_KEY));
  },

  getFilter(): ExtLogFilter {
    return { minLevel: filter.minLevel, scopes: [...filter.scopes] };
  },

  describeFilter(): string {
    return describeFilter(filter);
  },

  async setFilter(next: ExtLogFilter): Promise<void> {
    filter = normalizeExtLogFilter(next);
    if (filterContext) {
      await filterContext.workspaceState.update(FILTER_STATE_KEY, filter);
    }
  },

  show(preserveFocus = true): void {
    ensureChannel().show(preserveFocus);
  },

  clear(): void {
    ensureChannel().clear();
  },

  /** 清空 Output 并写入当前过滤说明（历史无法按过滤回放） */
  clearAndAnnounceFilter(): void {
    ensureChannel().clear();
    const note = `仅显示新写入：${describeFilter(filter)}（Output 无法过滤历史，已清除）`;
    // 绕过过滤，保证说明行可见
    ensureChannel().appendLine(stripAnsi(formatLog(
      { time: new Date(), source: "filter", level: "info", text: note },
      { color: false, padSourceWidth: 10 }
    )));
  },

  info(scope: string, message: string): void {
    logger(scope).info(message);
  },

  warn(scope: string, message: string): void {
    logger(scope).warn(message);
  },

  error(scope: string, message: string): void {
    logger(scope).error(message);
  },

  debug(scope: string, message: string): void {
    logger(scope).debug(message);
  },

  success(scope: string, message: string): void {
    logger(scope).success(message);
  },

  raw(scope: string, text: string): void {
    const lg = logger(scope);
    for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
      if (line.length) lg.info(line);
    }
  },

  write(scope: string, message: string, level: LogLevel = "info"): void {
    logger(scope).log(message, level);
  },
};
