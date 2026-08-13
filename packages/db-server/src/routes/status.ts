/**
 * routes/status.ts — 只读运维摘要（供 QQ status/online）
 *
 * GET /api/sfmc/status — 公开，无需 Bearer
 */

import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";
import { PROJECT_ROOT } from "../project-root.js";
import { collectSystemStatus, type SystemStatusSnapshot } from "../domain/system-status.js";
import { json, type RouteFactory } from "./_shared.js";

/** 玩家行新鲜度阈值：超过则视为离线快照过期 */
const FRESH_MS = 5 * 60 * 1000;

interface Deps {
  query: QueryFn;
  /** 测试可注入，避免真实探活 */
  collectSystem?: (projectRoot: string) => Promise<SystemStatusSnapshot>;
  projectRoot?: string;
}

function createStatusRoutes({ query, collectSystem, projectRoot }: Deps): ReturnType<RouteFactory> {
  const root = projectRoot ?? PROJECT_ROOT;
  const collect = collectSystem ?? collectSystemStatus;

  return async function handle({ path, method, res }): Promise<boolean> {
    if (path !== "/api/sfmc/status") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    const now = Date.now();
    let world: Record<string, unknown> | null = null;
    let worldUpdatedAt: string | number | null = null;
    try {
      const worlds = query(SQL`SELECT * FROM sfmc_world LIMIT 1`) as Array<Record<string, unknown>>;
      if (worlds.length > 0 && worlds[0]) {
        world = {
          day: worlds[0].day ?? null,
          difficulty: worlds[0].difficulty ?? null,
          absolute_time: worlds[0].absolute_time ?? null,
          moon_phase: worlds[0].moon_phase ?? null,
        };
        worldUpdatedAt = (worlds[0].updated_at as string | number | null) ?? null;
      }
    } catch {
      world = null;
    }

    let players: Array<{ id: string; name: string; updated_at: number }> = [];
    try {
      const rows = query(
        SQL`SELECT id, name, updated_at FROM sfmc_players ORDER BY updated_at DESC LIMIT 64`
      ) as Array<{ id: string; name: string; updated_at: number }>;
      players = rows.map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        updated_at: Number(r.updated_at) || 0,
      }));
    } catch {
      players = [];
    }

    const fresh = players.filter((p) => p.updated_at > 0 && now - p.updated_at <= FRESH_MS);
    const online = fresh.map((p) => ({ id: p.id, name: p.name }));
    const newestPlayer = players[0]?.updated_at ?? 0;
    const updatedAt = Math.max(newestPlayer, typeof worldUpdatedAt === "number" ? worldUpdatedAt : 0) || now;

    let system: SystemStatusSnapshot | null = null;
    try {
      system = await collect(root);
    } catch {
      system = null;
    }

    json(res, {
      online,
      world,
      updatedAt,
      host: system?.host ?? null,
      processes: system
        ? {
            db: system.db,
            bds: system.bds,
          }
        : null,
      source: "sfmc_players/sfmc_world+os",
      note:
        online.length === 0
          ? "暂无新鲜在线数据（需 BDS 同步玩家表，或数据超过 5 分钟）"
          : undefined,
    });
    return true;
  };
}

export { createStatusRoutes, FRESH_MS };
