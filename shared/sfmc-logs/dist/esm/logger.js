/**
 * logger.ts — Logger 工厂
 *
 * createLogger({ source, sinks, subscribers }) 返回统一接口的 logger 实例。
 * 每个 log 调用:构造 LogEntry → 格式化 → 并行写入所有 sinks + 通知 subscribers。
 */
import { formatLogLine } from "./format.js";
export function createLogger(opts) {
    const sinks = opts.sinks ?? [];
    const subscribers = opts.subscribers ?? [];
    const color = opts.color ?? true;
    const source = opts.source;
    function emit(text, level) {
        const entry = { time: new Date(), text, source, level };
        const formatted = formatLogLine(entry, color);
        for (const s of sinks) {
            try {
                s.write(entry, formatted);
            }
            catch {
                /* sink 故障不应中断主流程 */
            }
        }
        for (const fn of subscribers) {
            try {
                fn(entry);
            }
            catch {
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
export function getOutputLine(entry, color = true) {
    return formatLogLine(entry, color);
}
//# sourceMappingURL=logger.js.map