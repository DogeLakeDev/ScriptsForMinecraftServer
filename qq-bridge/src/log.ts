/**
 * log.ts — qq-bridge 统一日志实例
 *
 * 通过 @sfmc-bds/logs 共享包接入,source = "qq"。
 * sfmc 主进程通过捕获本进程 stdout 汇聚展示。
 *
 * bare 模式: stdout 只输出纯 text,不加时间戳/source/level 前缀
 * (由 sfmc 的 formatLog 统一添加,避免重复)。error 走 stderr。
 */

import { createLogger, createStdoutSink } from "@sfmc-bds/sdk/logs";

export const log = createLogger({
  source: "qq",
  sinks: [createStdoutSink({ bare: true })],
});
