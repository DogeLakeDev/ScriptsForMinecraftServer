/** GET /api/sfmc/status 与 BDS 实时快照入口。 */

import { collectSystemStatus, type SystemStatusSnapshot } from "../domain/system-status.js";
import { PROJECT_ROOT } from "../project-root.js";
import { body, json, type RouteFactory } from "./_shared.js";

const FRESH_MS = 60_000;

interface LiveSnapshot {
  online: Array<{ name: string }>;
  world: { day: number; difficulty: string };
  updatedAt: number;
}

interface Deps {
  collectSystem?: (projectRoot: string) => Promise<SystemStatusSnapshot>;
  projectRoot?: string;
}

function createStatusRoutes({ collectSystem, projectRoot }: Deps): ReturnType<RouteFactory> {
  const root = projectRoot ?? PROJECT_ROOT;
  const collect = collectSystem ?? collectSystemStatus;
  let live: LiveSnapshot | null = null;

  return async function handle({ path, method, req, res }): Promise<boolean> {
    if (path === "/api/sfmc/status/live") {
      if (method !== "POST") {
        json(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      const data = await body(req);
      const raw = data.players;
      const day = data.day;
      const difficulty = data.difficulty;
      if (
        !Array.isArray(raw) || raw.length > 1000 ||
        !raw.every((name) => typeof name === "string" && name.trim().length > 0 && name.length <= 64) ||
        typeof day !== "number" || !Number.isSafeInteger(day) || day < 0 ||
        typeof difficulty !== "string" || difficulty.length > 32
      ) {
        json(res, { success: false, error: "invalid_live_status" }, 400);
        return true;
      }
      live = {
        online: raw.map((name: string) => ({ name: name.trim() })),
        world: { day, difficulty },
        updatedAt: Date.now(),
      };
      json(res, { success: true });
      return true;
    }

    if (path !== "/api/sfmc/status") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    let system: SystemStatusSnapshot | null = null;
    try {
      system = await collect(root);
    } catch {
      system = null;
    }

    const now = Date.now();
    const bds = system?.bds;
    const bdsAgeMs = typeof bds?.uptimeSec === "number" ? bds.uptimeSec * 1000 : null;
    const snapshot = live;
    const fresh = snapshot !== null &&
      bds?.state === "running" &&
      now - snapshot.updatedAt <= FRESH_MS &&
      (bdsAgeMs === null || now - snapshot.updatedAt <= bdsAgeMs + 2_000);
    const current = fresh ? snapshot : null;

    json(res, {
      online: current?.online ?? [],
      world: current?.world ?? null,
      updatedAt: current?.updatedAt ?? null,
      host: system?.host ?? null,
      processes: system ? { db: system.db, bds: system.bds } : null,
      source: "bds_script_live",
      note: fresh ? undefined : bds?.state === "stopped" ? "服务器未运行" : "等待游戏实时状态同步",
    });
    return true;
  };
}

export { createStatusRoutes, FRESH_MS };
