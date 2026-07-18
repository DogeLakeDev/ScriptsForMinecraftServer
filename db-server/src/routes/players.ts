/**
 * routes/players.ts — 玩家数据 (sfmc_players)
 *
 * 路由列表：
 *   GET  /api/sfmc/players                                  — 模糊搜索/过滤玩家列表
 *   POST /api/sfmc/players                                  — 批量写入/替换玩家记录
 *   POST /api/sfmc/players/saveField                        — 写入单个字段（动态列名）
 *   POST /api/sfmc/players/saveAll                          — 批量 saveField 形式
 *   GET  /api/sfmc/players/:id                              — 读取单个玩家
 *   PUT  /api/sfmc/players/:id                              — 局部更新玩家字段
 */

import { SQL } from "sql-template-strings";
import { raw } from "../lib/sql-helpers.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createPlayersRoutes({ query, body, json }: Deps) {
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
    if (path === "/api/sfmc/players/saveField") {
      if (method === "POST") {
        const { playerId, field, value } = await body(req);
        if (!playerId || !field) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const bind = typeof value === "object" && value !== null ? JSON.stringify(value) : value;
        const colName = String(field).replace(/:/g, "_");
        // 列名经受控映射(只把 ":" 替换为 "_"),通过 raw() 注入是安全的
        query(
          SQL`UPDATE sfmc_players
              SET ${raw(colName)} = ${bind}, updated_at = ${Date.now()}
              WHERE id = ${String(playerId)}`
        );
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path === "/api/sfmc/players/saveAll") {
      if (method === "POST") {
        const { players } = await body(req);
        if (!Array.isArray(players)) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const now = Date.now();
        for (const p of players as Array<Record<string, unknown>>) {
          query(
            SQL`INSERT OR REPLACE INTO sfmc_players (id, name, active_channel, updated_at)
                VALUES (${String(p.id ?? p.playerId ?? "")}, ${String(p.name ?? "")},
                        ${String(p.activeChannel ?? "")}, ${now})`
          );
        }
        json(res, { success: true, count: (players as unknown[]).length });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path === "/api/sfmc/players") {
      if (method === "GET") {
        const stmt = SQL`SELECT * FROM sfmc_players WHERE 1=1`;
        const search = params.get("search")?.trim();
        if (search) {
          const like = `%${search}%`;
          stmt.append(SQL` AND (name LIKE ${like} OR id LIKE ${like})`);
        }
        const name = params.get("name")?.trim();
        if (name) stmt.append(SQL` AND name LIKE ${`%${name}%`}`);
        const id = params.get("id")?.trim();
        if (id) stmt.append(SQL` AND id = ${id}`);
        const activeChannel = params.get("active_channel")?.trim();
        if (activeChannel) stmt.append(SQL` AND active_channel = ${activeChannel}`);
        stmt.append(SQL` ORDER BY updated_at ASC`);
        json(res, { players: query(stmt) });
      } else if (method === "POST") {
        const { players } = await body(req);
        if (!Array.isArray(players) || players.length === 0) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        if ((players as unknown[]).length > 110) {
          json(res, { success: false, error: "too many requests" }, 413);
          return true;
        }
        // 单条 INSERT OR REPLACE 循环。createQuery 内部按 SQL 缓存 StatementSync，重复语句开销低。
        for (const p of players as Array<Record<string, unknown>>) {
          const id = String(p.id ?? p.playerId ?? "");
          if (!id) {
            json(res, { success: false, error: "player_id_required" }, 400);
            return true;
          }
          query(
            SQL`INSERT OR REPLACE INTO sfmc_players (
                id, name, permission,
                client_system_info_local, client_system_info_maxRenderDistance,
                client_system_info_memoryTier_level, client_system_info_PlatformType,
                graphicsMode, dynamicPropertyTotalByteCount, ping,
                spawnPoint, tags, level, totalXp,
                afk_step, afk_last_location,
                onlinetime_session, onlinetime_today, onlinetime_month, onlinetime_total,
                onlinetime_last_date, onlinetime_last_month, active_channel, subscribed_channels, updated_at
              ) VALUES (
                ${id},
                ${String(p.name ?? "")},
                ${Number(p.permission ?? 0)},
                ${String(p.clientSystemInfoLocal ?? "")},
                ${Number(p.clientSystemInfoMaxRenderDistance ?? 0)},
                ${Number(p.clientSystemInfoMemoryTier_level ?? 0)},
                ${String(p.clientSystemInfo_PlatformType ?? "")},
                ${String(p.graphicsMode ?? "")},
                ${Number(p.dynamicPropertyTotalByteCount ?? 0)},
                ${Number(p.ping ?? 0)},
                ${String(p.spawnPoint ?? "")},
                ${String(p.tags ?? "")},
                ${Number(p.level ?? 0)},
                ${Number(p.totalXp ?? 0)},
                ${Number(p.afkStep ?? 0)},
                ${String(p.afkLastLocation ?? "")},
                ${Number(p.onlinetimeSession ?? 0)},
                ${Number(p.onlinetimeToday ?? 0)},
                ${Number(p.onlinetimeMonth ?? 0)},
                ${Number(p.onlinetimeTotal ?? 0)},
                ${String(p.onlinetimeLastDate ?? "")},
                ${String(p.onlinetimeLastMonth ?? "")},
                ${String(p.activeChannel ?? "")},
                ${String(p.subscribedChannels ?? "")},
                ${Date.now()}
              )`
          );
        }
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path.startsWith("/api/sfmc/players/")) {
      const id = path.slice("/api/sfmc/players/".length);
      if (!id) {
        json(res, { success: false, error: "invalid" }, 400);
        return true;
      }
      if (method === "GET") {
        const rows = query(SQL`SELECT * FROM sfmc_players WHERE id = ${id}`) as unknown[];
        if (rows.length === 0) {
          json(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        json(res, { player: rows[0] });
      } else if (method === "PUT") {
        const { player } = await body(req);
        if (!player || typeof player !== "object") {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const FIELD_MAP: Record<string, string> = {
          permission: "permission",
          clientSystemInfoLocal: "client_system_info_local",
          clientSystemInfoMaxRenderDistance: "client_system_info_maxRenderDistance",
          clientSystemInfoMemoryTierLevel: "client_system_info_memoryTier_level",
          clientSystemInfoPlatformType: "client_system_info_PlatformType",
          graphicsMode: "graphicsMode",
          dynamicPropertyTotalByteCount: "dynamicPropertyTotalByteCount",
          ping: "ping",
          spawnPoint: "spawnPoint",
          tags: "tags",
          level: "level",
          totalXp: "totalXp",
          afkStep: "afk_step",
          afkLastLocation: "afk_last_location",
          onlinetimeSession: "onlinetime_session",
          onlinetimeToday: "onlinetime_today",
          onlinetimeMonth: "onlinetime_month",
          onlinetimeTotal: "onlinetime_total",
          onlinetimeLastDate: "onlinetime_last_date",
          onlinetimeLastMonth: "onlinetime_last_month",
          activeChannel: "active_channel",
          subscribedChannels: "subscribed_channels",
        };
        const stmt = SQL`UPDATE sfmc_players SET updated_at = ${Date.now()}`;
        for (const [jsField, dbCol] of Object.entries(FIELD_MAP)) {
          const v = (player as Record<string, unknown>)[jsField];
          if (v !== undefined) {
            stmt.append(SQL`, ${raw(dbCol)} = ${v}`);
          }
        }
        stmt.append(SQL` WHERE id = ${id}`);
        query(stmt);
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    return false;
  };
}

export { createPlayersRoutes };
