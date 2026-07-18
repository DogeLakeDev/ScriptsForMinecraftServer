/**
 * sink.ts — 日志输出目标实现
 *
 * StdoutSink: 输出到 stdout (可选颜色,可选 stderr 路由 error)
 * FileSink:   追加写入文件 (纯文本,无 ANSI 码,单例 FD)
 */
import fs from "node:fs";
import path from "node:path";
import { formatLogLine } from "./format.js";
import { supportsColor } from "./ansi.js";
export function createStdoutSink(opts = {}) {
    const color = opts.color ?? supportsColor(process.stdout);
    const stderrForError = opts.stderrForError ?? true;
    return {
        write(entry, _formatted) {
            const line = formatLogLine(entry, color);
            if (stderrForError && entry.level === "error") {
                process.stderr.write(line + "\n");
            }
            else {
                process.stdout.write(line + "\n");
            }
        },
    };
}
export function createFileSink(filePath, opts = {}) {
    const mkdir = opts.mkdir ?? true;
    const flags = opts.flags ?? "a";
    let stream = null;
    function getStream() {
        if (stream)
            return stream;
        if (mkdir)
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        stream = fs.createWriteStream(filePath, { flags, encoding: "utf-8" });
        stream.on("error", () => {
            // 退化:不抛出避免中断主流程,错误只能丢失
        });
        return stream;
    }
    return {
        write(entry, _formatted) {
            // 文件始终纯文本无 ANSI 码
            const line = formatLogLine(entry, false);
            try {
                getStream().write(line + "\n");
            }
            catch {
                /* ignore — 与原 bds-tools/logger.ts 行为一致 */
            }
        },
        close() {
            if (stream) {
                stream.end();
                stream = null;
            }
        },
    };
}
/**
 * CallbackSink — 把日志事件转发给回调 (用于 sfmc 主进程把子进程 stdout 捕获后推入内存缓冲)
 */
export function createCallbackSink(fn) {
    return {
        write(entry) {
            fn(entry);
        },
    };
}
//# sourceMappingURL=sink.js.map