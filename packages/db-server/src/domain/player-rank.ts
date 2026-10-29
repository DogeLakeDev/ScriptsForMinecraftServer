/**
 * domain/player-rank.ts — 玩家端排行榜只读查询
 *
 * 使用场景：
 *   - 在线时长：读 online-time 模块表 sfmc_online_time，跨日 / 跨月清零规则与账号页一致（rollPluginOnlineSeconds）；
 *   - 财富：读内存中的计分板快照里的 sfmc_money（与游戏内余额一致）；
 *   - 公开计分项排行：同一快照按 settings.json 的 rank.publicObjectives 过滤。
 * 表不存在或读失败时返回空列表（模块未安装），不抛错。
 */
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";
import { formatOnlineDuration, rollPluginOnlineSeconds } from "./qq-account-profile.js";
import type { ScoreboardStore } from "./scoreboard.js";

/** 经济余额计分项默认 ID（与 economy 模块 configs-default/economy.json 一致） */
export const WEALTH_OBJECTIVE_ID = "sfmc_money";

/** 在线时长排行的度量 */
export type OnlineRankMetric = "today" | "month" | "total";

/** 排行榜上一行 */
export interface RankRow {
  rank: number;
  playerId: string;
  playerName: string;
  /** 原始数值：秒数或分数 */
  value: number;
  /** 展示文案（在线时长为「N天N时…」，财富 / 计分为数字） */
  display: string;
}

/** 排行结果；myRank 仅在传入 openid 对应的绑定玩家时有值 */
export interface RankPage {
  rows: RankRow[];
  myRank: RankRow | null;
  /** 财富排行的货币单位；其他排行为空串 */
  unit: string;
  /** 计分板快照是否可用 / 新鲜（财富与计分项排行） */
  available: boolean;
  fresh: boolean;
  note?: string;
}

type OnlineDbRow = {
  player_id?: string;
  player_name?: string;
  today_seconds?: number;
  month_seconds?: number;
  total_seconds?: number;
  last_date?: string;
  last_month?: string;
};

/** 查询失败或表不存在时返回 null */
function safeRows<T>(query: QueryFn, sql: ReturnType<typeof SQL>): T[] | null {
  try {
    const rows = query(sql);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return null;
  }
}

/** 把候选行按数值降序截断并编号 */
function numberRows(
  candidates: Array<{ playerId: string; playerName: string; value: number; display: string }>,
  limit: number
): RankRow[] {
  return candidates
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName, "zh"))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

/**
 * 在完整排序中找某玩家的名次（不限于 limit）。
 * matchByName 为 true 时按 playerName 匹配（计分板没有稳定 xuid）；否则按 playerId（在线时长表）。
 */
function findMyRank(
  candidates: Array<{ playerId: string; playerName: string; value: number; display: string }>,
  key: string,
  matchByName = false
): RankRow | null {
  if (!key) return null;
  const sorted = candidates
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName, "zh"));
  const index = sorted.findIndex((row) => (matchByName ? row.playerName === key : row.playerId === key));
  if (index < 0) return null;
  const row = sorted[index]!;
  return { rank: index + 1, playerId: row.playerId, playerName: row.playerName, value: row.value, display: row.display };
}

/**
 * 在线时长排行。
 * @param metric today / month / total
 * @param limit 返回前 N 名（1–100）
 * @param playerId 当前绑定玩家 id（找「我的名次」）；空串表示不查
 */
export function queryOnlineRank(
  query: QueryFn,
  metric: OnlineRankMetric,
  limit: number,
  playerId = "",
  now = Date.now()
): RankPage {
  const rows = safeRows<OnlineDbRow>(
    query,
    SQL`SELECT player_id, player_name, today_seconds, month_seconds, total_seconds, last_date, last_month
        FROM sfmc_online_time WHERE (_deleted_at IS NULL)`
  );
  if (rows == null) {
    return { rows: [], myRank: null, unit: "", available: false, fresh: false, note: "在线时长模块未安装或暂时读不到" };
  }
  const candidates = rows.map((row) => {
    const rolled = rollPluginOnlineSeconds(row, now);
    const value = metric === "today" ? rolled.today : metric === "month" ? rolled.month : rolled.total;
    return {
      playerId: String(row.player_id ?? ""),
      playerName: String(row.player_name ?? row.player_id ?? ""),
      value,
      display: formatOnlineDuration(value),
    };
  });
  return {
    rows: numberRows(candidates, limit),
    myRank: findMyRank(candidates, playerId, false),
    unit: "",
    available: true,
    fresh: true,
  };
}

/**
 * 从计分板快照取某一计分项的玩家排行（只含 type=player 的参与者）。
 * 使用场景：财富排行（sfmc_money）与公开计分项排行。
 * @param playerName 当前绑定玩家名（计分板没有 xuid，按名字找「我的名次」）
 */
export function queryObjectiveRank(
  store: ScoreboardStore,
  objectiveId: string,
  limit: number,
  playerName = "",
  unit = "",
  now = Date.now()
): RankPage {
  const view = store.read(now);
  if (!view.available) {
    return {
      rows: [],
      myRank: null,
      unit,
      available: false,
      fresh: false,
      note: view.note ?? "计分板暂不可用",
    };
  }
  const objective = view.objectives.find((item) => item.id === objectiveId);
  if (!objective) {
    return {
      rows: [],
      myRank: null,
      unit,
      available: true,
      fresh: view.fresh,
      note: `计分项 ${objectiveId} 不存在`,
    };
  }
  const candidates = objective.participants
    .filter((item) => item.type === "player")
    .map((item) => ({
      playerId: item.name,
      playerName: item.name,
      value: item.score,
      display: String(item.score),
    }));
  return {
    rows: numberRows(candidates, limit),
    myRank: findMyRank(candidates, playerName, true),
    unit,
    available: true,
    fresh: view.fresh,
    ...(view.note ? { note: view.note } : {}),
  };
}
