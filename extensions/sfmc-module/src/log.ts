/**
 * 扩展日志 — OutputChannel「SFMC 扩展」（LogOutputChannel）
 * Playground Webview 内系统频道仍独立；此处记扩展命令 / Watch / 宿主进程级信息。
 */

import * as vscode from "vscode";

let channel: vscode.LogOutputChannel | undefined;

function ensure(): vscode.LogOutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("SFMC 扩展", { log: true });
  }
  return channel;
}

export const ExtLog = {
  /** 注册到 extension.subscriptions */
  channel(): vscode.LogOutputChannel {
    return ensure();
  },

  show(preserveFocus = true): void {
    ensure().show(preserveFocus);
  },

  clear(): void {
    ensure().clear();
  },

  info(scope: string, message: string): void {
    ensure().info(`[${scope}] ${message}`);
  },

  warn(scope: string, message: string): void {
    ensure().warn(`[${scope}] ${message}`);
  },

  error(scope: string, message: string): void {
    ensure().error(`[${scope}] ${message}`);
  },

  debug(scope: string, message: string): void {
    ensure().debug(`[${scope}] ${message}`);
  },

  /** 多行原文（Watch / rebuild 输出） */
  raw(scope: string, text: string): void {
    const ch = ensure();
    for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
      if (line.length) ch.info(`[${scope}] ${line}`);
    }
  },
};
