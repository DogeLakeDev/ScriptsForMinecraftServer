/**
 * routes/messages.ts — 聊天消息 (sfmc_chat_messages)
 *
 * 路由列表：
 *   GET  /api/sfmc/messages — 模糊/过滤查询消息
 *   POST /api/sfmc/messages — 批量 INSERT OR REPLACE 消息（按频道开关转发至 QQ）
 */

import { SQL } from "sql-template-strings";
import { log } from "../lib/log.js";
import type { QueryFn } from "../lib/sqlite.js";

/** 频道上与 QQ 互通相关的列。游戏发言出站和 QQ 入站都读这份结构。 */
export interface ChatChannelQQFlags {
  id?: string;
  prefix: string;
  forward_to_qq: number;
  source_game?: number;
  source_qq?: number;
  source_system?: number;
  /** 私聊不提供转发开关，提交后的出站要跳过。 */
  type?: string;
}

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  forwardToQQBridge: (channelId: string, prefix: string, fromName: string, content: string, fromId: string) => void;
  /** 查询来源频道的前缀和 QQ 转发开关。 */
  getChannelForQQ: (channelId: string) => ChatChannelQQFlags | null;
  /** 消息来源为 QQ 的频道。入站不看请求里的频道 id。 */
  listQQSourceChannels: () => ChatChannelQQFlags[];
}

/** 是否应将本条消息推到 QQ 群 */
export function shouldForwardChatToQQ(
  channel: { forward_to_qq: number } | null,
  fromId: string
): boolean {
  if (!channel || channel.forward_to_qq !== 1) return false;
  const fid = String(fromId ?? "").trim();
  // 无发送者 id 不出站（避免解析失败时误推）
  if (!fid) return false;
  // QQ→MC 写入的 fromid 形如 qq_*，禁止回环推群
  if (fid.startsWith("qq_")) return false;
  return true;
}

/**
 * 只保留消息来源为 QQ 的频道。
 * 使用场景：QQ 入站扇出，不使用桥接请求里写死的频道 id。
 */
export function channelsAcceptingQQ<T extends { source_qq?: number }>(channels: T[]): T[] {
  return channels.filter((channel) => channel.source_qq === 1);
}

/**
 * 游戏侧 db.tx 插入的聊天行是否要转发到 QQ。
 * 字段名是蛇形（from_id / channel_id），与 /api/sfmc/messages 的驼峰载荷不同。
 */
export function gameChatForwardPayload(
  row: Record<string, unknown>,
  channel: ChatChannelQQFlags | null,
): {
  channelId: string;
  prefix: string;
  fromName: string;
  content: string;
  fromId: string;
} | null {
  const channelId = String(row.channel_id ?? row.channelId ?? "").trim();
  const fromId = String(row.from_id ?? row.fromid ?? "");
  // 广播 / SYS 不是玩家发言。私聊没有转发开关，避免旧数据把私聊推到群里。
  if (fromId === "system" || fromId === "SYSTEM" || channel?.type === "private") return null;
  if (!channelId || !shouldForwardChatToQQ(channel, fromId)) return null;
  const prefix = String(channel?.prefix ?? "").trim() || channelId;
  return {
    channelId,
    prefix,
    fromName: String(row.from_name ?? row.fromName ?? ""),
    content: String(row.content ?? ""),
    fromId,
  };
}

function createMessagesRoutes({ query, body, json, forwardToQQBridge, getChannelForQQ, listQQSourceChannels }: Deps) {
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
        const incoming = messages as Array<Record<string, unknown>>;
        // QQ 入站不看请求频道，只写入消息来源为 QQ 的频道。
        const qqDestinations = channelsAcceptingQQ(listQQSourceChannels()).filter(
          (channel) => String(channel.id ?? "").trim() !== "",
        );
        // 先检查整个批次，避免前几条已写入后才发现被禁用的来源。
        for (const m of incoming) {
          const fromId = String(m.fromid ?? "");
          if (fromId.startsWith("qq_")) continue;
          const channel = getChannelForQQ(String(m.channelId ?? ""));
          const sourceField =
            fromId === "system" || fromId === "SYSTEM" ? "source_system" : "source_game";
          if (channel?.[sourceField] === 0) {
            json(res, { success: false, error: "channel source disabled" }, 403);
            return true;
          }
        }
        const insertMessage = (
          id: unknown,
          channelId: unknown,
          m: Record<string, unknown>,
        ) => {
          query(
            SQL`INSERT OR REPLACE INTO sfmc_chat_messages (
                id, channel_id, from_id, from_name, type, content, attachment, show_timestamp, created_at
              ) VALUES (
                ${id}, ${channelId}, ${m.fromid}, ${m.fromName},
                ${m.type ?? "text"}, ${m.content}, ${m.attachment ?? null},
                ${m.showTimestamp ? 1 : 0}, ${m.timestamp}
              )`
          );
        };
        let sawQQInbound = false;
        for (const m of incoming) {
          const fromId = String(m.fromid ?? "");
          if (fromId.startsWith("qq_")) {
            sawQQInbound = true;
            // 每个目标频道一行，主键带上频道 id，避免多频道互相覆盖。
            for (const channel of qqDestinations) {
              const channelId = String(channel.id);
              insertMessage(`${String(m.id ?? "")}__${channelId}`, channelId, m);
            }
            continue;
          }
          insertMessage(m.id, m.channelId, m);
        }
        if (sawQQInbound && qqDestinations.length === 0) {
          log.warn("没有消息来源为 QQ 的频道，QQ 入站未写入");
        }
        for (const m of incoming) {
          const channelId = String(m.channelId ?? "");
          const fromId = String(m.fromid ?? "");
          if (!fromId.trim() || fromId.startsWith("qq_")) continue;
          const channel = getChannelForQQ(channelId);
          if (!shouldForwardChatToQQ(channel, fromId)) continue;
          forwardToQQBridge(
            channelId,
            channel!.prefix || channelId,
            String(m.fromName ?? ""),
            String(m.content ?? ""),
            fromId
          );
        }
        json(res, { success: true, qqChannels: sawQQInbound ? qqDestinations.length : undefined });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    return false;
  };
}

export { createMessagesRoutes };
