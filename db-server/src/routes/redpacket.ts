/**
 * routes/redpacket.ts — 红包路由（薄层）
 *
 * 所有数据库事务 (BEGIN IMMEDIATE / COMMIT / ROLLBACK) 与 SQL 已全部下沉到
 * domain/redpacket.ts 中的 `createRedpacketTx` / `claimRedpacketTx`。
 * 本文件只负责请求解析、参数校验、调领域函数、序列化响应。
 */

import type { QueryFn } from "../lib/sqlite.js";
import {
  createRedpacketTx,
  claimRedpacketTx,
  listRedpackets,
  findRedpacketById,
  deleteRedpacket,
} from "../domain/redpacket.js";
import { ensureEconomyAccount, economyResult } from "../domain/economy.js";

interface Deps {
  query: QueryFn;
  db: import("node:sqlite").DatabaseSync;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 兼容 index.ts 旧装配 —— 路由层已不再直接使用 */
  ensureEconomyAccount?: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number };
  economyResult?: (account: unknown) => { balance: number; version: number } | null;
}

function createRedpacketRoutes({ query, db, body, json }: Deps) {
  return async function handle({
    path,
    method,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    // 列表 / 创建
    if (path === "/api/sfmc/redpacket") {
      if (method === "GET") {
        json(res, { redpackets: listRedpackets(query) });
        return true;
      }
      if (method === "POST") {
        const data = await body(req);
        const rp = (data.redpacket as Record<string, unknown> | undefined) ?? {};
        // 同步 actorId → senderid 的业务约定
        if (rp.senderid == null && data.actorId != null) rp.senderid = String(data.actorId);
        const result = createRedpacketTx(query as never, db, rp);
        if (!result.ok) {
          const body: Record<string, unknown> = { success: false, error: result.error };
          if (result.extra) Object.assign(body, result.extra);
          json(res, body, result.status);
          return true;
        }
        json(res, { success: true, ...result.data });
        return true;
      }
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    // 单个红包 / 领取
    if (path.startsWith("/api/sfmc/redpacket/")) {
      const tail = path.slice("/api/sfmc/redpacket/".length);
      if (!tail) {
        json(res, { success: false, error: "missing_id" }, 400);
        return true;
      }
      if (method === "GET") {
        const row = findRedpacketById(query, tail);
        if (!row) {
          json(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        json(res, { redpacket: row });
        return true;
      }
      if (method === "POST" && tail.endsWith("/claim")) {
        const packetId = tail.slice(0, -"/claim".length);
        const data = await body(req);
        const actorId = String(data.actorId ?? "");
        const actorName = String(data.actorName ?? "");
        const result = claimRedpacketTx(query as never, db, packetId, actorId, actorName);
        if (!result.ok) {
          const payload: Record<string, unknown> = { success: false, error: result.error };
          if (result.extra) Object.assign(payload, result.extra);
          json(res, payload, result.status);
          return true;
        }
        const account = result.data.account
          ? { balance: result.data.account.balance, version: result.data.account.version }
          : null;
        // 重新拉一次最新账户与 redpacket id
        const refreshed = economyResult(ensureEconomyAccount(query as never, actorId, actorName));
        json(res, {
          success: true,
          amount: result.data.amount,
          transactionId: result.data.transactionId,
          account: account ?? refreshed,
        });
        return true;
      }
      if (method === "PUT") {
        json(res, { success: false, error: "legacy_route_disabled" }, 410);
        return true;
      }
      if (method === "DELETE") {
        deleteRedpacket(query, tail);
        json(res, { success: true });
        return true;
      }
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    return false;
  };
}

export { createRedpacketRoutes };
