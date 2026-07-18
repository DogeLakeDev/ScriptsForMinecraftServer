/**
 * format.ts — 日志格式化纯函数
 *
 * 两种格式:
 *   - formatLogLine: 子进程 stdout / 文件落盘用,完整带 ISO 时间戳 + [source] + [LEVEL]
 *   - formatLog:     sfmc 主进程展示用,本地时间 + 对齐 source + 紧凑 level tag,text 原样
 */
import type { FormatOptions, LogEntry, LogLevel } from "./types.js";
/** 从原始文本推断日志级别 (关键词匹配,兼容子进程各种前缀风格) */
export declare function inferLevel(text: string): LogLevel;
/** source 字段右侧填充到指定宽度 */
export declare function padSource(s: string, n?: number): string;
/** 紧凑级别标签: [INF] [WRN] [ERR] [OK] [DBG] */
export declare function levelTag(lvl: LogLevel, color?: boolean): string;
/** 完整级别标签: [INFO] [WARN] [ERROR] [OK] [DEBUG] */
export declare function levelTagFull(lvl: LogLevel, color?: boolean): string;
/** 高亮文本中的关键词 (IP / TPS / [LEVEL] 标签等),并 strip Minecraft § 颜色码 */
export declare function highlightText(raw: string, color?: boolean): string;
/**
 * formatLogLine — 子进程 stdout / 文件落盘用
 * 格式: <ISO时间> [source] [LEVEL] text
 */
export declare function formatLogLine(entry: LogEntry, color?: boolean): string;
/**
 * formatLog — sfmc 主进程展示用 (兼容原 sfmc/src/logs.ts 的 formatLog)
 * 格式: <localTime> <paddedSource> <levelTag> <text>
 * text 原样保留 (子进程 stdout 整行,内含其时间戳/source 由 highlightText 美化)
 */
export declare function formatLog(entry: LogEntry, opts?: FormatOptions): string;
