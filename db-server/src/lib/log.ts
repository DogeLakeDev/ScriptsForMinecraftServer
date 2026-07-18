/**
 * log.ts — db-server 统一日志实例
 *
 * 通过 @sfmc/logs 共享包接入,source = "db"。
 * sfmc 主进程通过捕获本进程 stdout 汇聚展示。
 *
 * bare 模式: stdout 只输出纯 text,不加时间戳/source/level 前缀
 * (由 sfmc 的 formatLog 统一添加,避免重复)。error 走 stderr。
 */

import { createLogger, createStdoutSink } from "@sfmc/logs";

export const log = createLogger({
  source: "db",
  sinks: [createStdoutSink({ bare: true })],
});
