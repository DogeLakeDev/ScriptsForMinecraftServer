/**
 * sink.ts — 日志输出目标实现
 *
 * StdoutSink: 输出到 stdout (可选颜色,可选 stderr 路由 error)
 * FileSink:   追加写入文件 (纯文本,无 ANSI 码,单例 FD)
 */
import type { LogEntry, Sink } from "./types.js";
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
export declare function createStdoutSink(opts?: StdoutSinkOptions): Sink;
export interface FileSinkOptions {
    /** 是否自动创建父目录 (默认 true) */
    mkdir?: boolean;
    /** 文件打开模式 (默认 "a" 追加) */
    flags?: string;
}
export interface FileSink extends Sink {
    /** 关闭底层文件流,释放 FD */
    close(): void;
}
export declare function createFileSink(filePath: string, opts?: FileSinkOptions): FileSink;
/**
 * CallbackSink — 把日志事件转发给回调 (用于 sfmc 主进程把子进程 stdout 捕获后推入内存缓冲)
 */
export declare function createCallbackSink(fn: (entry: LogEntry) => void): Sink;
