/**
 * logger.ts — 单例控制台日志
 *
 * 仅写 stdout (跟旧实现一致,不带文件落盘 — 这是个轻量桥接进程,无需持久化日志)。
 * 对齐 db-server/panel 的"小工具不写日志文件"风格。
 */
export declare const logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
};
//# sourceMappingURL=logger.d.ts.map