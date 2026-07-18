/**
 * routes/channels.ts — 聊天频道管理 (sfmc_chat_channels)
 *
 * 路由列表：
 *   GET    /api/sfmc/channels       — 模糊/过滤搜索频道
 *   POST   /api/sfmc/channels       — 批量 INSERT OR REPLACE 频道
 *   GET    /api/sfmc/channels/:id   — 读取单个频道
 *   PUT    /api/sfmc/channels/:id   — 局部更新频道
 *   DELETE /api/sfmc/channels/:id   — 删除单个频道
 */

import { SQL } from "sql-template-strings";
import { raw } from "../lib/sql-helpers.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createChannelsRoutes({ query, body, json }: Deps) {
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
    if (path === "/api/sfmc/channels") {
      if (method === "GET") {
        const stmt = SQL`SELECT * FROM sfmc_chat_channels WHERE 1=1`;
        const search = params.get("search")?.trim();
        if (search) {
          const like = `%${search}%`;
          stmt.append(SQL` AND (name LIKE ${like} OR id LIKE ${like})`);
        }
        const type = params.get("type")?.trim();
        if (type) stmt.append(SQL` AND type = ${type}`);
        const ownerId = params.get("ownerId")?.trim();
        if (ownerId) stmt.append(SQL` AND owner_id = ${ownerId}`);
        const minCreatedAt = params.get("minCreatedAt")?.trim();
        if (minCreatedAt) stmt.append(SQL` AND created_at >= ${Number(minCreatedAt)}`);
        const maxCreatedAt = params.get("maxCreatedAt")?.trim();
        if (maxCreatedAt) stmt.append(SQL` AND created_at <= ${Number(maxCreatedAt)}`);
        stmt.append(SQL` ORDER BY created_at ASC`);
        json(res, { channels: query(stmt) });
      } else if (method === "POST") {
        const { channels } = await body(req);
        if (!Array.isArray(channels) || channels.length === 0) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        if ((channels as unknown[]).length > 90) {
          json(res, { success: false, error: "too many requests" }, 413);
          return true;
        }
        const now = Date.now();
        // 多行 INSERT 改成循环单条 INSERT OR REPLACE —— 简单优先
        for (const ch of channels as Array<Record<string, unknown>>) {
          const cfg = ch.config as Record<string, unknown> | undefined;
          query(
            SQL`INSERT OR REPLACE INTO sfmc_chat_channels (
                id, name, type, prefix, owner_id, created_at,
                config_allow_chat, config_slow_mode, config_is_broadcast, updated_at
              ) VALUES (
                ${String(ch.id ?? "")}, ${String(ch.name ?? "")},
                ${String(ch.type ?? "")}, ${String(ch.prefix ?? "")},
                ${String(ch.ownerId ?? ch.ownerid ?? "")},
                ${Number(ch.createdAt) || now},
                ${Number(ch.configAllowChat ?? (cfg?.allowChat ? 1 : 0)) || 0},
                ${Number(ch.configSlowMode ?? Number(cfg?.slowMode ?? 0)) || 0},
                ${Number(ch.configIsBroadcast ?? (cfg?.isBroadcast ? 1 : 0)) || 0},
                ${now}
              )`
          );
        }
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path.startsWith("/api/sfmc/channels/")) {
      const id = path.slice("/api/sfmc/channels/".length);
      if (!id) {
        json(res, { success: false, error: "missing_id" }, 400);
        return true;
      }
      if (method === "GET") {
        const rows = query(SQL`SELECT * FROM sfmc_chat_channels WHERE id = ${id}`) as unknown[];
        if (rows.length === 0) {
          json(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        json(res, { channel: rows[0] });
      } else if (method === "PUT") {
        const bodyData = await body(req);
        const data = (bodyData.channel as Record<string, unknown> | undefined) ?? (bodyData as Record<string, unknown>);
        if (!data || typeof data !== "object") {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const colMap: Record<string, string> = {
          name: "name",
          prefix: "prefix",
          ownerId: "owner_id",
          ownerid: "owner_id",
          createdAt: "created_at",
          configAllowChat: "config_allow_chat",
          configSlowMode: "config_slow_mode",
          configIsBroadcast: "config_is_broadcast",
        };
        const stmt = SQL`UPDATE sfmc_chat_channels SET updated_at = ${Date.now()}`;
        for (const [jsField, dbCol] of Object.entries(colMap)) {
          if (data[jsField] !== undefined) {
            stmt.append(SQL`, ${raw(dbCol)} = ${data[jsField]}`);
          }
        }
        const cfg = data.config as Record<string, unknown> | undefined;
        if (cfg?.allowChat !== undefined) {
          stmt.append(SQL`, config_allow_chat = ${cfg.allowChat ? 1 : 0}`);
        }
        if (cfg?.slowMode !== undefined) {
          stmt.append(SQL`, config_slow_mode = ${cfg.slowMode}`);
        }
        if (cfg?.isBroadcast !== undefined) {
          stmt.append(SQL`, config_is_broadcast = ${cfg.isBroadcast ? 1 : 0}`);
        }
        stmt.append(SQL` WHERE id = ${id}`);
        query(stmt);
        json(res, { success: true });
      } else if (method === "DELETE") {
        query(SQL`DELETE FROM sfmc_chat_channels WHERE id = ${id}`);
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    return false;
  };
}

export { createChannelsRoutes };
