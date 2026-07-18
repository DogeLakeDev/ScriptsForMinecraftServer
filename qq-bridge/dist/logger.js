/**
 * logger.ts — 单例控制台日志
 *
 * 仅写 stdout (跟旧实现一致,不带文件落盘 — 这是个轻量桥接进程,无需持久化日志)。
 * 对齐 db-server/panel 的"小工具不写日志文件"风格。
 */
function ts() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
}
function write(prefix, msg) {
    const line = `[${ts()}] ${prefix} ${msg}`;
    console.log(line);
}
export const logger = {
    info(msg) {
        write("[QQBridge]", msg);
    },
    warn(msg) {
        write("[QQBridge][!]", msg);
    },
    error(msg) {
        write("[QQBridge][x]", msg);
    },
};
//# sourceMappingURL=logger.js.map