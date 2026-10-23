/**
 * alert-archive.ts — 按实例保存全部警告和错误
 *
 * 使用场景：告警抽屉。日志缓冲只留最近几千行，这里按「来源 + 级别 + 正文」合并后写入本地，
 * 刷新页面后还在。日志文件能扫到的记录会把次数补齐；已经不在文件里的旧报错仍留在列表中，直到用户忽略。
 */
import type { LogEntryWire } from "@sfmc-bds/management";
import { groupAllAlerts, type AlertGroup } from "./alerts.js";

/** 合并后的一条告警。次数是同文出现了多少次，时间是首次和最近一次。 */
export interface SavedAlert {
  source: string;
  level: "error" | "warn";
  text: string;
  count: number;
  firstTime: string;
  lastTime: string;
}

const ARCHIVE_PREFIX = "sfmc.desktop.alertArchive.";
const SEEN_PREFIX = "sfmc.desktop.alertSeen.";
const HIDDEN_PREFIX = "sfmc.desktop.alertHidden.";

/** 同一条告警的稳定键。使用场景：忽略、已读和合并都用它，避免同一句报错拆成多条。 */
export function alertKey(alert: Pick<SavedAlert, "source" | "level" | "text">): string {
  return JSON.stringify([alert.source, alert.level, alert.text]);
}

/** 单行日志的身份。使用场景：实时日志并入档案时不把同一行重复计数。 */
export function alertLineKey(log: Pick<LogEntryWire, "time" | "source" | "level" | "text">): string {
  return `${log.time}\0${log.source}\0${log.level}\0${log.text}`;
}

function isAlertLevel(level: string): level is SavedAlert["level"] {
  return level === "error" || level === "warn";
}

function isSavedAlert(value: unknown): value is SavedAlert {
  if (!value || typeof value !== "object") return false;
  const row = value as SavedAlert;
  return isAlertLevel(row.level)
    && typeof row.source === "string"
    && typeof row.text === "string"
    && typeof row.count === "number"
    && Number.isFinite(row.count)
    && row.count > 0
    && typeof row.firstTime === "string"
    && typeof row.lastTime === "string";
}

/** 给紧凑列表用的分组。时间取最近一次，次数沿用档案里已经累计的值。 */
export function toAlertGroup(alert: SavedAlert): AlertGroup {
  return {
    log: { time: alert.lastTime, source: alert.source, level: alert.level, text: alert.text },
    count: alert.count,
    firstTime: alert.firstTime,
  };
}

/**
 * 把已经体现在档案里的日志行记为计过数。
 * 使用场景：刷新后缓冲里仍有旧报错，不能再加一次；时间不晚于该条最近出现时间的行视为已经计入。
 */
export function markCoveredLines(alerts: SavedAlert[], lines: LogEntryWire[], applied: Set<string>) {
  const lastTime = new Map(alerts.map((alert) => [alertKey(alert), alert.lastTime]));
  for (const log of lines) {
    if (log.level !== "error" && log.level !== "warn") continue;
    const covered = lastTime.get(alertKey({ source: log.source, level: log.level, text: log.text }));
    if (covered !== undefined && log.time <= covered) applied.add(alertLineKey(log));
  }
}

/** 最近出现的排在前面。 */
export function sortAlerts(alerts: SavedAlert[]): SavedAlert[] {
  return alerts.sort((a, b) => {
    const delta = Date.parse(b.lastTime) - Date.parse(a.lastTime);
    return delta || alertKey(a).localeCompare(alertKey(b));
  });
}

function indexAlerts(alerts: SavedAlert[]): Map<string, SavedAlert> {
  return new Map(alerts.map((alert) => [alertKey(alert), { ...alert }]));
}

/**
 * 用一次日志扫描补齐档案。
 * 扫描里已经有的种类取较大次数，避免截断结果把历史次数改小；扫描里没有的旧种类保留。
 */
export function mergeAlertSnapshot(saved: SavedAlert[], lines: LogEntryWire[]): SavedAlert[] {
  const map = indexAlerts(saved);
  for (const group of groupAllAlerts(lines)) {
    if (!isAlertLevel(group.log.level)) continue;
    const row: SavedAlert = {
      source: group.log.source,
      level: group.log.level,
      text: group.log.text,
      count: group.count,
      firstTime: group.firstTime,
      lastTime: group.log.time,
    };
    const key = alertKey(row);
    const previous = map.get(key);
    if (!previous) {
      map.set(key, row);
      continue;
    }
    previous.count = Math.max(previous.count, row.count);
    if (row.firstTime < previous.firstTime) previous.firstTime = row.firstTime;
    if (row.lastTime > previous.lastTime) previous.lastTime = row.lastTime;
  }
  return sortAlerts([...map.values()]);
}

/**
 * 把还没计过数的日志行加进档案。
 * 使用场景：连接期间新到的警告和错误。applied 记下已经计过的行，刷新扫描时不会再加一遍。
 * 没有新行时返回原数组。
 */
export function foldAlertLines(saved: SavedAlert[], lines: LogEntryWire[], applied: Set<string>): SavedAlert[] {
  const map = indexAlerts(saved);
  let changed = false;
  for (const log of lines) {
    if (!isAlertLevel(log.level)) continue;
    const id = alertLineKey(log);
    if (applied.has(id)) continue;
    applied.add(id);
    changed = true;
    const key = alertKey({ source: log.source, level: log.level, text: log.text });
    const previous = map.get(key);
    if (!previous) {
      map.set(key, { source: log.source, level: log.level, text: log.text, count: 1, firstTime: log.time, lastTime: log.time });
      continue;
    }
    previous.count += 1;
    if (log.time < previous.firstTime) previous.firstTime = log.time;
    if (log.time > previous.lastTime) previous.lastTime = log.time;
  }
  return changed ? sortAlerts([...map.values()]) : saved;
}

/** 读取这个实例已经保存的告警。损坏的本地数据按空列表处理。 */
export function loadAlertArchive(instanceId: string): SavedAlert[] {
  if (!instanceId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ARCHIVE_PREFIX + instanceId) ?? "[]") as unknown;
    return Array.isArray(raw) ? sortAlerts(raw.filter(isSavedAlert)) : [];
  } catch {
    return [];
  }
}

/**
 * 写入本地档案。空间不够时从最旧的一条开始丢掉，直到能写下或列表为空。
 * 使用场景：浏览器对 localStorage 有容量上限，不能因为一条超限就让整个档案保存失败。
 */
export function saveAlertArchive(instanceId: string, alerts: SavedAlert[]) {
  if (!instanceId) return;
  const key = ARCHIVE_PREFIX + instanceId;
  const rows = alerts.slice();
  while (true) {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
      return;
    } catch {
      if (!rows.length) return;
      rows.pop();
    }
  }
}

/** 上次点击「全部标为已读」的时间。没有记录时返回 0。 */
export function loadAlertSeen(instanceId: string): number {
  const value = Number(localStorage.getItem(SEEN_PREFIX + instanceId));
  return Number.isFinite(value) ? value : 0;
}

export function saveAlertSeen(instanceId: string, seenAt: number) {
  if (!instanceId) return;
  localStorage.setItem(SEEN_PREFIX + instanceId, String(seenAt));
}

/** 用户忽略的告警键。 */
export function loadHiddenAlerts(instanceId: string): string[] {
  if (!instanceId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_PREFIX + instanceId) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveHiddenAlerts(instanceId: string, keys: string[]) {
  if (!instanceId) return;
  localStorage.setItem(HIDDEN_PREFIX + instanceId, JSON.stringify(keys));
}
