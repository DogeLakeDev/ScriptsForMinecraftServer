/**
 * routes/messages.ts — 聊天消息 (sfmc_chat_messages)
 *
 * 路由列表：
 *   GET  /api/sfmc/messages — 模糊/过滤查询消息
 *   POST /api/sfmc/messages — 批量 INSERT OR REPLACE 消息（匹配 bridge 频道时转发至 QQ）
 */

import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  forwardToQQBridge: (channelId: string, fromName: string, content: string, fromId: string) => void;
  /** 当前桥接频道；空则不做 MC→QQ 聊天出站（事件通道不受影响） */
  getBridgeChannelId: () => string;
}

/** 是否应将本条消息推到 QQ 群 */
export function shouldForwardChatToQQ(
  bridgeChannelId: string,
  channelId: string,
  fromId: string
): boolean {
  const bridge = String(bridgeChannelId ?? "").trim();
  if (!bridge) return false;
  if (String(channelId ?? "").trim() !== bridge) return false;
  const fid = String(fromId ?? "").trim();
  // 无发送者 id 不出站（避免解析失败时误推）
  if (!fid) return false;
  // QQ→MC 写入的 fromid 形如 qq_*，禁止回环推群
  if (fid.startsWith("qq_")) return false;
  return true;
}

function createMessagesRoutes({ query, body, json, forwardToQQBridge, getBridgeChannelId }: Deps) {
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
        const stmt = SQL`SELECT * FROM sfmc_chat_messages WHERE 1=1`;
        const search = params.get("search")?.trim();
        if (search) stmt.append(SQL` AND (content LIKE ${`%${search}%`})`);
        const type = params.get("type")?.trim();
        if (type) stmt.append(SQL` AND type = ${type}`);
        const channelId = params.get("channelId")?.trim();
        if (channelId) stmt.append(SQL` AND channel_id = ${channelId}`);
        const from = params.get("from")?.trim();
        if (from) stmt.append(SQL` AND from_id = ${from}`);
        const minCreatedAt = params.get("minCreatedAt")?.trim();
        if (minCreatedAt) stmt.append(SQL` AND created_at >= ${Number(minCreatedAt)}`);
        const minSentAt = params.get("minSentAt")?.trim();
        if (minSentAt) stmt.append(SQL` AND created_at >= ${Number(minSentAt)}`);
        const maxCreatedAt = params.get("maxCreatedAt")?.trim();
        if (maxCreatedAt) stmt.append(SQL` AND created_at <= ${Number(maxCreatedAt)}`);
        stmt.append(SQL` ORDER BY created_at ASC`);
        json(res, { messages: query(stmt) });
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
        // 多行 INSERT 改成循环单条 INSERT OR REPLACE —— 简单优先
        for (const m of messages as Array<Record<string, unknown>>) {
          query(
            SQL`INSERT OR REPLACE INTO sfmc_chat_messages (
                id, channel_id, from_id, from_name, type, content, attachment, show_timestamp, created_at
              ) VALUES (
                ${m.id}, ${m.channelId}, ${m.fromid}, ${m.fromName},
                ${m.type ?? "text"}, ${m.content}, ${m.attachment ?? null},
                ${m.showTimestamp ? 1 : 0}, ${m.timestamp}
              )`
          );
        }
        const bridgeId = getBridgeChannelId();
        for (const m of messages as Array<Record<string, unknown>>) {
          const channelId = String(m.channelId ?? "");
          const fromId = String(m.fromid ?? "");
          if (!shouldForwardChatToQQ(bridgeId, channelId, fromId)) continue;
          forwardToQQBridge(channelId, String(m.fromName ?? ""), String(m.content ?? ""), fromId);
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
