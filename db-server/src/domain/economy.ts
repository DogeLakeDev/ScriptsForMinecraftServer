/**
 * domain/economy.ts — 经济系统业务核心
 *
 * 提供账户 upsert、通用转账事务,以及日常任务奖励事务。
 * 是 land / coop / redpacket 等领域事务的底座 —— 它们都通过
 * applyEconomyTransaction() 写 sfmc_economy_transactions 流水。
 *
 * 事务描述 (Tx*):
 *   - applyEconomyTransaction  原子经济事务(转账 / 调整 / 退款 / 通用入账)
 *                              流程:幂等回放 → ensureAccount → 余额守护 →
 *                                    UPDATE accounts → INSERT tx log (dr/cr) →
 *                                    写 idempotency → COMMIT
 *                              异常时 ROLLBACK,返回 { ok:false, error, status }
 *   - submitDailyTaskTx        提交日常任务(扣减任务剩余量 → 调 applyEconomyTransaction
 *                              发奖 → COMMIT)
 *
 * 领域辅助 (不涉及事务):
 *   - ensureEconomyAccount     upsert 玩家账户(ON CONFLICT DO UPDATE),返回最新行
 *   - economyResult            DB 行 → 业务视图(camelCase 字段)
 *   - EconomyAccountView / ApplyEconomyInput / ApplyEconomyResult  类型定义
 *   - AnyQuery                 query 兼容类型(string / SQLStatement / {sql,values})
 *
 * 字段命名约定：
 *   - DB 列 / SQL 绑定参数: snake_case (actor_id, source_player_id, ...)
 *   - 业务入参 data.*        : 同时接受 snake_case 与 camelCase 别名
 *                             （字段类型 EconomyTransactionRow 在 types/economy.ts 标注）
 */

import type { EconomyAccountRow, EconomyTransactionRow } from "@sfmc/types";
import type { DatabaseSync } from "node:sqlite";
import { SQL, type SQLStatement } from "sql-template-strings";
import { isValidIdempotencyKey } from "../lib/idempotency.js";
import type { TxResult } from "./redpacket.js";

const TABLE_ACCOUNTS = "sfmc_economy_accounts";
const TABLE_TRANSACTIONS = "sfmc_economy_transactions";
const TABLE_IDEMPOTENCY = "sfmc_economy_idempotency";

/** query 兼容格式：string / SQLStatement / { sql, values } */
export type AnyQuery = (
  sql: string | SQLStatement | { sql: string; values?: unknown[] },
  values?: unknown[]
) => unknown[] | { changes: number | bigint };

/** 生成业务 transaction id（dr/cr 后缀在外层加） */
function newTransactionId(now: number): string {
  return `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** EconomyAccountRow → 业务字段 (camelCase) */
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

/**
 * 确保账户存在，返回对应账户最新行。
 * - INSERT 走 ON CONFLICT(player_id) DO UPDATE 保证只在一行上 upsert
 * - 后续 SELECT * 拿到 version/balance 等字段（version 由 DB 自身递增）
 */
export function ensureEconomyAccount(
  query: AnyQuery,
  playerId: string,
  playerName: string
): EconomyAccountRow | undefined {
  const now = Date.now();
  query(
    SQL`INSERT INTO ${TABLE_ACCOUNTS} (player_id, player_name_snapshot, balance, version, created_at, updated_at)
       VALUES (${String(playerId)}, ${String(playerName)}, 0, 1, ${now}, ${now})
       ON CONFLICT(player_id) DO UPDATE SET
         player_name_snapshot = excluded.player_name_snapshot,
         updated_at = excluded.updated_at`
  );
  const rows = query(SQL`SELECT * FROM ${TABLE_ACCOUNTS} WHERE player_id = ${String(playerId)}`);
  if (Array.isArray(rows)) {
    return (rows as EconomyAccountRow[])[0];
  }
  return undefined;
}

/** applyEconomyTransaction 的输入：DB 行字段 + camelCase 业务别名 */
export interface ApplyEconomyInput {
  // snake_case DB 列（types/economy.ts 主推）
  actor_id?: string;
  amount: number;
  transaction_type?: string;
  source_player_id?: string;
  target_player_id?: string;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  idempotency_key?: string;

  // camelCase 业务别名（routes 层仍按 camelCase 喂入）
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

/**
 * 业务结果统一形态：成功 / 失败
 *
 * - `ok: true` 时 transactionId / source / target 都存在
 * - `ok: false` 时 `error` 是错误码，`status` 是 HTTP 状态
 *
 * 成功结果会被序列化到 sfmc_economy_idempotency.response_json 用于回放。
 */
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

/** TxResult 复用 redpacket 定义（避免循环依赖：redpacket 也从 economy 引入） */
export type { TxResult };

/**
 * 原子经济事务（转账 / 调整 / 退款等通用形态）
 *
 * 流程：
 *   1. 验证 amount / actorId / idempotency_key
 *   2. 验证 source/target 关系合法（同账户、forbidden_source 等）
 *   3. BEGIN IMMEDIATE → 若 idempotency_key 命中历史，直接回放
 *   4. ensureEconomyAccount(source / target)
 *   5. balance 校验；UPDATE accounts (带 balance>= 守卫)
 *   6. INSERT INTO sfmc_economy_transactions (dr + cr)
 *   7. 写 idempotency 记录 + COMMIT
 *
 * 任意异常：ROLLBACK + 返回 { ok:false, ... }
 *
 */
export function applyEconomyTransaction(
  query: AnyQuery,
  db: DatabaseSync,
  data: ApplyEconomyInput
): ApplyEconomyResult | undefined {
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

  db.exec("BEGIN IMMEDIATE");
  try {
    // 1) 幂等回放
    if (idempotencyKey) {
      const rows = query(
        SQL`SELECT response_json FROM ${TABLE_IDEMPOTENCY}
            WHERE actor_id = ${actorId} AND idempotency_key = ${idempotencyKey}`
      );
      const previous = Array.isArray(rows) ? (rows as Array<{ response_json: string }>)[0] : undefined;
      if (previous) {
        const replay = { ...JSON.parse(previous.response_json), replayed: true } as ApplyEconomyResult;
        db.exec("COMMIT");
        return replay;
      }
    }

    // 2) 准备 source / target 账户
    const source = sourceId ? ensureEconomyAccount(query, sourceId, String(data.sourcePlayerName ?? "")) : null;
    const target = targetId ? ensureEconomyAccount(query, targetId, String(data.targetPlayerName ?? "")) : null;
    if (sourceId && !source) {
      db.exec("ROLLBACK");
      return { ok: false, error: "source_not_found", status: 404 };
    }
    if (targetId && !target) {
      db.exec("ROLLBACK");
      return { ok: false, error: "target_not_found", status: 404 };
    }

    // 3) 资金校验
    if (source && source.balance < amount) {
      db.exec("ROLLBACK");
      return { ok: false, error: "insufficient_funds", balance: source.balance, status: 409 };
    }

    // 4) 余额变动
    const now = Date.now();
    if (source) {
      query(
        SQL`UPDATE ${TABLE_ACCOUNTS}
            SET balance = balance - ${amount}, version = version + 1, updated_at = ${now}
            WHERE player_id = ${source.player_id} AND balance >= ${amount}`
      );
    }
    if (target) {
      query(
        SQL`UPDATE ${TABLE_ACCOUNTS}
            SET balance = balance + ${amount}, version = version + 1, updated_at = ${now}
            WHERE player_id = ${target.player_id}`
      );
    }

    // 5) 写 transaction log
    const transactionType = String(data.transaction_type ?? data.type ?? "adjustment");
    const referenceType = String(data.reference_type ?? data.referenceType ?? "");
    const referenceId = String(data.reference_id ?? data.referenceId ?? "");
    const reason = String(data.reason ?? data.reasonAlias ?? "");
    const id = newTransactionId(now);

    if (source) {
      query(
        SQL`INSERT INTO ${TABLE_TRANSACTIONS}
            (id, transaction_type, actor_id, source_player_id, target_player_id,
             amount, balance_before, balance_after,
             reference_type, reference_id, reason, created_at)
            VALUES (${id + "-dr"}, ${transactionType + ".dr"}, ${actorId}, ${sourceId}, ${null},
                    ${amount}, ${source.balance}, ${source.balance - amount},
                    ${referenceType}, ${referenceId}, ${reason}, ${now})`
      );
    }
    if (target) {
      query(
        SQL`INSERT INTO ${TABLE_TRANSACTIONS}
            (id, transaction_type, actor_id, source_player_id, target_player_id,
             amount, balance_before, balance_after,
             reference_type, reference_id, reason, created_at)
            VALUES (${id + "-cr"}, ${transactionType + ".cr"}, ${actorId}, ${null}, ${targetId},
                    ${amount}, ${target.balance}, ${target.balance + amount},
                    ${referenceType}, ${referenceId}, ${reason}, ${now})`
      );
    }

    // 6) 重读最新账户视图 (返回给客户端)
    if (!source || !target) return undefined;
    const sourceView = source ? economyResult(ensureEconomyAccount(query, source.player_id, "")) : undefined;
    const targetView = target ? economyResult(ensureEconomyAccount(query, target.player_id, "")) : undefined;

    const response: ApplyEconomyResult = {
      ok: true,
      transactionId: id,
      source: sourceView
        ? { ...sourceView, balanceBefore: source.balance, balanceAfter: source.balance - amount }
        : null,
      target: targetView
        ? { ...targetView, balanceBefore: target.balance, balanceAfter: target.balance + amount }
        : null,
    };

    if (idempotencyKey) {
      query(
        SQL`INSERT INTO ${TABLE_IDEMPOTENCY}
            (actor_id, idempotency_key, transaction_id, response_json, created_at)
            VALUES (${actorId}, ${idempotencyKey}, ${id}, ${JSON.stringify(response)}, ${now})`
      );
    }

    db.exec("COMMIT");
    return response;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failures */
    }
    return {
      ok: false,
      error: (error as Error).message || "economy_transaction_failed",
      status: 500,
    };
  }
}

/** Re-export 业务字段类型，方便 routes 层引用 */
export type { EconomyAccountRow, EconomyTransactionRow };

// ────────────────────────────────────────────────────────────────────────────────
// 以下为新增加的事务域与查询 —— 由 routes/economy.ts 迁出
// ────────────────────────────────────────────────────────────────────────────────

const TABLE_DAILY = "sfmc_economy_daily_tasks";

/** 提交日常任务（事务） */
export function submitDailyTaskTx(
  query: AnyQuery,
  db: DatabaseSync,
  data: { actorId: string; taskId: string; quantity: number }
): TxResult<{
  transactionId: string;
  reward: number;
  balance: number;
  balanceVersion: number;
}> {
  const actorId = data.actorId;
  const taskId = data.taskId;
  const quantity = data.quantity;

  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = query(
      SQL`SELECT * FROM ${TABLE_DAILY}
          WHERE id = ${taskId} AND status = 'active' AND expires_at > ${Date.now()}`
    ) as Array<Record<string, unknown>>;
    const task = rows[0];
    if (!task) {
      db.exec("ROLLBACK");
      return { ok: false, error: "task_not_found_or_expired", status: 404 };
    }
    const targetQty = Number(task.target_qty ?? 0);
    const filledQty = Number(task.filled_qty ?? 0);
    const remaining = targetQty - filledQty;
    if (remaining < quantity) {
      db.exec("ROLLBACK");
      return { ok: false, error: "task_quota_exceeded", status: 409, extra: { remaining } };
    }
    const reward = Number(task.unit_reward) * quantity;

    query(SQL`UPDATE ${TABLE_DAILY} SET filled_qty = filled_qty + ${quantity} WHERE id = ${taskId}`);

    const result = applyEconomyTransaction(query, db, {
      actor_id: actorId,
      transaction_type: "daily_task.reward",
      target_player_id: actorId,
      amount: reward,
      reference_type: "daily_task",
      reference_id: taskId,
      reason: `提交任务 ${task.item_type}*${quantity}`,
    });
    if (!result) {
      db.exec("ROLLBACK");
      return { ok: false, error: "internal_error", status: 500 };
    }
    if (!result.ok) {
      db.exec("ROLLBACK");
      return { ok: false, error: result.error, status: result.status };
    }
    db.exec("COMMIT");
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
