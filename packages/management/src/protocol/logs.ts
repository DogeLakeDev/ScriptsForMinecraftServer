/**
 * logs.ts — 日志查询与实时推送的协议类型
 *
 * 使用场景：桌面端日志控制台（logs.tail 拉历史 + 订阅 log 事件收实时增量）。
 * 日志条目结构与 CLI 统一日志层（UnifiedLog）对齐，时间为 ISO 字符串（线缆格式）。
 */

/** 日志级别（与 @sfmc-bds/sdk/logs 的 LogLevel 对齐） */
export type LogLevel = "info" | "warn" | "error" | "success" | "debug";

/** 日志来源标识（bds / db / qq / llbot / tunnel / system / update / pack / module …） */
export type LogSource = string;

/** 单条日志（线缆格式；time 为 ISO 字符串） */
export interface LogEntryWire {
  time: string;
  source: LogSource;
  level: LogLevel;
  text: string;
}

/** logs.tail 参数：拉取落盘历史日志（权威来源 `.sfmc/logs/*.log`） */
export interface LogsTailParams {
  /** 仅包含这些来源；缺省为全部 */
  sources?: LogSource[];
  /** 仅包含这些级别；缺省为全部 */
  levels?: LogLevel[];
  /** 仅保留时间序最后 N 条；缺省由服务端给上限 */
  limit?: number;
}

/** logs.tail 结果 */
export interface LogsTailResult {
  entries: LogEntryWire[];
}

/** 实时日志推送载荷（event: "log"） */
export type LogEventPayload = LogEntryWire;
