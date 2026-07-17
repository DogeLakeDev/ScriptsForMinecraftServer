/**
 * routes/players.ts — 玩家数据
 */

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
        query(`UPDATE sfmc_players SET ${String(field).replace(/:/g, "_")}=?, updated_at=? WHERE id=?`, [
          bind,
          Date.now(),
          playerId,
        ]);
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
            "INSERT OR REPLACE INTO sfmc_players (id, name, active_channel, updated_at) VALUES (?, ?, ?, ?)",
            [p.id || p.playerId, p.name ?? "", p.activeChannel ?? "", now]
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
        let sql = "SELECT * FROM sfmc_players WHERE 1=1";
        const values: unknown[] = [];
        const filterMap = [
          { key: "search", sql: " AND (name LIKE ? OR id LIKE ?)", transform: (v: string) => `%${v}%`, repeat: 2 },
          { key: "name", sql: " AND name LIKE ?", transform: (v: string) => `%${v}%`, repeat: 1 },
          { key: "id", sql: " AND id = ?", transform: (v: string) => v, repeat: 1 },
          { key: "active_channel", sql: " AND active_channel = ?", transform: (v: string) => v, repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== "") {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += " ORDER BY updated_at ASC";
        json(res, { players: query(sql, values) });
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
        const normalizedPlayers = (players as Array<Record<string, unknown>>).map((p) => ({
          ...p,
          id: p.id || p.playerId || "",
          name: p.name || "",
          permission: (p.permission as number) ?? 0,
        } as Record<string, unknown>));
        if (normalizedPlayers.some((p) => !p.id)) {
          json(res, { success: false, error: "player_id_required" }, 400);
          return true;
        }
        query(
          `INSERT OR REPLACE INTO sfmc_players (
            id, name, permission,
            client_system_info_local, client_system_info_maxRenderDistance,
            client_system_info_memoryTier_level, client_system_info_PlatformType,
            graphicsMode, dynamicPropertyTotalByteCount, ping,
            spawnPoint, tags, level, totalXp,
            afk_step, afk_last_location,
            onlinetime_session, onlinetime_today, onlinetime_month, onlinetime_total,
            onlinetime_last_date, onlinetime_last_month, active_channel, subscribed_channels, updated_at
          ) VALUES ${normalizedPlayers.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
          normalizedPlayers.flatMap((p) => [
            p.id,
            p.name,
            p.permission,
            p.clientSystemInfoLocal ?? "",
            p.clientSystemInfoMaxRenderDistance ?? 0,
            p.clientSystemInfoMemoryTier_level ?? 0,
            p.clientSystemInfo_PlatformType ?? "",
            p.graphicsMode ?? "",
            p.dynamicPropertyTotalByteCount ?? 0,
            p.ping ?? 0,
            p.spawnPoint ?? "",
            p.tags ?? "",
            p.level ?? 0,
            p.totalXp ?? 0,
            p.afkStep ?? 0,
            p.afkLastLocation ?? "",
            p.onlinetimeSession ?? 0,
            p.onlinetimeToday ?? 0,
            p.onlinetimeMonth ?? 0,
            p.onlinetimeTotal ?? 0,
            p.onlinetimeLastDate ?? "",
            p.onlinetimeLastMonth ?? "",
            p.activeChannel ?? "",
            p.subscribedChannels ?? "",
            Date.now(),
          ])
        );
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
        const rows = query("SELECT * FROM sfmc_players WHERE id = ?", [id]) as unknown[];
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
          clientSystemInfoMaxRenderDistance: "client_system_info_max_render_distance",
          clientSystemInfoMemoryTierLevel: "client_system_info_memory_tier_level",
          clientSystemInfoPlatformType: "client_system_info_platform_type",
          graphicsMode: "graphics_mode",
          dynamicPropertyTotalByteCount: "dynamic_property_total_byte_count",
          ping: "ping",
          spawnPoint: "spawn_point",
          tags: "tags",
          level: "level",
          totalXp: "total_xp",
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
        const sets: string[] = ["updated_at=?"];
        const vals: unknown[] = [Date.now()];
        for (const [jsField, dbCol] of Object.entries(FIELD_MAP)) {
          if ((player as Record<string, unknown>)[jsField] !== undefined) {
            sets.push(`${dbCol}=?`);
            vals.push((player as Record<string, unknown>)[jsField]);
          }
        }
        if (sets.length > 1) {
          vals.push(id);
          query(`UPDATE sfmc_players SET ${sets.join(", ")} WHERE id=?`, vals);
        }
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
