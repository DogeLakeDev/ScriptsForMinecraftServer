/**
 * logger.ts — 单例控制台日志
 *
 * 仅写 stdout (跟旧实现一致,不带文件落盘 — 这是个轻量桥接进程,无需持久化日志)。
 * 对齐 db-server/panel 的"小工具不写日志文件"风格。
 */

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(prefix: string, msg: string): void {
  const line = `[${ts()}] ${prefix} ${msg}`;
  console.log(line);
}

export const logger = {
  info(msg: string): void {
    write("[QQBridge]", msg);
  },
  warn(msg: string): void {
    write("[QQBridge][!]", msg);
  },
  error(msg: string): void {
    write("[QQBridge][x]", msg);
  },
};
