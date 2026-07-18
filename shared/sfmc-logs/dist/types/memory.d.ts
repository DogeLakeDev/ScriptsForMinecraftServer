/**
 * memory.ts — 进程内内存缓冲 (sfmc 主进程用)
 *
 * 替代原 sfmc/src/logs.ts 的 allLogs + subscribers 逻辑。
 * 作为 sink 接入 createLogger,或单独通过 pushDirect 写入。
 */
import type { LogEntry, LogLevel, LogSource, Sink } from "./types.js";
export interface MemoryBuffer {
    /** 作为 sink 接入 logger */
    sink: Sink;
    /** 直接写入一条 entry (供 services.ts 捕获子进程 stdout 后调用) */
    pushDirect(text: string, source: LogSource, level: LogLevel): void;
    /** 获取全部日志 (按时间顺序) */
    getAll(): LogEntry[];
    /** 获取最近 n 条,可按 level / source 过滤 */
    getRecent(n: number, levels?: LogLevel[], sources?: LogSource[]): LogEntry[];
    /** 订阅新日志事件,返回取消订阅函数 */
    subscribe(fn: (entry: LogEntry) => void): () => void;
    /** 清空缓冲 */
    clear(): void;
    /** 当前缓冲条数 */
    readonly size: number;
}
export declare function createMemoryBuffer(maxSize?: number): MemoryBuffer;
