/**
 * routes/scoreboards.ts — 计分板备份
 *
 * 路由列表：
 *   GET  /api/sfmc/scoreboards — 读取全部计分板
 *   POST /api/sfmc/scoreboards — 批量写入(INSERT OR REPLACE)计分板
 */

import { SQL } from "sql-template-strings";
import { body, json } from "./_shared.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createScoreboardsRoutes({ query }: Deps) {
  return async function handle({ path, method, req, res }: {
    path: string;
    method: string;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    if (path === "/api/sfmc/scoreboards") {
      if (method === "GET") {
        json(res, { entries: query(SQL`SELECT * FROM sfmc_scoreboards`) });
      } else if (method === "POST") {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries)) {
          json(res, { success: false, error: "entries array required" }, 400);
          return true;
        }
        const now = Date.now();
        for (const e of entries as Array<Record<string, unknown>>) {
          const objectiveId = String(e.objectiveId ?? e.id ?? "");
          const objectiveDisplay = String(e.objectiveDisplay ?? e.displayName ?? "");
          const participants = JSON.stringify(e.participantIds ?? e.participants ?? []);
          query(
            SQL`INSERT OR REPLACE INTO sfmc_scoreboards
                (objective_id, objective_display, participants, updated_at)
                VALUES (${objectiveId}, ${objectiveDisplay}, ${participants}, ${now})`
          );
        }
        json(res, { success: true, count: (entries as unknown[]).length });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    return false;
  };
}

export { createScoreboardsRoutes };
