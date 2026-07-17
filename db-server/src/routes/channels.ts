/**
 * routes/channels.ts — 聊天频道管理
 */

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
        let sql = "SELECT * FROM sfmc_chat_channels WHERE 1=1";
        const values: unknown[] = [];
        const filterMap = [
          { key: "search", sql: " AND (name LIKE ? OR id LIKE ?)", transform: (v: string) => `%${v}%`, repeat: 2 },
          { key: "type", sql: " AND type = ?", transform: (v: string) => v, repeat: 1 },
          { key: "ownerId", sql: " AND owner_id = ?", transform: (v: string) => v, repeat: 1 },
          { key: "minCreatedAt", sql: " AND created_at >= ?", transform: (v: string) => Number(v), repeat: 1 },
          { key: "maxCreatedAt", sql: " AND created_at <= ?", transform: (v: string) => Number(v), repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== "") {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += " ORDER BY created_at ASC";
        json(res, { channels: query(sql, values) });
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
        query(
          `INSERT OR REPLACE INTO sfmc_chat_channels (
            id, name, type, prefix, owner_id, created_at,
            config_allow_chat, config_slow_mode, config_is_broadcast, updated_at
          ) VALUES ${(channels as unknown[])
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ")}`,
          (channels as Array<Record<string, unknown>>).flatMap((ch) => [
            String(ch.id ?? ""),
            String(ch.name ?? ""),
            String(ch.type ?? ""),
            String(ch.prefix ?? ""),
            String(ch.ownerId || ch.ownerid || ""),
            Number(ch.createdAt) || Date.now(),
            Number(ch.configAllowChat ?? (((ch.config as Record<string, unknown>)?.allowChat) ? 1 : 0)) || 0,
            Number(ch.configSlowMode ?? ((ch.config as Record<string, unknown>)?.slowMode || 0)) || 0,
            Number(
              ch.configIsBroadcast ?? (((ch.config as Record<string, unknown>)?.isBroadcast) ? 1 : 0)
            ) || 0,
            Date.now(),
          ])
        );
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
        const rows = query("SELECT * FROM sfmc_chat_channels WHERE id = ?", [id]) as unknown[];
        if (rows.length === 0) {
          json(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        json(res, { channel: rows[0] });
      } else if (method === "PUT") {
        const raw = await body(req);
        const data = (raw.channel as Record<string, unknown> | undefined) ?? (raw as Record<string, unknown>);
        if (!data || typeof data !== "object") {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const sets: string[] = ["updated_at=?"];
        const vals: unknown[] = [Date.now()];
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
        for (const [jsField, dbCol] of Object.entries(colMap)) {
          if (data[jsField] !== undefined) {
            sets.push(`${dbCol}=?`);
            vals.push(data[jsField]);
          }
        }
        const cfg = data.config as Record<string, unknown> | undefined;
        if (cfg?.allowChat !== undefined) {
          sets.push("config_allow_chat=?");
          vals.push(cfg.allowChat ? 1 : 0);
        }
        if (cfg?.slowMode !== undefined) {
          sets.push("config_slow_mode=?");
          vals.push(cfg.slowMode);
        }
        if (cfg?.isBroadcast !== undefined) {
          sets.push("config_is_broadcast=?");
          vals.push(cfg.isBroadcast ? 1 : 0);
        }
        if (sets.length > 1) {
          vals.push(id);
          query(`UPDATE sfmc_chat_channels SET ${sets.join(", ")} WHERE id=?`, vals);
        }
        json(res, { success: true });
      } else if (method === "DELETE") {
        query("DELETE FROM sfmc_chat_channels WHERE id = ?", [id]);
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
