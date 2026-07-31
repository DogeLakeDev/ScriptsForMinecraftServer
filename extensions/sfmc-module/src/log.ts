/**
 * 扩展日志 — 经 @sfmc-bds/sdk/logs 写入 VS Code Output「SFMC 扩展」
 * 脚本沙箱 Webview 不再内嵌日志面板；断言缓冲仍在 Webview 静默保留。
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

let channel: vscode.OutputChannel | undefined;
const loggers = new Map<string, Logger>();

function ensureChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("SFMC 扩展");
  }
  return channel;
}

function sinkWrite(entry: LogEntry): void {
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

export const ExtLog = {
  channel(): vscode.OutputChannel {
    return ensureChannel();
  },

  show(preserveFocus = true): void {
    ensureChannel().show(preserveFocus);
  },

  clear(): void {
    ensureChannel().clear();
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
