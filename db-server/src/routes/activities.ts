/**
 * routes/activities.ts — 行为日志记录与查询 (sfmc_activities)
 *
 * 路由列表：
 *   POST /api/sfmc/activities/batch    — 批量 INSERT 行为记录(客户端批量推流)
 *   POST /api/sfmc/activities/cleanup  — 删除早于保留天数的行为
 *   GET  /api/sfmc/activities/stats    — 按 source_id / 时间窗统计
 *   GET  /api/sfmc/activities          — 模糊/过滤查询行为记录
 */

import { SQL, type SQLStatement } from "sql-template-strings";
import { raw } from "../lib/sql-helpers.js";
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
        for (const e of entries as Array<Record<string, unknown>>) {
          const id = String(e.id ?? `${now}_${Math.random().toString(36).slice(2, 8)}`);
          const timestamp = Number(e.timestamp ?? now);
          const detail = typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail ?? {});
          query(
            SQL`INSERT OR IGNORE INTO sfmc_activities (
                id, timestamp, dimension, source_type, source_id, source_name,
                source_x, source_y, source_z, event_type,
                target_type, target_id, target_name, target_x, target_y, target_z, detail, created_at
              ) VALUES (${id}, ${timestamp}, ${String(e.dimension ?? "")},
                      ${String(e.sourceType ?? "unknown")}, ${String(e.sourceid ?? "")},
                      ${String(e.sourceName ?? "")},
                      ${Number(e.sourceX ?? 0)}, ${Number(e.sourceY ?? 0)}, ${Number(e.sourceZ ?? 0)},
                      ${String(e.eventType ?? "unknown")},
                      ${String(e.targetType ?? "")}, ${String(e.targetid ?? "")},
                      ${String(e.targetName ?? "")},
                      ${Number(e.targetX ?? 0)}, ${Number(e.targetY ?? 0)}, ${Number(e.targetZ ?? 0)},
                      ${detail}, ${now})`
          );
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
        const r = keepAdmin
          ? query(
              SQL`DELETE FROM sfmc_activities
                  WHERE timestamp < ${cutoff} AND event_type NOT LIKE ${"admin.%"}`
            )
          : query(SQL`DELETE FROM sfmc_activities WHERE timestamp < ${cutoff}`);
        json(res, { success: true, deleted: (r as { changes?: number }).changes || 0 });
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
        /** 用 buildSelect 反复接收前缀并复用 WHERE，避免对 SQLStatement 做
         *  模板插值（sql-template-strings 模板插值会丢失 values 绑定）。 */
        const buildSelect = (prefix: string): SQLStatement => {
          const s = SQL`${raw(prefix)} FROM sfmc_activities WHERE 1=1`;
          if (id) s.append(SQL` AND source_id = ${id}`);
          if (from) s.append(SQL` AND timestamp >= ${parseInt(from)}`);
          if (to) s.append(SQL` AND timestamp <= ${parseInt(to)}`);
          return s;
        };
        const rows = query(buildSelect("SELECT *")) as Array<Record<string, unknown>>;
        const totalRow = query(buildSelect("SELECT COUNT(*) AS total")) as Array<{ total: number }>;
        const byEvent = query(
          buildSelect(`SELECT event_type, COUNT(*) AS count`).append(
            SQL` GROUP BY event_type ORDER BY count DESC`
          )
        );
        const byDate = query(
          buildSelect(
            `SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') AS date, COUNT(*) AS count`
          ).append(SQL` GROUP BY date ORDER BY date DESC LIMIT 30`)
        );
        json(res, { total: totalRow[0]?.total || 0, byEvent, byDate, sampleRows: rows.length });
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
        const stmt = SQL`SELECT * FROM sfmc_activities WHERE 1=1`;
        if (id) stmt.append(SQL` AND source_id = ${id}`);
        if (event) stmt.append(SQL` AND event_type = ${event}`);
        if (from) stmt.append(SQL` AND timestamp >= ${parseInt(from)}`);
        if (to) stmt.append(SQL` AND timestamp <= ${parseInt(to)}`);
        if (sourceName) stmt.append(SQL` AND source_name = ${sourceName}`);
        stmt.append(SQL` ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`);
        const rows = query(stmt);
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

