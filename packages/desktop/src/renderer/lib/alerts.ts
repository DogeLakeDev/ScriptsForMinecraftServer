import type { LogEntryWire } from "@sfmc-bds/management";

export interface AlertGroup {
  log: LogEntryWire;
  count: number;
  firstTime: string;
}

/** 同一来源、级别和完整正文才合并；按最后出现时间排序，原始日志不变。 */
export function groupAlerts(logs: LogEntryWire[], limit = 6): AlertGroup[] {
  if (limit <= 0) return [];
  const groups = new Map<string, AlertGroup>();
  for (let index = logs.length - 1; index >= 0; index--) {
    const log = logs[index]!;
    if (log.level !== "error" && log.level !== "warn") continue;
    const key = JSON.stringify([log.source, log.level, log.text]);
    const group = groups.get(key);
    if (group) {
      group.count++;
      group.firstTime = log.time;
    } else if (groups.size < limit) groups.set(key, { log, count: 1, firstTime: log.time });
  }
  return [...groups.values()];
}

/** 定位告警对应的日志。优先用原对象，日志被替换后按时间、来源、级别和正文匹配最近一条。 */
export function findLogIndex(logs: LogEntryWire[], target: LogEntryWire): number {
  const exact = logs.lastIndexOf(target);
  if (exact >= 0) return exact;
  for (let index = logs.length - 1; index >= 0; index--) {
    const log = logs[index]!;
    if (log.time === target.time && log.source === target.source && log.level === target.level && log.text === target.text) return index;
  }
  return -1;
}
