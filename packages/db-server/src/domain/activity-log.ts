/**
 * domain/activity-log.ts — 行为日志模块（activity-log）记录的只读查询与统计
 *
 * 使用场景：
 * - CLI 管理通道的 activity.query / activity.stats（桌面端「行为日志」页、小程序管理端）
 *   通过 readActivityPage / readActivityStats 只读打开业务库；
 * - db-server 的微信玩家路由（routes/wechat-activity.ts）用当前连接调用 queryActivityPage，
 *   只查绑定玩家自己的记录。
 * 表结构由 sfmc-module-activity-log 在 init() 中 defineTable("activities") 声明，这里只读、不建表、不写入。
 * 模块从未运行过（表不存在）时返回 installed: false，界面据此提示安装模块。
 */

import type { QueryFn } from "../lib/sqlite.js";
import { withReadonlyQuery } from "../lib/sqlite.js";

/** 行为日志模块声明的表名（模块 sapi/src/index.ts 的 TABLE） */
export const ACTIVITY_TABLE = "activities";
/** 单页条数上限；导出时由调用方分页拉取 */
export const ACTIVITY_PAGE_MAX = 500;
/** 未指定 limit 时的单页条数 */
export const ACTIVITY_PAGE_DEFAULT = 50;
/** 统计里活跃玩家排行的条数 */
export const ACTIVITY_TOP_ACTORS = 10;
/** 文本筛选参数的长度上限，避免超长 LIKE 模式 */
const FILTER_TEXT_MAX = 128;

/** 记录级别，与模块的 Level 一致 */
export type ActivityLevel = "info" | "warn" | "error";
const LEVELS: readonly ActivityLevel[] = ["info", "warn", "error"];

/**
 * 查询条件。所有字段可选，多个字段之间是“且”关系。
 * eventType 精确匹配，优先于 eventTypePrefix（如 "block." 表示方块类全部事件）。
 * keyword 在玩家名、目标与附加数据（payload_json，含聊天内容）中模糊匹配。
 */
export interface ActivityFilter {
  eventType?: string;
  eventTypePrefix?: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  dimension?: string;
  level?: ActivityLevel;
  /** 起始时间（毫秒时间戳，含） */
  from?: number;
  /** 结束时间（毫秒时间戳，含） */
  to?: number;
  keyword?: string;
}

/** 分页参数 */
export interface ActivityPaging {
  limit: number;
  offset: number;
}

/** 一条行为记录（空字符串 / null 表示模块未记录该字段） */
export interface ActivityRecordRow {
  id: string;
  timestamp: number;
  eventType: string;
  actorId: string;
  actorName: string;
  targetId: string;
  dimension: string;
  x: number | null;
  y: number | null;
  z: number | null;
  level: ActivityLevel;
  /** 事件附加数据（聊天内容、伤害来源等）；解析失败时为 null */
  payload: Record<string, unknown> | null;
}

/** 一页查询结果；total 为满足条件的精确总数 */
export interface ActivityPageResult {
  installed: boolean;
  records: ActivityRecordRow[];
  total: number;
  limit: number;
  offset: number;
}

/** 时间范围内的统计概览 */
export interface ActivityStatsResult {
  installed: boolean;
  /** 满足条件的记录总数 */
  total: number;
  /** 产生过记录的玩家数 */
  actors: number;
  /** 各事件类型的条数（降序） */
  byType: { eventType: string; count: number }[];
  /** 各级别的条数 */
  byLevel: { level: ActivityLevel; count: number }[];
  /** 记录最多的玩家（降序，最多 ACTIVITY_TOP_ACTORS 名） */
  topActors: { actorId: string; actorName: string; count: number }[];
}

/**
 * 参数非法时抛出的错误。
 * 使用场景：HTTP 路由据此回 400；CLI 管理通道按普通错误把 message 回给界面。
 */
export class ActivityQueryError extends Error {}

/** 可选文本参数：缺省 / 空串返回 undefined，非字符串、超长或含换行时报错 */
function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > FILTER_TEXT_MAX || /[\r\n]/.test(value)) {
    throw new ActivityQueryError(`非法 ${label}`);
  }
  return value.trim() || undefined;
}

/** 可选毫秒时间戳：接受数字或数字字符串（HTTP 查询串） */
function optionalTime(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const time = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(time) || time < 0) throw new ActivityQueryError(`非法 ${label}`);
  return Math.floor(time);
}

/**
 * 把外部传入的参数（管理协议 params / HTTP 查询串）规整为查询条件。
 * 使用场景：CLI activity.query / activity.stats 与微信玩家路由共用，校验规则只有这一处（DRY）。
 */
export function parseActivityFilter(raw: Record<string, unknown>): ActivityFilter {
  const filter: ActivityFilter = {};
  const eventType = optionalText(raw.eventType, "事件类型");
  const eventTypePrefix = optionalText(raw.eventTypePrefix, "事件分类");
  const actorId = optionalText(raw.actorId, "玩家 ID");
  const actorName = optionalText(raw.actorName, "玩家名");
  const targetId = optionalText(raw.targetId, "目标");
  const dimension = optionalText(raw.dimension, "维度");
  const keyword = optionalText(raw.keyword, "关键词");
  const levelText = optionalText(raw.level, "级别");
  const from = optionalTime(raw.from, "开始时间");
  const to = optionalTime(raw.to, "结束时间");
  if (levelText !== undefined && !LEVELS.includes(levelText as ActivityLevel)) throw new ActivityQueryError("非法 级别");
  if (from !== undefined && to !== undefined && to < from) throw new ActivityQueryError("结束时间不能早于开始时间");
  if (eventType) filter.eventType = eventType;
  else if (eventTypePrefix) filter.eventTypePrefix = eventTypePrefix;
  if (actorId) filter.actorId = actorId;
  if (actorName) filter.actorName = actorName;
  if (targetId) filter.targetId = targetId;
  if (dimension) filter.dimension = dimension;
  if (keyword) filter.keyword = keyword;
  if (levelText) filter.level = levelText as ActivityLevel;
  if (from !== undefined) filter.from = from;
  if (to !== undefined) filter.to = to;
  return filter;
}

/** 规整分页参数：limit 限制在 1…ACTIVITY_PAGE_MAX，offset 不小于 0 */
export function parseActivityPaging(raw: Record<string, unknown>): ActivityPaging {
  const limit = Number(raw.limit);
  const offset = Number(raw.offset);
  return {
    limit: Number.isFinite(limit) && limit >= 1 ? Math.min(ACTIVITY_PAGE_MAX, Math.floor(limit)) : ACTIVITY_PAGE_DEFAULT,
    offset: Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0,
  };
}

/** LIKE 模式转义：% _ \ 按字面匹配（配合 ESCAPE '\'） */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** 读取表的列名；表不存在时返回 null（模块尚未安装或从未启动） */
function tableColumns(query: QueryFn): Set<string> | null {
  const rows = query(`PRAGMA table_info("${ACTIVITY_TABLE}")`) as Array<{ name?: unknown }>;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return new Set(rows.map((row) => String(row.name ?? "")));
}

/**
 * 按条件拼出 WHERE 子句（参数化，不拼接用户输入）。
 * 模块表默认启用软删除（_deleted_at 列），存在该列时排除已删除行。
 */
function whereClause(filter: ActivityFilter, columns: Set<string>, alias = ""): { sql: string; values: unknown[] } {
  const col = (name: string) => `${alias}"${name}"`;
  const parts: string[] = [];
  const values: unknown[] = [];
  if (columns.has("_deleted_at")) parts.push(`${col("_deleted_at")} IS NULL`);
  if (filter.eventType) {
    parts.push(`${col("event_type")} = ?`);
    values.push(filter.eventType);
  } else if (filter.eventTypePrefix) {
    parts.push(`${col("event_type")} LIKE ? ESCAPE '\\'`);
    values.push(`${escapeLike(filter.eventTypePrefix)}%`);
  }
  for (const [key, column] of [["actorId", "actor_id"], ["actorName", "actor_name"], ["targetId", "target_id"], ["dimension", "dimension"], ["level", "level"]] as const) {
    const value = filter[key];
    if (!value) continue;
    parts.push(`${col(column)} = ?`);
    values.push(value);
  }
  if (filter.from !== undefined) {
    parts.push(`${col("timestamp")} >= ?`);
    values.push(filter.from);
  }
  if (filter.to !== undefined) {
    parts.push(`${col("timestamp")} <= ?`);
    values.push(filter.to);
  }
  if (filter.keyword) {
    const pattern = `%${escapeLike(filter.keyword)}%`;
    parts.push(`(${["actor_name", "target_id", "payload_json"].map((name) => `${col(name)} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
    values.push(pattern, pattern, pattern);
  }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const coordinate = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** 数据库行 → 对外记录 */
function toRecord(row: Record<string, unknown>): ActivityRecordRow {
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(text(row.payload_json) || "{}");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  const level = text(row.level);
  return {
    id: text(row.id),
    timestamp: Number(row.timestamp) || 0,
    eventType: text(row.event_type),
    actorId: text(row.actor_id),
    actorName: text(row.actor_name),
    targetId: text(row.target_id),
    dimension: text(row.dimension),
    x: coordinate(row.x),
    y: coordinate(row.y),
    z: coordinate(row.z),
    level: LEVELS.includes(level as ActivityLevel) ? (level as ActivityLevel) : "info",
    payload,
  };
}

/** COUNT 结果统一转成数字（node:sqlite 可能返回 bigint） */
const count = (value: unknown) => Number(value) || 0;

/**
 * 在已有连接上分页查询行为记录（按时间倒序）。
 * 使用场景：db-server 进程内的路由；进程外请用 readActivityPage。
 */
export function queryActivityPage(query: QueryFn, filter: ActivityFilter, paging: ActivityPaging): ActivityPageResult {
  const columns = tableColumns(query);
  if (!columns) return { installed: false, records: [], total: 0, ...paging };
  const where = whereClause(filter, columns);
  const totalRow = (query(`SELECT COUNT(*) AS c FROM "${ACTIVITY_TABLE}" ${where.sql}`, where.values) as Array<{ c?: unknown }>)[0];
  const rows = query(
    `SELECT id, timestamp, event_type, actor_id, actor_name, target_id, dimension, x, y, z, level, payload_json
       FROM "${ACTIVITY_TABLE}" ${where.sql}
      ORDER BY timestamp DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...where.values, paging.limit, paging.offset]
  ) as Array<Record<string, unknown>>;
  return { installed: true, records: rows.map(toRecord), total: count(totalRow?.c), ...paging };
}

/**
 * 在已有连接上统计行为记录。
 * 活跃玩家只统计“产生过 player.* 事件”的执行者：模块对爆炸等非玩家来源会把实体类型写进 actor_id，
 * 而 player.* 事件只由真实玩家触发，以此区分，不依赖 ID 格式。
 */
export function queryActivityStats(query: QueryFn, filter: ActivityFilter): ActivityStatsResult {
  const columns = tableColumns(query);
  if (!columns) return { installed: false, total: 0, actors: 0, byType: [], byLevel: [], topActors: [] };
  const where = whereClause(filter, columns, "a.");
  const from = `FROM "${ACTIVITY_TABLE}" a ${where.sql}`;
  const playerActor = `a.actor_id <> '' AND EXISTS (SELECT 1 FROM "${ACTIVITY_TABLE}" p WHERE p.actor_id = a.actor_id AND p.event_type LIKE 'player.%')`;
  const and = where.sql ? " AND " : " WHERE ";
  const byType = (query(`SELECT a.event_type AS k, COUNT(*) AS c ${from} GROUP BY a.event_type ORDER BY c DESC`, where.values) as Array<{ k?: unknown; c?: unknown }>)
    .map((row) => ({ eventType: text(row.k), count: count(row.c) }));
  const byLevel = (query(`SELECT a.level AS k, COUNT(*) AS c ${from} GROUP BY a.level`, where.values) as Array<{ k?: unknown; c?: unknown }>)
    .filter((row) => LEVELS.includes(text(row.k) as ActivityLevel))
    .map((row) => ({ level: text(row.k) as ActivityLevel, count: count(row.c) }));
  const actorsRow = (query(`SELECT COUNT(DISTINCT a.actor_id) AS c ${from}${and}${playerActor}`, where.values) as Array<{ c?: unknown }>)[0];
  const topActors = (query(
    `SELECT a.actor_id AS id, MAX(a.actor_name) AS name, COUNT(*) AS c ${from}${and}${playerActor}
      GROUP BY a.actor_id ORDER BY c DESC LIMIT ?`,
    [...where.values, ACTIVITY_TOP_ACTORS]
  ) as Array<{ id?: unknown; name?: unknown; c?: unknown }>).map((row) => ({ actorId: text(row.id), actorName: text(row.name), count: count(row.c) }));
  return {
    installed: true,
    total: byType.reduce((sum, row) => sum + row.count, 0),
    actors: count(actorsRow?.c),
    byType,
    byLevel,
    topActors,
  };
}

/**
 * 只读打开业务库文件并分页查询。
 * 使用场景：CLI 管理通道 activity.query。数据库文件不存在时按“模块未安装”返回。
 */
export function readActivityPage(filePath: string, filter: ActivityFilter, paging: ActivityPaging): ActivityPageResult {
  return withReadonlyQuery(filePath, () => ({ installed: false, records: [], total: 0, ...paging }), (query) => queryActivityPage(query, filter, paging));
}

/**
 * 只读打开业务库文件并统计。
 * 使用场景：CLI 管理通道 activity.stats。
 */
export function readActivityStats(filePath: string, filter: ActivityFilter): ActivityStatsResult {
  return withReadonlyQuery(
    filePath,
    () => ({ installed: false, total: 0, actors: 0, byType: [], byLevel: [], topActors: [] }),
    (query) => queryActivityStats(query, filter)
  );
}
