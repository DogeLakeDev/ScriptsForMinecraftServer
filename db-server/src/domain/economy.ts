/**
 * domain/economy.ts — 经济系统业务核心
 *
 * 提供账户 upsert、通用转账、日常任务奖励与月度统计。
 * land / chat / gui 等通过 service(economy.account.*) 调用本文件。
 *
 * 事务约定(方案 A):
 *   - applyEconomySteps / submitDailyTaskSteps — 无 BEGIN/COMMIT,可嵌进外层 db.tx
 *   - applyEconomyTransaction / submitDailyTaskTx — 独立调用时自己开事务;
 *     alreadyInTx=true 时只跑 steps
 */

import type { EconomyAccountRow, EconomyTransactionRow } from "@sfmc-bds/sdk/contracts";
import type { DatabaseSync } from "node:sqlite";
import type { SQLStatement } from "sql-template-strings";
import { isValidIdempotencyKey } from "../lib/idempotency.js";
import { sql } from "../lib/sql-helpers.js";
import type { TxResult } from "./transaction.js";
export type { TxResult };

const TABLE_ACCOUNTS = "sfmc_economy_accounts";
const TABLE_TRANSACTIONS = "sfmc_economy_transactions";
const TABLE_IDEMPOTENCY = "sfmc_economy_idempotency";
const TABLE_DAILY = "sfmc_economy_daily_tasks";
const TABLE_STATS = "sfmc_economy_stats";

/** query 兼容格式：string / SQLStatement / { sql, values } */
export type AnyQuery = (
  sql: string | SQLStatement | { sql: string; values?: unknown[] },
  values?: unknown[]
) => unknown[] | { changes: number | bigint };

function newTransactionId(now: number): string {
  return `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface EconomyAccountView {
  playerId: string;
  playerName: string;
  balance: number;
  version: number;
}

export function economyResult(row: EconomyAccountRow | undefined): EconomyAccountView | undefined {
  if (!row) return undefined;
  return {
    playerId: row.player_id,
    playerName: row.player_name_snapshot,
    balance: row.balance,
    version: row.version,
  };
}

/** 确保账户存在并返回最新行 */
export function ensureEconomyAccount(
  query: AnyQuery,
  playerId: string,
  playerName: string
): EconomyAccountRow | undefined {
  const now = Date.now();
  query(
    sql(
      `INSERT INTO ${TABLE_ACCOUNTS} (player_id, player_name_snapshot, balance, version, created_at, updated_at)
       VALUES (?, ?, 0, 1, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
         player_name_snapshot = excluded.player_name_snapshot,
         updated_at = excluded.updated_at`,
      [String(playerId), String(playerName), now, now]
    )
  );
  const rows = query(sql(`SELECT * FROM ${TABLE_ACCOUNTS} WHERE player_id = ?`, [String(playerId)]));
  if (Array.isArray(rows)) {
    return (rows as EconomyAccountRow[])[0];
  }
  return undefined;
}

/** 读取(必要时创建)账户业务视图 */
export function getEconomyAccount(
  query: AnyQuery,
  playerId: string,
  playerName = ""
): EconomyAccountView | null {
  const row = ensureEconomyAccount(query, playerId, playerName);
  return economyResult(row) ?? null;
}

export interface ApplyEconomyInput {
  actor_id?: string;
  amount: number;
  transaction_type?: string;
  source_player_id?: string;
  target_player_id?: string;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  idempotency_key?: string;

  actorId?: string;
  type?: string;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  sourcePlayerName?: string;
  targetPlayerName?: string;
  referenceType?: string;
  referenceId?: string;
  reasonAlias?: string;
  idempotencyKey?: string;
}

export type ApplyEconomyResult =
  | {
      ok: true;
      transactionId: string;
      replayed?: boolean;
      source:
        | (EconomyAccountView & {
            balanceBefore: number;
            balanceAfter: number;
          })
        | null;
      target:
        | (EconomyAccountView & {
            balanceBefore: number;
            balanceAfter: number;
          })
        | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
      balance?: number;
    };

/**
 * 经济变更核心(无 BEGIN/COMMIT)。
 * 纯 debit(仅 source)或纯 credit(仅 target)均可成功。
 */
export function applyEconomySteps(query: AnyQuery, data: ApplyEconomyInput): ApplyEconomyResult {
  const amount = Number(data.amount);
  const actorId = String(data.actor_id ?? data.actorId ?? "").trim();
  if (!actorId || !Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }

  const sourceId = data.source_player_id
    ? String(data.source_player_id)
    : data.sourcePlayerId
      ? String(data.sourcePlayerId)
      : null;
  const targetId = data.target_player_id
    ? String(data.target_player_id)
    : data.targetPlayerId
      ? String(data.targetPlayerId)
      : null;

  const idempotencyKey = String(data.idempotency_key ?? data.idempotencyKey ?? "").trim();
  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    return { ok: false, error: "invalid_idempotency_key", status: 400 };
  }
  if (!sourceId && !targetId) {
    return { ok: false, error: "missing_account", status: 400 };
  }
  if (sourceId && sourceId !== actorId) {
    return { ok: false, error: "forbidden_source", status: 403 };
  }
  if (sourceId && targetId && sourceId === targetId) {
    return { ok: false, error: "same_account", status: 400 };
  }

  // 幂等回放
  if (idempotencyKey) {
    const rows = query(
      sql(
        `SELECT response_json FROM ${TABLE_IDEMPOTENCY}
         WHERE actor_id = ? AND idempotency_key = ?`,
        [actorId, idempotencyKey]
      )
    );
    const previous = Array.isArray(rows) ? (rows as Array<{ response_json: string }>)[0] : undefined;
    if (previous) {
      return { ...JSON.parse(previous.response_json), replayed: true } as ApplyEconomyResult;
    }
  }

  const source = sourceId ? ensureEconomyAccount(query, sourceId, String(data.sourcePlayerName ?? "")) : null;
  const target = targetId ? ensureEconomyAccount(query, targetId, String(data.targetPlayerName ?? "")) : null;
  if (sourceId && !source) {
    return { ok: false, error: "source_not_found", status: 404 };
  }
  if (targetId && !target) {
    return { ok: false, error: "target_not_found", status: 404 };
  }

  if (source && source.balance < amount) {
    return { ok: false, error: "insufficient_funds", balance: source.balance, status: 409 };
  }

  const now = Date.now();
  if (source) {
    query(
      sql(
        `UPDATE ${TABLE_ACCOUNTS}
         SET balance = balance - ?, version = version + 1, updated_at = ?
         WHERE player_id = ? AND balance >= ?`,
        [amount, now, source.player_id, amount]
      )
    );
  }
  if (target) {
    query(
      sql(
        `UPDATE ${TABLE_ACCOUNTS}
         SET balance = balance + ?, version = version + 1, updated_at = ?
         WHERE player_id = ?`,
        [amount, now, target.player_id]
      )
    );
  }

  const transactionType = String(data.transaction_type ?? data.type ?? "adjustment");
  const referenceType = String(data.reference_type ?? data.referenceType ?? "");
  const referenceId = String(data.reference_id ?? data.referenceId ?? "");
  const reason = String(data.reason ?? data.reasonAlias ?? "");
  const id = newTransactionId(now);

  if (source) {
    query(
      sql(
        `INSERT INTO ${TABLE_TRANSACTIONS}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after,
           reference_type, reference_id, reason, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id + "-dr",
          transactionType + ".dr",
          actorId,
          sourceId,
          amount,
          source.balance,
          source.balance - amount,
          referenceType,
          referenceId,
          reason,
          now,
        ]
      )
    );
  }
  if (target) {
    query(
      sql(
        `INSERT INTO ${TABLE_TRANSACTIONS}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after,
           reference_type, reference_id, reason, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id + "-cr",
          transactionType + ".cr",
          actorId,
          targetId,
          amount,
          target.balance,
          target.balance + amount,
          referenceType,
          referenceId,
          reason,
          now,
        ]
      )
    );
  }

  const sourceView = source ? economyResult(ensureEconomyAccount(query, source.player_id, "")) : undefined;
  const targetView = target ? economyResult(ensureEconomyAccount(query, target.player_id, "")) : undefined;

  const response: ApplyEconomyResult = {
    ok: true,
    transactionId: id,
    source: sourceView
      ? { ...sourceView, balanceBefore: source!.balance, balanceAfter: source!.balance - amount }
      : null,
    target: targetView
      ? { ...targetView, balanceBefore: target!.balance, balanceAfter: target!.balance + amount }
      : null,
  };

  if (idempotencyKey) {
    query(
      sql(
        `INSERT INTO ${TABLE_IDEMPOTENCY}
          (actor_id, idempotency_key, transaction_id, response_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [actorId, idempotencyKey, id, JSON.stringify(response), now]
      )
    );
  }

  return response;
}

/**
 * 独立经济事务包装。alreadyInTx=true 时复用外层事务(不再 BEGIN)。
 */
export function applyEconomyTransaction(
  query: AnyQuery,
  db: DatabaseSync,
  data: ApplyEconomyInput,
  opts?: { alreadyInTx?: boolean }
): ApplyEconomyResult {
  if (opts?.alreadyInTx) {
    return applyEconomySteps(query, data);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = applyEconomySteps(query, data);
    if (!result.ok) {
      db.exec("ROLLBACK");
      return result;
    }
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: (error as Error).message || "economy_transaction_failed",
      status: 500,
    };
  }
}

export type { EconomyAccountRow, EconomyTransactionRow };

/** 列出日常任务(默认仅 active 且未过期) */
export function listDailyTasks(
  query: AnyQuery,
  filter?: { status?: string; includeExpired?: boolean }
): Array<Record<string, unknown>> {
  const status = filter?.status ?? "active";
  const now = Date.now();
  if (filter?.includeExpired) {
    const rows = query(sql(`SELECT * FROM ${TABLE_DAILY} WHERE status = ?`, [status]));
    return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  }
  const rows = query(
    sql(`SELECT * FROM ${TABLE_DAILY} WHERE status = ? AND expires_at > ?`, [status, now])
  );
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export interface SubmitDailyTaskInput {
  actorId: string;
  taskId: string;
  quantity: number;
}

/** 日常任务提交核心(无 BEGIN) */
export function submitDailyTaskSteps(
  query: AnyQuery,
  data: SubmitDailyTaskInput
): TxResult<{
  transactionId: string;
  reward: number;
  balance: number;
  balanceVersion: number;
}> {
  const actorId = data.actorId;
  const taskId = data.taskId;
  const quantity = data.quantity;

  const rows = query(
    sql(
      `SELECT * FROM ${TABLE_DAILY}
       WHERE id = ? AND status = 'active' AND expires_at > ?`,
      [taskId, Date.now()]
    )
  ) as Array<Record<string, unknown>>;
  const task = rows[0];
  if (!task) {
    return { ok: false, error: "task_not_found_or_expired", status: 404 };
  }
  const targetQty = Number(task.target_qty ?? 0);
  const filledQty = Number(task.filled_qty ?? 0);
  const remaining = targetQty - filledQty;
  if (remaining < quantity) {
    return { ok: false, error: "task_quota_exceeded", status: 409, extra: { remaining } };
  }
  const reward = Number(task.unit_reward) * quantity;

  query(sql(`UPDATE ${TABLE_DAILY} SET filled_qty = filled_qty + ? WHERE id = ?`, [quantity, taskId]));

  const result = applyEconomySteps(query, {
    actor_id: actorId,
    transaction_type: "daily_task.reward",
    target_player_id: actorId,
    amount: reward,
    reference_type: "daily_task",
    reference_id: taskId,
    reason: `提交任务 ${task.item_type}*${quantity}`,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status };
  }
  const tgtFinal = economyResult(ensureEconomyAccount(query, actorId, ""));
  return {
    ok: true,
    data: {
      transactionId: result.transactionId,
      reward,
      balance: tgtFinal?.balance ?? 0,
      balanceVersion: tgtFinal?.version ?? 0,
    },
  };
}

/** 日常任务提交包装(可独立事务或嵌入外层 tx) */
export function submitDailyTaskTx(
  query: AnyQuery,
  db: DatabaseSync,
  data: SubmitDailyTaskInput,
  opts?: { alreadyInTx?: boolean }
): TxResult<{
  transactionId: string;
  reward: number;
  balance: number;
  balanceVersion: number;
}> {
  if (opts?.alreadyInTx) {
    return submitDailyTaskSteps(query, data);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = submitDailyTaskSteps(query, data);
    if (!result.ok) {
      db.exec("ROLLBACK");
      return result;
    }
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: (error as Error).message || "task_submit_failed",
      status: 500,
    };
  }
}

/** 月度/全局经济白皮书(优先读 sfmc_economy_stats,否则现场聚合) */
export function monthlyEconomyStats(query: AnyQuery): {
  id: string;
  total_issued: number;
  total_destroyed: number;
  total_supply: number;
  active_accounts: number;
} {
  const now = new Date();
  const id = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const cached = query(sql(`SELECT * FROM ${TABLE_STATS} WHERE id = ? OR id = ?`, ["global", id]));
  if (Array.isArray(cached) && cached.length > 0) {
    const row = cached[0] as Record<string, unknown>;
    return {
      id: String(row.id ?? id),
      total_issued: Number(row.total_issued ?? 0),
      total_destroyed: Number(row.total_destroyed ?? 0),
      total_supply: Number(row.total_supply ?? 0),
      active_accounts: Number(row.active_accounts ?? 0),
    };
  }

  const supplyRows = query(
    sql(`SELECT COALESCE(SUM(balance),0) AS total_supply, COUNT(*) AS active_accounts FROM ${TABLE_ACCOUNTS}`)
  );
  const supply = Array.isArray(supplyRows) ? (supplyRows[0] as Record<string, unknown>) : {};
  const issuedRows = query(
    sql(`SELECT COALESCE(SUM(amount),0) AS total FROM ${TABLE_TRANSACTIONS} WHERE target_player_id IS NOT NULL`)
  );
  const destroyedRows = query(
    sql(`SELECT COALESCE(SUM(amount),0) AS total FROM ${TABLE_TRANSACTIONS} WHERE source_player_id IS NOT NULL`)
  );
  const issued = Array.isArray(issuedRows) ? Number((issuedRows[0] as Record<string, unknown>).total ?? 0) : 0;
  const destroyed = Array.isArray(destroyedRows)
    ? Number((destroyedRows[0] as Record<string, unknown>).total ?? 0)
    : 0;

  return {
    id,
    total_issued: issued,
    total_destroyed: destroyed,
    total_supply: Number(supply.total_supply ?? 0),
    active_accounts: Number(supply.active_accounts ?? 0),
  };
}
