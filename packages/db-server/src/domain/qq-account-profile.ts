/**
 * domain/qq-account-profile.ts — QQ「我的账号」要展示的经济余额和在线时长。
 *
 * 余额读经济插件归档表 sfmc_economy_accounts（计分板对账后的快照）。
 * 在线时长读 online-time 插件表 sfmc_online_time，跨日、跨月的清零规则与插件离线查询一致。
 * qq-link 若已把两个服务的实时结果写入 sfmc_qq_account_profile，且比插件落库更新，则优先用那份。
 */

import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

/** 与经济插件默认 unitName 一致。配置文件缺失时账号页用这个单位。 */
export const DEFAULT_ECONOMY_UNIT = "节操";

/** 与 online-time 插件默认时区一致，用来判断「今日 / 本月」是否要清零。 */
const ONLINE_TIME_TZ_OFFSET_MS = 8 * 3600_000;

export type QqAccountProfile = {
  unit: string;
  /** 没有账户行时按插件约定视为 0；查询失败时为 null。 */
  balance: number | null;
  today_text: string;
  month_text: string;
  total_text: string;
};

type EconomyRow = { account_id?: string; balance?: number; account_type?: string };
type OnlineRow = {
  today_seconds?: number;
  month_seconds?: number;
  total_seconds?: number;
  last_date?: string;
  last_month?: string;
  updated_at?: number;
};
type SnapshotRow = {
  balance?: number | null;
  today_seconds?: number | null;
  month_seconds?: number | null;
  total_seconds?: number | null;
  updated_at?: number;
};

/** 与 online-time 插件 formatDuration 相同的展示。 */
export function formatOnlineDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (parts.length === 0 || secs > 0) parts.push(`${secs}秒`);
  return parts.join("") || "0秒";
}

function dateKey(ms: number): string {
  const local = new Date(ms + ONLINE_TIME_TZ_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 插件离线查询的清零：last_date 不是今天则今日为 0，last_month 不是本月则本月为 0。
 * 当前给账号页使用，避免把昨天的时长显示成今日。
 */
export function rollPluginOnlineSeconds(
  row: { today_seconds?: number; month_seconds?: number; total_seconds?: number; last_date?: string; last_month?: string },
  now = Date.now()
): { today: number; month: number; total: number } {
  const today = dateKey(now);
  const month = today.slice(0, 7);
  return {
    today: String(row.last_date || "") === today ? Number(row.today_seconds) || 0 : 0,
    month: String(row.last_month || "") === month ? Number(row.month_seconds) || 0 : 0,
    total: Number(row.total_seconds) || 0,
  };
}

/** 查询失败返回 null，和「表在但没有这一行」区分开。 */
function safeRows<T>(query: QueryFn, sql: ReturnType<typeof SQL>): T[] | null {
  try {
    const rows = query(sql);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return null;
  }
}

function pickEconomyBalance(rows: EconomyRow[], playerId: string, playerName: string): number | null {
  if (!rows.length) return 0;
  const prefixed = `player:${playerId}`;
  const order = [playerId, prefixed, playerName].filter((id) => id);
  for (const id of order) {
    const hit = rows.find((row) => String(row.account_id || "") === id);
    if (!hit) continue;
    if (id === playerName && hit.account_type && hit.account_type !== "player") continue;
    const balance = Number(hit.balance);
    return Number.isFinite(balance) ? balance : 0;
  }
  return 0;
}

function rollSnapshotSeconds(row: SnapshotRow, now: number): { today: number; month: number; total: number } | null {
  if (row.today_seconds == null && row.month_seconds == null && row.total_seconds == null) return null;
  const updated = Number(row.updated_at) || 0;
  const stampDay = updated > 0 ? dateKey(updated) : "";
  const stampMonth = stampDay.slice(0, 7);
  const today = dateKey(now);
  const month = today.slice(0, 7);
  return {
    today: stampDay === today ? Number(row.today_seconds) || 0 : 0,
    month: stampMonth === month ? Number(row.month_seconds) || 0 : 0,
    total: Number(row.total_seconds) || 0,
  };
}

/**
 * 组装一个已绑定角色的账号页数字。
 * 没有账户或时长记录时按插件约定显示 0；表读失败时余额为 null、时长文案为「暂时读不到」。
 */
export function loadQqAccountProfile(
  query: QueryFn,
  playerId: string,
  playerName: string,
  now = Date.now()
): QqAccountProfile {
  const id = playerId.trim();
  const name = playerName.trim();
  const economyRows = id
    ? safeRows<EconomyRow>(
        query,
        SQL`SELECT account_id, balance, account_type FROM sfmc_economy_accounts
            WHERE (_deleted_at IS NULL)
              AND (account_id = ${id} OR account_id = ${`player:${id}`} OR account_id = ${name})`
      )
    : [];
  const onlineRows = id
    ? safeRows<OnlineRow>(
        query,
        SQL`SELECT today_seconds, month_seconds, total_seconds, last_date, last_month, updated_at
            FROM sfmc_online_time
            WHERE player_id = ${id} AND (_deleted_at IS NULL)
            LIMIT 1`
      )
    : [];
  const snapshots = id
    ? safeRows<SnapshotRow>(
        query,
        SQL`SELECT balance, today_seconds, month_seconds, total_seconds, updated_at
            FROM sfmc_qq_account_profile WHERE player_xuid = ${id} LIMIT 1`
      )
    : [];

  const archiveBalance = economyRows == null ? null : pickEconomyBalance(economyRows, id, name);
  const pluginOnline = onlineRows?.[0] ? rollPluginOnlineSeconds(onlineRows[0], now) : { today: 0, month: 0, total: 0 };
  const snapshot = snapshots?.[0];
  const snapshotOnline = snapshot ? rollSnapshotSeconds(snapshot, now) : null;
  const pluginUpdated = Number(onlineRows?.[0]?.updated_at) || 0;
  const snapshotUpdated = Number(snapshot?.updated_at) || 0;
  const online = snapshotOnline && snapshotUpdated >= pluginUpdated ? snapshotOnline : pluginOnline;
  const onlineKnown = onlineRows != null || snapshotOnline != null;
  const snapshotBalance = snapshot && snapshot.balance != null ? Number(snapshot.balance) : null;
  const balance =
    snapshotBalance != null && Number.isFinite(snapshotBalance) ? snapshotBalance : archiveBalance;

  return {
    unit: DEFAULT_ECONOMY_UNIT,
    balance,
    today_text: onlineKnown ? formatOnlineDuration(online.today) : "暂时读不到",
    month_text: onlineKnown ? formatOnlineDuration(online.month) : "暂时读不到",
    total_text: onlineKnown ? formatOnlineDuration(online.total) : "暂时读不到",
  };
}

/** 写入 qq-link 推来的实时余额和在线时长。缺的数字保留上一次。 */
export function saveQqAccountProfile(
  query: QueryFn,
  input: {
    playerId: string;
    playerName: string;
    balance: number | null;
    todaySeconds: number | null;
    monthSeconds: number | null;
    totalSeconds: number | null;
    now?: number;
  }
): void {
  const now = input.now ?? Date.now();
  query(
    SQL`INSERT INTO sfmc_qq_account_profile
          (player_xuid, player_name, balance, today_seconds, month_seconds, total_seconds, updated_at)
        VALUES
          (${input.playerId}, ${input.playerName}, ${input.balance}, ${input.todaySeconds}, ${input.monthSeconds}, ${input.totalSeconds}, ${now})
        ON CONFLICT(player_xuid) DO UPDATE SET
          player_name = excluded.player_name,
          balance = COALESCE(excluded.balance, sfmc_qq_account_profile.balance),
          today_seconds = COALESCE(excluded.today_seconds, sfmc_qq_account_profile.today_seconds),
          month_seconds = COALESCE(excluded.month_seconds, sfmc_qq_account_profile.month_seconds),
          total_seconds = COALESCE(excluded.total_seconds, sfmc_qq_account_profile.total_seconds),
          updated_at = excluded.updated_at`
  );
}
