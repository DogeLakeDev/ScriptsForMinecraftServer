/**
 * routes/economy.ts — 经济系统 HTTP 路由
 *
 * 业务核心 (applyEconomyTransaction / economyResult / ensureEconomyAccount)
 * 已搬到 domain/economy.ts，本文件只负责请求 → 领域函数 → 响应 的桥接。
 *
 * 路由列表：
 *   GET  /api/sfmc/economy/account           — 查账户
 *   POST /api/sfmc/economy/account           — 应用一笔经济事务
 *   POST /api/sfmc/economy/transfer          — 转账（source=actor）
 *   GET  /api/sfmc/economy/transactions      — 玩家最近 100 条 transaction
 *   GET  /api/sfmc/economy/price-index       — 物价格表
 *   POST /api/sfmc/economy/price-index       — 写入/更新物价格
 *   POST /api/sfmc/economy/price-index/recalc — 重算周获取上限
 *   GET  /api/sfmc/economy/daily-tasks       — 列出活跃日常任务
 *   POST /api/sfmc/economy/daily-tasks       — 新建日常任务
 *   POST /api/sfmc/economy/daily-tasks/:id/submit — 提交任务 → 奖励
 *   GET  /api/sfmc/economy/command-usage     — 指令每日计数
 *   POST /api/sfmc/economy/command-usage     — 指令每日计数 +1
 *   GET  /api/sfmc/economy/stats/monthly     — 月度统计
 */

import type { DatabaseSync } from "node:sqlite";
import { SQL } from "sql-template-strings";
import type { AnyQuery, ApplyEconomyInput } from "../domain/economy.js";
import {
  applyEconomyTransaction,
  economyResult,
  ensureEconomyAccount,
  submitDailyTaskTx,
} from "../domain/economy.js";
import { body, json } from "./_shared.js";

const TABLE_TX = "sfmc_economy_transactions";
const TABLE_PRICE = "sfmc_economy_price_index";
const TABLE_DAILY = "sfmc_economy_daily_tasks";
const TABLE_STATS = "sfmc_economy_stats";
const TABLE_CMD = "sfmc_player_command_usage";

interface EconomyDeps {
  query: AnyQuery;
  db: DatabaseSync;
}

export function createEconomyRoutes(deps: EconomyDeps) {
  const { query, db } = deps;
  function okBody<T extends { ok: boolean; status?: number }>(
    res: import("http").ServerResponse,
    result: T | undefined
  ): void {
    if (!result) {
      json(res, { ok: false, error: "internal_error" }, 500);
      return;
    }
    const status = result.ok ? 200 : (result.status ?? 400);
    json(res, result, status);
  }

  return async function handle({
    path,
    method,
    params,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    // ───────── /api/sfmc/economy/account ─────────
    if (path === "/api/sfmc/economy/account") {
      if (method === "GET") {
        const playerId = params.get("playerId") ?? "";
        if (!playerId) {
          okBody(res, { ok: false, status: 400, error: "missing_player_id" });
          return true;
        }
        const account = economyResult(ensureEconomyAccount(query, playerId, params.get("playerName") ?? ""));
        okBody(res, { ok: true, account });
        return true;
      }
      if (method === "POST") {
        const data = (await body(req)) as unknown as ApplyEconomyInput;
        const result = applyEconomyTransaction(query, db, data);
        okBody(res, result);
        return true;
      }
      okBody(res, { ok: false, status: 404, error: "not_found" });
      return true;
    }

    // ───────── /api/sfmc/economy/transfer ─────────
    if (path === "/api/sfmc/economy/transfer" && method === "POST") {
      const data = (await body(req)) as unknown as ApplyEconomyInput;
      // 业务约定：转账必须 source=actor、target 提供明确 ID
      const payload: ApplyEconomyInput = {
        ...data,
        transaction_type: "transfer",
      };
      if (data.actorId != null) payload["source_player_id"] = String(data.actorId);
      if (data.targetPlayerId != null) payload["target_player_id"] = String(data.targetPlayerId);
      const result = applyEconomyTransaction(query, db, payload);
      okBody(res, result);
      return true;
    }

    // ───────── /api/sfmc/economy/transactions ─────────
    if (path === "/api/sfmc/economy/transactions" && method === "GET") {
      const playerId = params.get("playerId") ?? "";
      if (!playerId) {
        okBody(res, { ok: false, status: 400, error: "missing_player_id" });
        return true;
      }
      const transactions = query(
        SQL`SELECT * FROM ${TABLE_TX}
            WHERE source_player_id = ${playerId} OR target_player_id = ${playerId}
            ORDER BY created_at DESC LIMIT 100`
      );
      json(res, { transactions });
      return true;
    }

    // ───────── /api/sfmc/economy/price-index ─────────
    if (path === "/api/sfmc/economy/price-index") {
      if (method === "GET") {
        const items = query(SQL`SELECT * FROM ${TABLE_PRICE} ORDER BY rarity, item_type`);
        okBody(res, { ok: true, status: 200, items });
        return true;
      }
      if (method === "POST") {
        const data = (await body(req)) as Record<string, unknown>;
        if (!data.actorId) {
          okBody(res, { ok: false, status: 403, error: "forbidden" });
          return true;
        }
        if (!data.item_type || data.base_buy_price === undefined) {
          json(res, { ok: false, error: "invalid_params" }, 400);
          return true;
        }
        const itemAux = Number(data.item_aux ?? 0);
        const baseBuy = Number(data.base_buy_price);
        const baseSell = data.base_sell_price != null ? Number(data.base_sell_price) : baseBuy;
        const currentBuy = data.current_buy_price != null ? Number(data.current_buy_price) : baseBuy;
        const currentSell = data.current_sell_price != null ? Number(data.current_sell_price) : baseSell;
        const elasticity = data.elasticity != null ? Number(data.elasticity) : 0.3;
        const isRenewable = data.is_renewable === undefined ? 1 : Number(data.is_renewable) ? 1 : 0;
        const weeklyCap = data.weekly_acquisition_cap == null ? null : Number(data.weekly_acquisition_cap);
        const rarity = String(data.rarity ?? "common");
        const now = Date.now();

        query(
          SQL`INSERT INTO ${TABLE_PRICE}
              (item_type, item_aux, base_buy_price, base_sell_price,
               current_buy_price, current_sell_price, elasticity,
               weekly_acquisition_cap, rarity, is_renewable, updated_at)
              VALUES (${String(data.item_type)}, ${itemAux},
                      ${baseBuy}, ${baseSell},
                      ${currentBuy}, ${currentSell},
                      ${elasticity}, ${weeklyCap},
                      ${rarity}, ${isRenewable}, ${now})
              ON CONFLICT(item_type, item_aux) DO UPDATE SET
                base_buy_price = excluded.base_buy_price,
                base_sell_price = excluded.base_sell_price,
                current_buy_price = excluded.current_buy_price,
                current_sell_price = excluded.current_sell_price,
                elasticity = excluded.elasticity,
                weekly_acquisition_cap = excluded.weekly_acquisition_cap,
                rarity = excluded.rarity,
                is_renewable = excluded.is_renewable,
                updated_at = excluded.updated_at`
        );
        okBody(res, { ok: true });
        return true;
      }
      json(res, { ok: false, error: "not_found" }, 404);
      return true;
    }

    // ───────── /api/sfmc/economy/price-index/recalc ─────────
    if (path === "/api/sfmc/economy/price-index/recalc" && method === "POST") {
      const data = (await body(req)) as Record<string, unknown>;
      if (!data.actorId) {
        json(res, { ok: false, error: "forbidden" }, 403);
        return true;
      }
      const now = Date.now();
      const weekStart = now - (now % 604800000);
      const rows = query(SQL`SELECT * FROM ${TABLE_PRICE}`) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const weekStartDb = Number(row.week_start ?? 0);
        const acquired = weekStartDb < weekStart ? 0 : Number(row.weekly_acquired ?? 0);
        const ratio = row.weekly_acquisition_cap ? acquired / Number(row.weekly_acquisition_cap) : 0;
        const elasticity = Number(row.elasticity ?? 0.3);
        const newBuyPrice = Math.max(1, Math.floor(Number(row.base_buy_price) * (1 + elasticity * (1 - ratio))));
        const newSellPrice = Math.max(1, Math.floor(Number(row.base_sell_price) * (1 + elasticity * (1 - ratio))));
        const resetAcquired = weekStartDb < weekStart ? 0 : acquired;
        query(
          SQL`UPDATE ${TABLE_PRICE}
              SET current_buy_price = ${newBuyPrice},
                  current_sell_price = ${newSellPrice},
                  weekly_acquired = ${resetAcquired},
                  week_start = ${weekStart},
                  updated_at = ${now}
              WHERE item_type = ${String(row.item_type)} AND item_aux = ${Number(row.item_aux ?? 0)}`
        );
      }
      json(res, { ok: true, updated: rows.length });
      return true;
    }

    // ───────── /api/sfmc/economy/daily-tasks ─────────
    if (path === "/api/sfmc/economy/daily-tasks") {
      if (method === "GET") {
        const tasks = query(
          SQL`SELECT * FROM ${TABLE_DAILY}
              WHERE status = 'active' AND expires_at > ${Date.now()}
              ORDER BY created_at ASC`
        );
        json(res, { tasks });
        return true;
      }
      if (method === "POST") {
        const data = (await body(req)) as Record<string, unknown>;
        if (!data.actorId) {
          json(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        if (!data.item_type || !data.target_qty || !data.unit_reward) {
          json(res, { ok: false, error: "invalid_params" }, 400);
          return true;
        }
        const id = `DT${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const itemAux = Number(data.item_aux ?? 0);
        const targetQty = Number(data.target_qty);
        const unitReward = Number(data.unit_reward);
        const expiresAt = Number(data.expires_at ?? Date.now() + 86400000);
        const now = Date.now();
        query(
          SQL`INSERT INTO ${TABLE_DAILY}
              (id, item_type, item_aux, target_qty, unit_reward, created_at, expires_at, status)
              VALUES (${id}, ${String(data.item_type)}, ${itemAux},
                      ${targetQty}, ${unitReward}, ${now}, ${expiresAt}, 'active')`
        );
        json(res, { ok: true, id });
        return true;
      }
      json(res, { ok: false, error: "not_found" }, 404);
      return true;
    }

    // ───────── /api/sfmc/economy/daily-tasks/:taskId/submit ─────────
    if (path.startsWith("/api/sfmc/economy/daily-tasks/") && method === "POST") {
      const rest = path.slice("/api/sfmc/economy/daily-tasks/".length);
      if (!rest.endsWith("/submit")) {
        json(res, { ok: false, error: "not_found" }, 404);
        return true;
      }
      const taskId = rest.slice(0, -"/submit".length);
      if (!taskId) {
        json(res, { ok: false, error: "not_found" }, 404);
        return true;
      }
      const data = (await body(req)) as Record<string, unknown>;
      const actorId = String(data.actorId ?? "").trim();
      const quantity = parseInt(String(data.quantity ?? ""), 10) || 0;
      if (!actorId || quantity <= 0) {
        json(res, { ok: false, error: "invalid_params" }, 400);
        return true;
      }
      // 业务核心已搬到 domain/economy.ts 的 submitDailyTaskTx
      const result = submitDailyTaskTx(query, db, { actorId, taskId, quantity });
      if (!result.ok) {
        const body: Record<string, unknown> = { ok: false, error: result.error };
        if (result.extra) Object.assign(body, result.extra);
        json(res, body, result.status);
        return true;
      }
      json(res, { ok: true, ...result.data });
      return true;
    }

    // ───────── /api/sfmc/economy/command-usage ─────────
    if (path === "/api/sfmc/economy/command-usage") {
      if (method === "GET") {
        const playerId = params.get("playerId") ?? "";
        const command = params.get("command") ?? "";
        const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
        if (!playerId || !command) {
          json(res, { ok: false, error: "missing_params" }, 400);
          return true;
        }
        const rows = query(
          SQL`SELECT count FROM ${TABLE_CMD}
              WHERE player_id = ${playerId} AND command = ${command} AND date = ${date}`
        ) as Array<{ count: number }>;
        json(res, { ok: true, usage: rows[0]?.count ?? 0 });
        return true;
      }
      if (method === "POST") {
        const data = (await body(req)) as Record<string, unknown>;
        const playerId = String(data.playerId ?? "").trim();
        const command = String(data.command ?? "").trim();
        const date = String(data.date ?? new Date().toISOString().slice(0, 10));
        if (!playerId || !command) {
          json(res, { ok: false, error: "missing_params" }, 400);
          return true;
        }
        query(
          SQL`INSERT INTO ${TABLE_CMD} (player_id, command, date, count)
              VALUES (${playerId}, ${command}, ${date}, 1)
              ON CONFLICT(player_id, command, date) DO UPDATE SET count = count + 1`
        );
        json(res, { ok: true });
        return true;
      }
      json(res, { ok: false, error: "not_found" }, 404);
      return true;
    }

    // ───────── /api/sfmc/economy/stats/monthly ─────────
    if (path === "/api/sfmc/economy/stats/monthly" && method === "GET") {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const existingRows = query(SQL`SELECT * FROM ${TABLE_STATS} WHERE id = ${monthKey}`) as Array<
        Record<string, unknown>
      >;
      const existing = existingRows[0];
      if (existing) {
        json(res, { ok: true, stats: existing });
        return true;
      }
      const totalIssuedRows = query(
        SQL`SELECT COALESCE(SUM(amount), 0) AS total FROM ${TABLE_TX}
            WHERE transaction_type NOT LIKE '%.dr'
              AND transaction_type NOT IN ('land.refund', 'coop.shop.sell', 'daily_task.reward')
              AND source_player_id IS NOT NULL`
      ) as Array<{ total: number }>;
      const totalDestroyedRows = query(
        SQL`SELECT COALESCE(SUM(amount), 0) AS total FROM ${TABLE_TX}
            WHERE transaction_type NOT LIKE '%.cr'
              AND transaction_type NOT IN ('land.purchase', 'coop.shop.buy')
              AND target_player_id IS NULL`
      ) as Array<{ total: number }>;
      const totalSupplyRows = query(
        SQL`SELECT COALESCE(SUM(balance), 0) AS total FROM sfmc_economy_accounts`
      ) as Array<{ total: number }>;
      const activeAccountsRows = query(
        SQL`SELECT COUNT(*) AS count FROM sfmc_economy_accounts WHERE balance > 0`
      ) as Array<{ count: number }>;

      const stats = {
        id: monthKey,
        total_issued: Number(totalIssuedRows[0]?.total ?? 0),
        total_destroyed: Number(totalDestroyedRows[0]?.total ?? 0),
        total_supply: Number(totalSupplyRows[0]?.total ?? 0),
        active_accounts: Number(activeAccountsRows[0]?.count ?? 0),
        computed_at: Date.now(),
      };
      query(
        SQL`INSERT INTO ${TABLE_STATS}
            (id, total_issued, total_destroyed, total_supply, active_accounts, computed_at)
            VALUES (${monthKey}, ${stats.total_issued}, ${stats.total_destroyed},
                    ${stats.total_supply}, ${stats.active_accounts}, ${stats.computed_at})
            ON CONFLICT(id) DO UPDATE SET
              total_issued = excluded.total_issued,
              total_destroyed = excluded.total_destroyed,
              total_supply = excluded.total_supply,
              active_accounts = excluded.active_accounts,
              computed_at = excluded.computed_at`
      );
      json(res, { ok: true, stats });
      return true;
    }

    return false;
  };
}

