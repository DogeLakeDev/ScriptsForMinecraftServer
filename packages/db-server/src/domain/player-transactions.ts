/**
 * domain/player-transactions.ts — 玩家自己的经济流水只读查询
 *
 * 使用场景：小程序「交易记录」页。读 economy 模块归档表 sfmc_economy_transactions，
 * 只返回 source_account_id / target_account_id / actor_id 命中该玩家账户的行。
 * 账户 id 可能是 xuid、player:xuid 或玩家名（与账号页 pickEconomyBalance 的兼容规则一致）。
 */
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

/** 一条流水 */
export interface PlayerTransaction {
  id: string;
  type: string;
  actorId: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceType: string;
  referenceId: string;
  createdAt: number;
}

/** 一页流水 */
export interface PlayerTransactionPage {
  records: PlayerTransaction[];
  total: number;
  limit: number;
  offset: number;
}

type TxRow = {
  id?: string;
  type?: string;
  actor_id?: string;
  source_account_id?: string;
  target_account_id?: string;
  amount?: number;
  balance_before?: number;
  balance_after?: number;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
  created_at?: number;
};

function safeAll<T>(query: QueryFn, sql: ReturnType<typeof SQL>): T[] | null {
  try {
    const rows = query(sql);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return null;
  }
}

function mapRow(row: TxRow): PlayerTransaction {
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? ""),
    actorId: String(row.actor_id ?? ""),
    sourceAccountId: String(row.source_account_id ?? ""),
    targetAccountId: String(row.target_account_id ?? ""),
    amount: Number(row.amount) || 0,
    balanceBefore: Number(row.balance_before) || 0,
    balanceAfter: Number(row.balance_after) || 0,
    reason: String(row.reason ?? ""),
    referenceType: String(row.reference_type ?? ""),
    referenceId: String(row.reference_id ?? ""),
    createdAt: Number(row.created_at) || 0,
  };
}

/**
 * 按玩家账户查流水。
 * @param playerId 绑定的 xuid（游戏内 player.id）
 * @param playerName 绑定的玩家名（兼容以名字为账户 id 的归档行）
 */
export function queryPlayerTransactions(
  query: QueryFn,
  playerId: string,
  playerName: string,
  limit: number,
  offset: number
): PlayerTransactionPage {
  const id = playerId.trim();
  const name = playerName.trim();
  if (!id) return { records: [], total: 0, limit, offset };
  const prefixed = `player:${id}`;
  // 账户 id 三种写法都要命中；表不存在时返回空页
  // 名字为空时不要用空串匹配账户，避免误命中
  const ids = name ? [id, prefixed, name] : [id, prefixed];
  const a = ids[0]!;
  const b = ids[1]!;
  const c = ids[2] ?? ids[0]!;
  const countRows = safeAll<{ n?: number }>(
    query,
    name
      ? SQL`SELECT COUNT(*) AS n FROM sfmc_economy_transactions
            WHERE (_deleted_at IS NULL)
              AND (source_account_id IN (${a}, ${b}, ${c})
                OR target_account_id IN (${a}, ${b}, ${c})
                OR actor_id IN (${a}, ${b}, ${c}))`
      : SQL`SELECT COUNT(*) AS n FROM sfmc_economy_transactions
            WHERE (_deleted_at IS NULL)
              AND (source_account_id IN (${a}, ${b})
                OR target_account_id IN (${a}, ${b})
                OR actor_id IN (${a}, ${b}))`
  );
  if (countRows == null) return { records: [], total: 0, limit, offset };
  const total = Number(countRows[0]?.n) || 0;
  const rows = safeAll<TxRow>(
    query,
    name
      ? SQL`SELECT id, type, actor_id, source_account_id, target_account_id, amount,
                 balance_before, balance_after, reason, reference_type, reference_id, created_at
          FROM sfmc_economy_transactions
          WHERE (_deleted_at IS NULL)
            AND (source_account_id IN (${a}, ${b}, ${c})
              OR target_account_id IN (${a}, ${b}, ${c})
              OR actor_id IN (${a}, ${b}, ${c}))
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
      : SQL`SELECT id, type, actor_id, source_account_id, target_account_id, amount,
                 balance_before, balance_after, reason, reference_type, reference_id, created_at
          FROM sfmc_economy_transactions
          WHERE (_deleted_at IS NULL)
            AND (source_account_id IN (${a}, ${b})
              OR target_account_id IN (${a}, ${b})
              OR actor_id IN (${a}, ${b}))
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
  );
  return { records: (rows ?? []).map(mapRow), total, limit, offset };
}
