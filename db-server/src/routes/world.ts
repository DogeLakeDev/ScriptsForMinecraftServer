/**
 * routes/world.ts — 世界数据
 */

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
        const rows = query("SELECT * FROM sfmc_world") as Array<Record<string, unknown>>;
        json(res, { world: rows.length > 0 ? rows[0] : null });
      } else if (method === "POST") {
        const data = (await body(req)).data as Record<string, unknown> | undefined;
        if (!data) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        const world = {
          allowCheats: !!data.allowCheats,
          gameRules: typeof data.gameRules === "string" ? data.gameRules : JSON.stringify(data.gameRules ?? {}),
          seed: String(data.seed ?? ""),
          defaultSpawnLocation: data.defaultSpawnLocation ?? null,
          difficulty: String(data.difficulty ?? ""),
          day: Number.isFinite(Number(data.day)) ? Number(data.day) : 0,
          tickingAreasCount: Number.isFinite(Number(data.tickingAreasCount)) ? Number(data.tickingAreasCount) : 0,
          absoluteTime: Number.isFinite(Number(data.absoluteTime)) ? Number(data.absoluteTime) : 0,
          structuresFromAddon: String(data.structuresFromAddon ?? ""),
          structuresFromWorld: String(data.structuresFromWorld ?? ""),
          dynamicPropertyTotalByteCount: Number.isFinite(Number(data.dynamicPropertyTotalByteCount))
            ? Number(data.dynamicPropertyTotalByteCount)
            : 0,
          moonPhase: Number.isFinite(Number(data.moonPhase)) ? Number(data.moonPhase) : 0,
          updatedAt: String(data.updatedAt ?? Date.now()),
        };
        query(
          `INSERT OR REPLACE INTO sfmc_world (
            allow_cheats, game_rules, seed, default_spawn_location, difficulty,
            day, ticking_areas_count, absolute_time, structures_from_addon,
            structures_from_world, dynamic_property_total_byte_count, moon_phase, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            world.allowCheats ? 1 : 0,
            world.gameRules,
            world.seed,
            JSON.stringify(world.defaultSpawnLocation),
            world.difficulty,
            world.day,
            world.tickingAreasCount,
            world.absoluteTime,
            world.structuresFromAddon,
            world.structuresFromWorld,
            world.dynamicPropertyTotalByteCount,
            world.moonPhase,
            world.updatedAt,
          ]
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
