/**
 * activity.ts — 行为日志（activity-log 模块）查询与统计的协议类型
 *
 * 使用场景：桌面端「行为日志」页与小程序管理端调用 activity.query / activity.stats。
 * 数据来自业务库的 activities 表（由 sfmc-module-activity-log 写入），平台只读。
 * 握手带 "activity" 能力时才可调用；模块未安装时结果的 installed 为 false。
 * 结构与 @sfmc-bds/db-server/activity-log 的返回值一致，CLI 侧由类型检查保证两边不漂移。
 */

/** 行为记录级别 */
export type ActivityLevel = "info" | "warn" | "error";

/** activity.query / activity.stats 共用的筛选条件；字段之间为“且” */
export interface ActivityFilterParams {
  /** 精确事件类型，如 block.break；优先于 eventTypePrefix */
  eventType?: string;
  /** 事件分类前缀，如 "block." */
  eventTypePrefix?: string;
  /** 执行者 ID（玩家为游戏内 player.id，即绑定记录里的 playerXuid） */
  actorId?: string;
  /** 执行者名称（精确匹配） */
  actorName?: string;
  /** 目标（方块 / 实体类型 ID，或被击杀玩家的 ID） */
  targetId?: string;
  /** 维度 ID，如 minecraft:overworld */
  dimension?: string;
  level?: ActivityLevel;
  /** 开始时间，毫秒时间戳（含） */
  from?: number;
  /** 结束时间，毫秒时间戳（含） */
  to?: number;
  /** 在玩家名、目标与附加数据（含聊天内容）中模糊匹配 */
  keyword?: string;
}

/** activity.query 参数 */
export interface ActivityQueryParams extends ActivityFilterParams {
  /** 单页条数，缺省 50；超过服务端上限时按上限截断，实际取值见结果的 limit */
  limit?: number;
  offset?: number;
}

/** 一条行为记录（空字符串 / null 表示模块没有记录该字段） */
export interface ActivityRecord {
  id: string;
  /** 毫秒时间戳 */
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
  /** 附加数据（聊天内容、伤害来源等）；无法解析时为 null */
  payload: Record<string, unknown> | null;
}

/** activity.query 结果（按时间倒序；total 为满足条件的精确总数） */
export interface ActivityQueryResult {
  installed: boolean;
  records: ActivityRecord[];
  total: number;
  /** 服务端实际采用的单页条数；分页拉取全部记录时以此为步长 */
  limit: number;
  offset: number;
}

/** activity.stats 结果 */
export interface ActivityStatsResult {
  installed: boolean;
  total: number;
  /** 产生过记录的玩家数 */
  actors: number;
  byType: { eventType: string; count: number }[];
  byLevel: { level: ActivityLevel; count: number }[];
  /** 记录最多的玩家（降序） */
  topActors: { actorId: string; actorName: string; count: number }[];
}
