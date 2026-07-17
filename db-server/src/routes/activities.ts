/**
 * routes/activities.ts — 行为日志记录与查询
 */

import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createActivitiesRoutes({ query, body, json }: Deps) {
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
    if (path === "/api/sfmc/activities/batch") {
      if (method === "POST") {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
          json(res, { success: false, error: "entries array required" }, 400);
          return true;
        }
        const now = Date.now();
        const insert = `INSERT OR IGNORE INTO sfmc_activities (
          id, timestamp, dimension, source_type, source_id, source_name,
          source_x, source_y, source_z, event_type,
          target_type, target_id, target_name, target_x, target_y, target_z, detail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        for (const e of entries as Array<Record<string, unknown>>) {
          query(insert, [
            e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`,
            e.timestamp || now,
            e.dimension || "",
            e.sourceType || "unknown",
            e.sourceid || "",
            e.sourceName || "",
            e.sourceX ?? null,
            e.sourceY ?? null,
            e.sourceZ ?? null,
            e.eventType || "unknown",
            e.targetType || "",
            e.targetid || "",
            e.targetName || "",
            e.targetX ?? null,
            e.targetY ?? null,
            e.targetZ ?? null,
            typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail ?? {}),
            now,
          ]);
        }
        json(res, { success: true, count: (entries as unknown[]).length });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path === "/api/sfmc/activities/cleanup") {
      if (method === "POST") {
        const { keepDays = 30, keepAdmin = true } = await body(req);
        const cutoff = Date.now() - (keepDays as number) * 86400000;
        if (keepAdmin) {
          const r = query("DELETE FROM sfmc_activities WHERE timestamp < ? AND event_type NOT LIKE ?", [
            cutoff,
            "admin.%",
          ]) as { changes?: number };
          json(res, { success: true, deleted: r.changes || 0 });
        } else {
          const r = query("DELETE FROM sfmc_activities WHERE timestamp < ?", [cutoff]) as {
            changes?: number;
          };
          json(res, { success: true, deleted: r.changes || 0 });
        }
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path === "/api/sfmc/activities/stats") {
      if (method === "GET") {
        const id = params.get("id") || "";
        const from = params.get("from") || "";
        const to = params.get("to") || "";
        let cond = "WHERE 1=1";
        const vals: unknown[] = [];
        if (id) {
          cond += " AND source_id = ?";
          vals.push(id);
        }
        if (from) {
          cond += " AND timestamp >= ?";
          vals.push(parseInt(from));
        }
        if (to) {
          cond += " AND timestamp <= ?";
          vals.push(parseInt(to));
        }
        const totalRow = query(`SELECT COUNT(*) as total FROM sfmc_activities ${cond}`, vals) as Array<{
          total: number;
        }>;
        const byEvent = query(
          `SELECT event_type, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY event_type ORDER BY count DESC`,
          vals
        );
        const byDate = query(
          `SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY date ORDER BY date DESC LIMIT 30`,
          vals
        );
        json(res, { total: totalRow[0]?.total || 0, byEvent, byDate });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    if (path === "/api/sfmc/activities") {
      if (method === "GET") {
        const id = params.get("id") || "";
        const event = params.get("event") || "";
        const from = params.get("from") || "";
        const to = params.get("to") || "";
        const sourceName = params.get("name") || "";
        const limit = Math.min(parseInt(params.get("limit") || "200", 10), 1000);
        const offset = parseInt(params.get("offset") || "0", 10);
        let sql = "SELECT * FROM sfmc_activities WHERE 1=1";
        const vals: unknown[] = [];
        if (id) {
          sql += " AND source_id = ?";
          vals.push(id);
        }
        if (event) {
          sql += " AND event_type = ?";
          vals.push(event);
        }
        if (from) {
          sql += " AND timestamp >= ?";
          vals.push(parseInt(from));
        }
        if (to) {
          sql += " AND timestamp <= ?";
          vals.push(parseInt(to));
        }
        if (sourceName) {
          sql += " AND source_name = ?";
          vals.push(sourceName);
        }
        sql += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
        vals.push(limit, offset);
        const rows = query(sql, vals);
        json(res, { entries: rows, count: (rows as unknown[]).length, limit, offset });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }

    return false;
  };
}

export { createActivitiesRoutes };
