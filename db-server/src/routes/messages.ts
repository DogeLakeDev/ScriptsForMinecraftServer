/**
 * routes/messages.ts — 聊天消息
 */

import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  forwardToQQBridge: (channelId: string, fromName: string, content: string, fromId: string) => void;
}

function createMessagesRoutes({ query, body, json, forwardToQQBridge }: Deps) {
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
    if (path === "/api/sfmc/messages") {
      if (method === "GET") {
        let sql = "SELECT * FROM sfmc_chat_messages WHERE 1=1";
        const values: unknown[] = [];
        const filterMap = [
          { key: "search", sql: " AND (content LIKE ?)", transform: (v: string) => `%${v}%`, repeat: 1 },
          { key: "type", sql: " AND type = ?", transform: (v: string) => v, repeat: 1 },
          { key: "channelId", sql: " AND channel_id = ?", transform: (v: string) => v, repeat: 1 },
          { key: "from", sql: " AND from_id = ?", transform: (v: string) => v, repeat: 1 },
          { key: "minCreatedAt", sql: " AND created_at >= ?", transform: (v: string) => Number(v), repeat: 1 },
          { key: "minSentAt", sql: " AND created_at >= ?", transform: (v: string) => Number(v), repeat: 1 },
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
        json(res, { messages: query(sql, values) });
      } else if (method === "POST") {
        const { messages } = await body(req);
        if (!Array.isArray(messages) || messages.length === 0) {
          json(res, { success: false, error: "invalid" }, 400);
          return true;
        }
        if ((messages as unknown[]).length > 100) {
          json(res, { success: false, error: "too many requests" }, 413);
          return true;
        }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_messages (
            id, channel_id, from_id, from_name, type, content, attachment, show_timestamp, created_at
          ) VALUES ${(messages as unknown[])
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ")}`,
          (messages as Array<Record<string, unknown>>).flatMap((m) => [
            m.id,
            m.channelId,
            m.fromid,
            m.fromName,
            m.type ?? "text",
            m.content,
            m.attachment ?? null,
            m.showTimestamp ? 1 : 0,
            m.timestamp,
          ])
        );
        for (const m of messages as Array<Record<string, unknown>>) {
          forwardToQQBridge(m.channelId as string, m.fromName as string, m.content as string, m.fromid as string);
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

export { createMessagesRoutes };
