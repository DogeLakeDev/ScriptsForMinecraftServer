/**
 * services/economy-handlers.ts — feature-economy 的 7 个 service handler
 *
 * 全部跑在 db-server 进程内,复用 domain/economy.ts。
 * ctx.tx 存在时 alreadyInTx=true,与外层 db.tx 共享同一 SQLite 事务。
 */

import type { DatabaseSync } from "node:sqlite";
import type { QueryFn } from "../lib/sqlite.js";
import { DispatchError, type ServiceRegistry } from "../service-registry.js";
import {
  applyEconomyTransaction,
  getEconomyAccount,
  listDailyTasks,
  monthlyEconomyStats,
  submitDailyTaskTx,
  type AnyQuery,
  type ApplyEconomyResult,
} from "../domain/economy.js";

const MODULE_ID = "feature-economy";

function asObj(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function str(v: unknown, fallback = ""): string {
  return v === undefined || v === null ? fallback : String(v);
}

function num(v: unknown): number {
  return Number(v);
}

/** 领域失败保留 status/code,避免被 registry 压成 500 internal(LSP) */
function unwrapOk(result: ApplyEconomyResult): unknown {
  if (!result.ok) {
    throw new DispatchError(result.error, "domain_error", result.status);
  }
  return {
    transactionId: result.transactionId,
    replayed: result.replayed ?? false,
    source: result.source,
    target: result.target,
    // 方便调用方读单边余额
    balance: result.target?.balanceAfter ?? result.source?.balanceAfter,
    version: result.target?.version ?? result.source?.version,
  };
}

export function registerEconomyHandlers(
  registry: ServiceRegistry,
  deps: { query: QueryFn; db: DatabaseSync }
): void {
  const standaloneQuery = deps.query as unknown as AnyQuery;

  registry.registerHandler(MODULE_ID, "economy.account.get", async (ctx) => {
    const p = asObj(ctx.payload);
    const playerId = str(p.playerId ?? p.player_id);
    if (!playerId) throw new DispatchError("missing_playerId", "domain_error", 400);
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    return getEconomyAccount(q, playerId, str(p.playerName ?? p.player_name));
  });

  registry.registerHandler(MODULE_ID, "economy.account.debit", async (ctx) => {
    const p = asObj(ctx.payload);
    const playerId = str(p.playerId ?? p.player_id ?? p.actorId);
    const amount = num(p.amount);
    if (!playerId) throw new DispatchError("missing_playerId", "domain_error", 400);
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    const db = ctx.tx?.db ?? deps.db;
    const idem = str(p.idempotencyKey ?? p.idempotency_key);
    const result = applyEconomyTransaction(
      q,
      db,
      {
        actorId: playerId,
        sourcePlayerId: playerId,
        sourcePlayerName: str(p.playerName ?? p.player_name),
        amount,
        type: "debit",
        reason: str(p.reason),
        referenceType: str(p.referenceType ?? (p.meta as Record<string, unknown> | undefined)?.type),
        referenceId: str(p.referenceId ?? (p.meta as Record<string, unknown> | undefined)?.redpacketId),
        ...(idem ? { idempotencyKey: idem } : {}),
      },
      { alreadyInTx: !!ctx.tx }
    );
    return unwrapOk(result);
  });

  registry.registerHandler(MODULE_ID, "economy.account.credit", async (ctx) => {
    const p = asObj(ctx.payload);
    const playerId = str(p.playerId ?? p.player_id ?? p.actorId);
    const amount = num(p.amount);
    if (!playerId) throw new DispatchError("missing_playerId", "domain_error", 400);
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    const db = ctx.tx?.db ?? deps.db;
    const idem = str(p.idempotencyKey ?? p.idempotency_key);
    const result = applyEconomyTransaction(
      q,
      db,
      {
        actorId: playerId,
        targetPlayerId: playerId,
        targetPlayerName: str(p.playerName ?? p.player_name),
        amount,
        type: "credit",
        reason: str(p.reason),
        referenceType: str(p.referenceType ?? (p.meta as Record<string, unknown> | undefined)?.type),
        referenceId: str(p.referenceId ?? (p.meta as Record<string, unknown> | undefined)?.redpacketId),
        ...(idem ? { idempotencyKey: idem } : {}),
      },
      { alreadyInTx: !!ctx.tx }
    );
    return unwrapOk(result);
  });

  registry.registerHandler(MODULE_ID, "economy.account.transfer", async (ctx) => {
    const p = asObj(ctx.payload);
    const from =
      str(p.fromPlayerId ?? p.sourcePlayerId ?? p.source_player_id ?? p.actorId ?? p.actor_id) || "";
    const to = str(p.toPlayerId ?? p.targetPlayerId ?? p.target_player_id) || "";
    const amount = num(p.amount);
    if (!from || !to) throw new DispatchError("missing_from_or_to", "domain_error", 400);
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    const db = ctx.tx?.db ?? deps.db;
    const idem = str(p.idempotencyKey ?? p.idempotency_key);
    const result = applyEconomyTransaction(
      q,
      db,
      {
        actorId: from,
        sourcePlayerId: from,
        sourcePlayerName: str(p.fromPlayerName ?? p.sourcePlayerName),
        targetPlayerId: to,
        targetPlayerName: str(p.toPlayerName ?? p.targetPlayerName),
        amount,
        type: "transfer",
        reason: str(p.reason),
        ...(idem ? { idempotencyKey: idem } : {}),
      },
      { alreadyInTx: !!ctx.tx }
    );
    return unwrapOk(result);
  });

  // 信封与 daily-task 消费方对齐:{ tasks: [...] }
  registry.registerHandler(MODULE_ID, "economy.dailyTasks.list", async (ctx) => {
    const p = asObj(ctx.payload);
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    return {
      tasks: listDailyTasks(q, {
        status: str(p.status) || "active",
        includeExpired: Boolean(p.includeExpired),
      }),
    };
  });

  // 信封与 daily-task 消费方对齐:成功/失败都带 ok,业务失败不抛(避免物品已扣却无法走 !ok 退还分支)
  registry.registerHandler(MODULE_ID, "economy.dailyTasks.submit", async (ctx) => {
    const p = asObj(ctx.payload);
    const actorId = str(p.actorId ?? p.playerId ?? p.player_id);
    const taskId = str(p.taskId ?? p.task_id);
    const quantity = num(p.quantity ?? 1);
    if (!actorId || !taskId) {
      return { ok: false, error: "missing_actor_or_task", status: 400 };
    }
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    const db = ctx.tx?.db ?? deps.db;
    const result = submitDailyTaskTx(q, db, { actorId, taskId, quantity }, { alreadyInTx: !!ctx.tx });
    if (!result.ok) {
      return { ok: false, error: result.error, status: result.status };
    }
    return { ok: true, ...result.data };
  });

  registry.registerHandler(MODULE_ID, "economy.stats.monthly", async (ctx) => {
    const q = (ctx.tx?.query as unknown as AnyQuery) ?? standaloneQuery;
    return monthlyEconomyStats(q);
  });
}
