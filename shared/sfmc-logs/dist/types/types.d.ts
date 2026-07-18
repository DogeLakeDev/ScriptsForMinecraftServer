/**
 * types.ts — 公共类型定义
 */
export type LogLevel = "info" | "warn" | "error" | "debug" | "success";
export type LogSource = string;
export interface LogEntry {
    time: Date;
    text: string;
    source: LogSource;
    level: LogLevel;
}
/**
 * Sink — 日志输出的抽象目标 (stdout / file / memory buffer / 自定义)
 * write() 接收原始 entry 和已格式化字符串,实现自行选择使用哪个。
 */
export interface Sink {
    write(entry: LogEntry, formatted: string): void;
}
export interface FormatOptions {
    /** 是否带 ANSI 颜色码 (默认 true) */
    color?: boolean;
    /** source 字段对齐宽度 (仅 formatLog 用,默认 7) */
    padSourceWidth?: number;
}
