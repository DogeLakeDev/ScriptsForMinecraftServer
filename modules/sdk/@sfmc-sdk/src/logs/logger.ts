/**
 * logger.ts — Logger 工厂
 *
 * createLogger({ source, sinks, subscribers }) 返回统一接口的 logger 实例。
 * 每个 log 调用:构造 LogEntry → 格式化 → 并行写入所有 sinks + 通知 subscribers。
 */

import type { LogEntry, LogLevel, LogSource, Sink } from "./types.js";
import { formatLogLine } from "./format.js";

export interface LoggerOptions {
  /** 本 logger 的来源标识 (如 "db" / "qq" / "bds-tools" / "updater" / "system") */
  source: LogSource;
  /** 输出目标列表 (默认 [createStdoutSink()]) */
  sinks?: Sink[];
  /** 订阅者回调 (每个 log 调用都会通知,与 sink 并行) */
  subscribers?: Array<(entry: LogEntry) => void>;
  /** 是否带颜色格式化传给 sink (默认 true;sink 内部可能再覆盖) */
  color?: boolean;
}

export interface Logger {
  /** 通用日志,level 默认 info */
  log(text: string, level?: LogLevel): void;
  info(text: string): void;
  warn(text: string): void;
  error(text: string): void;
  debug(text: string): void;
  success(text: string): void;
  /** 便捷:直接传 Error 对象,error 级别,自动提取 message */
  err(e: unknown, context?: string): void;
  /** 当前 logger 的 source */
  readonly source: LogSource;
}

export function createLogger(opts: LoggerOptions): Logger {
  const sinks = opts.sinks ?? [];
  const subscribers = opts.subscribers ?? [];
  const color = opts.color ?? true;
  const source = opts.source;

  function emit(text: string, level: LogLevel): void {
    const entry: LogEntry = { time: new Date(), text, source, level };
    const formatted = formatLogLine(entry, color);
    for (const s of sinks) {
      try {
        s.write(entry, formatted);
      } catch {
        /* sink 故障不应中断主流程 */
      }
    }
    for (const fn of subscribers) {
      try {
        fn(entry);
      } catch {
        /* subscriber 故障不应中断主流程 */
      }
    }
  }

  return {
    source,
    log(text, level = "info") {
      emit(text, level);
    },
    info(text) {
      emit(text, "info");
    },
    warn(text) {
      emit(text, "warn");
    },
    error(text) {
      emit(text, "error");
    },
    debug(text) {
      emit(text, "debug");
    },
    success(text) {
      emit(text, "success");
    },
    err(e, context) {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error && e.stack ? `\n${e.stack}` : "";
      const text = context ? `${context}: ${msg}${stack}` : `${msg}${stack}`;
      emit(text, "error");
    },
  };
}

/**
 * getOutputLine — 给定 entry,返回它会被 sink 输出的字符串 (供测试/调试)
 */
export function getOutputLine(entry: LogEntry, color = true): string {
  return formatLogLine(entry, color);
}
