/**
 * logger.ts — Logger 工厂
 *
 * createLogger({ source, sinks, subscribers }) 返回统一接口的 logger 实例。
 * 每个 log 调用:构造 LogEntry → 格式化 → 并行写入所有 sinks + 通知 subscribers。
 */
import type { LogEntry, LogLevel, LogSource, Sink } from "./types.js";
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
export declare function createLogger(opts: LoggerOptions): Logger;
/**
 * getOutputLine — 给定 entry,返回它会被 sink 输出的字符串 (供测试/调试)
 */
export declare function getOutputLine(entry: LogEntry, color?: boolean): string;
