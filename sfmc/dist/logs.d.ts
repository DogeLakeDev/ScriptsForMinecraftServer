/**
 * logs.ts — sfmc 主进程统一日志聚合层
 *
 * 内部委托 @sfmc/logs 共享包的 createMemoryBuffer + inferLevel,
 * 保持向后兼容的 pushLog / onLog / getAllLogs / getRecentLogs API
 * (services.ts 捕获子进程 stdout 后调用 pushLog 汇聚到此)。
 *
 * formatLog 保留 theme.ts (chalk) 配色,比共享包的纯 ANSI 版本视觉更丰富。
 */
import { type LogEntry, type LogLevel as SharedLogLevel } from "@sfmc/sdk/logs";
export type LogLevel = SharedLogLevel;
export type LogSource = string;
export interface UnifiedLog extends LogEntry {
}
/** 推送一条日志到内存缓冲 (services.ts 捕获子进程 stdout 后调用) */
export declare function pushLog(text: string, source: LogSource, level: LogLevel): void;
/** 订阅新日志事件,返回取消订阅函数 */
export declare function onLog(fn: (log: UnifiedLog) => void): () => void;
/** 获取全部日志 (按时间顺序) */
export declare function getAllLogs(): UnifiedLog[];
/** 获取最近 n 条,可按 level / source 过滤 */
export declare function getRecentLogs(n: number, levels: LogLevel[], sources: LogSource[]): UnifiedLog[];
/** 从原始文本推断日志级别 (委托共享包) */
export declare function inferLevel(text: string): LogLevel;
/** 格式化日志用于 REPL 展示 (用 theme.ts chalk 配色) */
export declare function formatLog(l: UnifiedLog): string;
/** 字符串在终端的可见宽度 (strip ANSI 后按 CJK 宽度累加) */
export declare function visibleWidth(s: string): number;
/**
 * 按终端可见宽度换行,后续行左侧缩进 indent 个空格。
 * 保留 ANSI 颜色码:换行时先 reset 避免缩进空格带色,新行恢复颜色状态。
 * 宽字符(CJK)按 2 列计算,避免中文行换行位置偏后。
 */
export declare function wrapLogLine(s: string, indent: number): string;
//# sourceMappingURL=logs.d.ts.map