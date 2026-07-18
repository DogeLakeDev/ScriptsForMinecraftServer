"use strict";
/**
 * log.ts — bds-tools 统一日志实例
 *
 * 通过 @sfmc/logs 共享包接入,source = "bds-tools"。
 * 同时输出 stdout + 落盘到 LOG_PATH (update.log)。
 *
 * check-update.ts 是独立入口,用 source = "updater" 单独创建 logger,
 * 见该文件内的 createUpdaterLogger()。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
exports.closeLog = closeLog;
const logs_1 = require("@sfmc/logs");
const paths_js_1 = require("./paths.js");
const fileSink = (0, logs_1.createFileSink)(paths_js_1.LOG_PATH);
process.on("exit", () => fileSink.close());
exports.log = (0, logs_1.createLogger)({
    source: "bds-tools",
    sinks: [(0, logs_1.createStdoutSink)(), fileSink],
});
/** 关闭文件流 (进程退出前调用,确保缓冲落盘) */
function closeLog() {
    fileSink.close();
}
//# sourceMappingURL=log.js.map