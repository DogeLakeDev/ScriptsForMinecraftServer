/**
 * routes/world.ts — 世界数据
 *
 * 路由列表：
 *   GET  /api/sfmc/world — 读取世界数据
 *   POST /api/sfmc/world — 写入（INSERT OR REPLACE）世界数据
 */

import { SQL } from "sql-template-strings";
import { body, json } from "./_shared.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createWorldRoutes({ query }: Deps) {
  return async function handle({ path, method, req, res }: {
    path: string;
    method: string;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    if (path === "/api/sfmc/world") {
      if (method === "GET") {
        const rows = query(SQL`SELECT * FROM sfmc_world`) as Array<Record<string, unknown>>;
        json(res, { world: rows.length > 0 ? rows[0] : null });
      } else if (method === "POST") {
        const data = (await body(req)).data as Record<string, unknown> | undefined;
        if (!data) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const allowCheats = !!data.allowCheats ? 1 : 0;
        const gameRules = typeof data.gameRules === "string" ? data.gameRules : JSON.stringify(data.gameRules ?? {});
        const seed = String(data.seed ?? "");
        const defaultSpawnLocation = JSON.stringify(data.defaultSpawnLocation ?? null);
        const difficulty = String(data.difficulty ?? "");
        const day = Number.isFinite(Number(data.day)) ? Number(data.day) : 0;
        const tickingAreasCount = Number.isFinite(Number(data.tickingAreasCount)) ? Number(data.tickingAreasCount) : 0;
        const absoluteTime = Number.isFinite(Number(data.absoluteTime)) ? Number(data.absoluteTime) : 0;
        const structuresFromAddon = String(data.structuresFromAddon ?? "");
        const structuresFromWorld = String(data.structuresFromWorld ?? "");
        const dynamicPropertyTotalByteCount = Number.isFinite(Number(data.dynamicPropertyTotalByteCount))
          ? Number(data.dynamicPropertyTotalByteCount)
          : 0;
        const moonPhase = Number.isFinite(Number(data.moonPhase)) ? Number(data.moonPhase) : 0;
        const updatedAt = String(data.updatedAt ?? Date.now());
        query(
          SQL`INSERT OR REPLACE INTO sfmc_world (
              allow_cheats, game_rules, seed, default_spawn_location, difficulty,
              day, ticking_areas_count, absolute_time, structures_from_addon,
              structures_from_world, dynamic_property_total_byte_count, moon_phase, updated_at)
              VALUES (${allowCheats}, ${gameRules}, ${seed}, ${defaultSpawnLocation}, ${difficulty},
                      ${day}, ${tickingAreasCount}, ${absoluteTime}, ${structuresFromAddon},
                      ${structuresFromWorld}, ${dynamicPropertyTotalByteCount}, ${moonPhase}, ${updatedAt})`
        );
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    return false;
  };
}

export { createWorldRoutes };
