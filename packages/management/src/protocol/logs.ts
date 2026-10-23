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

/** logs.tail 单次最多返回的条数。桌面按日期查询时请求这个上限。 */
export const LOG_TAIL_MAX = 5000;

/** logs.tail 参数：拉取落盘历史日志（权威来源 `.sfmc/logs/*.log`） */
export interface LogsTailParams {
  /** 仅包含这些来源；缺省为全部 */
  sources?: LogSource[];
  /** 仅包含这些级别；缺省为全部 */
  levels?: LogLevel[];
  /** 仅保留时间序最后 N 条；缺省由服务端给上限，且不超过 LOG_TAIL_MAX */
  limit?: number;
  /** 含此时间（ISO）。与 until 一起按日历范围读取，而不是只读文件末尾 */
  since?: string;
  /** 含此时间（ISO） */
  until?: string;
}

/** logs.tail 结果 */
export interface LogsTailResult {
  entries: LogEntryWire[];
  /** 范围内还有更早的日志没有放进 entries */
  truncated?: boolean;
}

/** logs.delete 参数：从落盘日志中删除这段时间内的行 */
export interface LogsDeleteParams {
  since: string;
  until: string;
  /** 只删除这一来源；缺省为范围内全部来源 */
  source?: LogSource;
  /** 只删除正文完全相同的行；缺省不比较正文 */
  text?: string;
}

/** logs.delete 结果 */
export interface LogsDeleteResult {
  removed: number;
}

/** 实时日志推送载荷（event: "log"） */
export type LogEventPayload = LogEntryWire;
