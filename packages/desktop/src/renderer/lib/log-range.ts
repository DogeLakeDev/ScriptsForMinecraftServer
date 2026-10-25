/**
 * log-range.ts — 日志控制台的本地日期时间范围
 *
 * 使用场景：日历选出的本地日期和时间，转换成 logs.tail / logs.delete 用的 ISO 边界。
 * 磁盘日志的时间戳是 UTC，比较前必须先从本地时间换成绝对时间。
 */
import type { LogEntryWire } from "@sfmc-bds/management";

/** 与已发布平台 logs.tail 的单次上限一致。桌面按日期查询时请求这个数量。 */
export const LOG_TAIL_MAX = 5000;

/** 日历上的一段本地时间。日期是 YYYY-MM-DD，时间是 HH:mm。 */
export interface LogRangeValue {
  startDay: string;
  endDay: string;
  startTime: string;
  endTime: string;
}

/** 本地日历日，YYYY-MM-DD。 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 今天全天（00:00–23:59）。
 * 使用场景：日历弹层打开时的默认选区；行为日志页的默认时间范围。
 */
export function todayRange(): LogRangeValue {
  const today = dayKey(new Date());
  return { startDay: today, endDay: today, startTime: "00:00", endTime: "23:59" };
}

/** 把本地日期和钟点合成 ISO。结束时间含到该分钟的最后一毫秒。 */
export function localStamp(day: string, time: string, end: boolean): string {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const stamp = new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0, end ? 59 : 0, end ? 999 : 0);
  return stamp.toISOString();
}

/** 查询和删除共用的绝对时间边界。调用前应保证结束不早于开始。 */
export function rangeBounds(value: LogRangeValue): { since: string; until: string } {
  return {
    since: localStamp(value.startDay, value.startTime, false),
    until: localStamp(value.endDay, value.endTime, true),
  };
}

/** 同一本地秒的闭区间。单条删除用它对齐只精确到秒的落盘时间。 */
export function secondWindow(iso: string): { since: string; until: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const since = new Date(date);
  since.setMilliseconds(0);
  const until = new Date(since);
  until.setMilliseconds(999);
  return { since: since.toISOString(), until: until.toISOString() };
}

/** 工具栏上的范围文案。 */
export function rangeLabel(value: LogRangeValue | null): string {
  if (!value) return "日期";
  const start = value.startDay.slice(5);
  const end = value.endDay.slice(5);
  const days = value.startDay === value.endDay ? start : `${start} – ${end}`;
  return `${days} ${value.startTime}–${value.endTime}`;
}

/** 这条日志是否落在绝对时间闭区间内。ISO 字符串按字典序即可比较。 */
export function logInBounds(log: LogEntryWire, since: string, until: string): boolean {
  return log.time >= since && log.time <= until;
}
