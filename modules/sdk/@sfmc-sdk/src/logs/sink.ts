/**
 * sink.ts — 日志输出目标实现
 *
 * StdoutSink: 输出到 stdout (可选颜色,可选 stderr 路由 error)
 * FileSink:   同步追加写入文件 (纯文本,无 ANSI 码;进程退出无需 flush)
 */

import fs from "node:fs";
import path from "node:path";
import type { LogEntry, Sink } from "./types.js";
import { formatLogLine } from "./format.js";
import { supportsColor } from "./ansi.js";
import { pauseAllProgress, resumeAllProgress } from "./terminal-progress.js";

export interface StdoutSinkOptions {
  /** 是否带 ANSI 颜色 (默认: 自动检测 stdout TTY) */
  color?: boolean;
  /** error 级别是否路由到 stderr (默认 true) */
  stderrForError?: boolean;
  /**
   * 只输出纯 text,不加时间戳/source/level 前缀。
   * 用于子进程 stdout 被 sfmc 主进程捕获的场景 (避免与 sfmc formatLog 的前缀重复)。
   * 注意:此时级别信息只能通过 stderrForError (error 走 stderr) 传递给 sfmc。
   */
  bare?: boolean;
}

export function createStdoutSink(opts: StdoutSinkOptions = {}): Sink {
  const color = opts.color ?? supportsColor(process.stdout);
  const stderrForError = opts.stderrForError ?? true;
  const bare = opts.bare ?? false;
  return {
    write(entry: LogEntry, _formatted: string): void {
      const line = bare ? entry.text : formatLogLine(entry, color);
      pauseAllProgress();
      try {
        if (stderrForError && entry.level === "error") {
          process.stderr.write(line + "\n");
        } else {
          process.stdout.write(line + "\n");
        }
      } finally {
        resumeAllProgress();
      }
    },
  };
}

export interface FileSinkOptions {
  /** 是否自动创建父目录 (默认 true) */
  mkdir?: boolean;
}

export interface FileSink extends Sink {
  /**
   * 兼容钩子：当前实现为 sync appendFile，无持有 FD，调用为空操作。
   * 保留以便 NodeServiceLogger / 进程 exit 统一调用而不破坏 LSP。
   */
  close(): void;
}

export function createFileSink(filePath: string, opts: FileSinkOptions = {}): FileSink {
  const mkdir = opts.mkdir ?? true;
  let ready = false;

  function ensureReady(): void {
    if (ready) return;
    if (mkdir) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    ready = true;
  }

  return {
    write(entry: LogEntry, _formatted: string): void {
      // 文件始终纯文本无 ANSI;同步追加,避免 exit 钩子丢缓冲
      const line = formatLogLine(entry, false);
      try {
        ensureReady();
        fs.appendFileSync(filePath, line + "\n", "utf-8");
      } catch {
        /* ignore — 与原 bds-tools/logger.ts 行为一致 */
      }
    },
    close(): void {
      /* sync append 无需关闭 FD */
    },
  };
}

/**
 * CallbackSink — 把日志事件转发给回调 (用于 sfmc 主进程把子进程 stdout 捕获后推入内存缓冲)
 */
export function createCallbackSink(fn: (entry: LogEntry) => void): Sink {
  return {
    write(entry: LogEntry): void {
      fn(entry);
    },
  };
}
