/**
 * logger.ts — 统一 Logger 日志工厂
 *
 * 提供标准化的日志创建工厂：
 * 构造统一的 `LogEntry` 结构，格式化后并发分发给配置的所有 `sinks`（如 stdout、落盘文件）以及外部订阅函数。
 */

import type { LogEntry, LogLevel, LogSource, Sink } from "./types.js";
import { formatLogLine } from "./format.js";
import { createFileSink, createStdoutSink, type FileSink } from "./sink.js";

/** Logger 构建配置选项。 */
export interface LoggerOptions {
  /** 日志来源标识（例如 "db"、"qq"、"bds-tools"、"updater"、"system"）。 */
  source: LogSource;
  /** 日志输出目标列表（缺省默认为 `[createStdoutSink()]`）。 */
  sinks?: Sink[];
  /** 订阅者回调列表（每次触发日志时同步广播，与 sink 并行分发）。 */
  subscribers?: Array<(entry: LogEntry) => void>;
  /** 格式化输出给 sink 时是否启用彩色代码（默认为 `true`）。 */
  color?: boolean;
}

/** 统一日志记录器接口。 */
export interface Logger {
  /**
   * 写入通用日志。
   *
   * @param text 日志内容文本。
   * @param level 日志级别（默认为 "info"）。
   */
  log(text: string, level?: LogLevel): void;
  /** 写入 INFO 级别日志。 */
  info(text: string): void;
  /** 写入 WARN 级别日志。 */
  warn(text: string): void;
  /** 写入 ERROR 级别日志。 */
  error(text: string): void;
  /** 写入 DEBUG 级别日志。 */
  debug(text: string): void;
  /** 写入 SUCCESS 成功级别日志。 */
  success(text: string): void;
  /**
   * 便捷记录错误：直接接收 Error 对象或未知异常，自动提取错误消息与堆栈并以 error 级别写入。
   *
   * @param e 捕获的异常对象或错误消息。
   * @param context 可选的上下文描述前缀。
   */
  err(e: unknown, context?: string): void;
  /** 当前 Logger 的来源标识。 */
  readonly source: LogSource;
}

/** Node 服务标准 Logger 实例接口：包含标准输出与日志文件落盘。 */
export interface NodeServiceLogger extends Logger {
  /**
   * 关闭底层文件输出流。
   */
  close(): void;
  /** 底层关联的文件输出 sink。 */
  readonly fileSink: FileSink;
}

/** Node 进程日志记录器配置选项。 */
export interface NodeServiceLoggerOptions {
  /** 服务来源标识。 */
  source: LogSource;
  /** 日志文件落盘绝对路径。 */
  logPath: string;
  /**
   * 标准输出是否仅输出纯文本正文（默认为 `true`）。
   * 当子进程输出由主进程 CLI 统一捕获并添加时间戳时，设为 `true` 可避免重复打印前缀。
   */
  bareStdout?: boolean;
}

/**
 * 创建 Node 独立服务的标准 Logger 实例：同时输出至终端与持久化日志文件。
 *
 * @param opts 构造选项。
 * @returns 包含文件流关闭方法的 Logger 实例。
 */
export function createNodeServiceLogger(opts: NodeServiceLoggerOptions): NodeServiceLogger {

  const fileSink = createFileSink(opts.logPath);
  const bareStdout = opts.bareStdout ?? true;
  const logger = createLogger({
    source: opts.source,
    sinks: [createStdoutSink({ bare: bareStdout }), fileSink],
  });
  return {
    ...logger,
    fileSink,
    close() {
      fileSink.close();
    },
  };
}

/** 创建通用 Logger 实例。 */
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
