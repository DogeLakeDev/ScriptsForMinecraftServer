/** db-server\src\routes\channels.ts */
import { HttpRequestMethod } from "@minecraft/server-net";
import type { Channel, ChatMessage, RedPacket } from "@sfmc/types";
import { HttpDB } from "../libs/HttpDB.js";
import { toQueryString } from "../libs/Tools.js";

const PATH_CHANNELS = "/api/sfmc/channels";
const PATH_MESSAGES = "/api/sfmc/messages";
const PATH_REDPACKET = "/api/sfmc/redpacket";

/**
 * @description 模糊搜索频道
 * @author Shiroha7z
 * @date 17/07/2026
 * @export
 * @param {{
 *   search?: string;
 *   type?: string;
 *   ownerId?: string;
 *   minCreatedAt?: number;
 *   maxCreatedAt?: number;
 * }} [filter]
 * @return {*}  {(Promise<Channel[] | null>)}
 */
export async function getChannels(filter?: {
  search?: string;
  type?: string;
  ownerId?: string;
  minCreatedAt?: number;
  maxCreatedAt?: number;
}): Promise<Channel[] | null> {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    ownerId: filter?.ownerId,
    minCreatedAt: filter?.minCreatedAt,
    maxCreatedAt: filter?.maxCreatedAt,
  });
  const path = `${PATH_CHANNELS}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw: Record<string, unknown>[] = JSON.parse(body).channels;
    return raw.map(toChannel);
  } catch {
    return null;
  }
}

/** 将数据库中的扁平频道数据还原为 Channel */
function toChannel(r: Record<string, unknown>): Channel {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Channel["type"],
    prefix: r.prefix as string,
    ownerid: (r.owner_id as string) || undefined,
    createdAt: r.created_at as number,
    config: {
      allowChat: !!r.config_allow_chat,
      slowMode: (r.config_slow_mode as number) || 0,
      isBroadcast: !!r.config_is_broadcast,
    },
  };
}

/** 将数据库中的扁平消息数据还原为 ChatMessage */
function toMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    fromid: r.from_id as string,
    fromName: r.from_name as string,
    channelId: r.channel_id as string,
    type: (r.type as ChatMessage["type"]) || "text",
    content: r.content as string,
    attachment: r.attachment as string | undefined,
    showTimestamp: !!r.show_timestamp,
    timestamp: r.created_at as number,
  };
}

/** 将数据库中的扁平红包数据还原为 RedPacket */
function toRedPacket(r: Record<string, unknown>): RedPacket {
  return {
    id: r.id as string,
    senderid: r.sender_id as string,
    senderName: r.sender_name as string,
    totalAmount: r.total_amount as number,
    remainingAmount: r.remaining_amount as number,
    totalCount: r.total_count as number,
    remainingCount: r.remaining_count as number,
    receivers: JSON.parse((r.receivers as string) || "[]"),
    targetType: r.target_type as RedPacket["targetType"],
    targetId: r.target_id as string,
    createdAt: r.created_at as number,
    expiresAt: r.expires_at as number,
  };
}

/**
 *
 *
 * @export
 * @param {string} channelId
 * @return {*}  {(Promise<Channel | null>)}
 */
export async function getChannel(channelId: string): Promise<Channel | null> {
  const raw = await HttpDB.fetchJSON<Record<string, unknown>>(PATH_CHANNELS, channelId, "channel");
  if (!raw) return null;
  return toChannel(raw);
}

/**
 * 创建单个频道
 * @param channel 频道对象
 * @returns 是否成功
 */
export async function createChannel(channel: Channel): Promise<boolean> {
  return saveChannels([channel]);
}

/**
 * 保存频道（批量）
 * @param channels 频道列表
 * @returns 是否成功
 */
export async function saveChannels(channels: Channel[]): Promise<boolean> {
  const flat = channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    prefix: c.prefix,
    ownerId: c.ownerid,
    createdAt: c.createdAt,
    configAllowChat: c.config?.allowChat,
    configSlowMode: c.config?.slowMode,
    configIsBroadcast: c.config?.isBroadcast,
  }));
  return HttpDB.post(PATH_CHANNELS, { channels: flat });
}

/**
 * 更新单个频道字段
 * @param channelId 频道id
 * @param data 要更新的字段
 * @returns 是否成功
 */
export async function patchChannel(channelId: string, data: Record<string, unknown>): Promise<boolean> {
  return HttpDB.put(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`, data);
}

/**
 * 删除频道
 * @param channelId 频道id
 * @returns 是否成功
 */
export async function deleteChannel(channelId: string): Promise<boolean> {
  return HttpDB.del(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`);
}

/**
 * 模糊搜索聊天消息
 * @param filter 搜索参数
 * @returns 符合条件的聊天消息列表
 */
export async function getMessages(filter?: {
  search?: string;
  type?: string;
  channelId?: string;
  from?: string;
  minSentAt?: number;
  maxSentAt?: number;
}): Promise<ChatMessage[] | null> {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    channelId: filter?.channelId,
    from: filter?.from,
    minSentAt: filter?.minSentAt,
    maxSentAt: filter?.maxSentAt,
  });
  const path = `${PATH_MESSAGES}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw: Record<string, unknown>[] = JSON.parse(body).messages;
    return raw.map(toMessage);
  } catch {
    return null;
  }
}

/**
 * 保存聊天消息
 * @param messages 聊天消息列表
 * @returns 是否成功
 */
export async function saveMessages(messages: ChatMessage[]): Promise<boolean> {
  return HttpDB.post(PATH_MESSAGES, { messages });
}

/**
 * 获取所有红包
 * @returns 红包列表
 */
export async function getRedPackets(): Promise<RedPacket[]> {
  const body = await HttpDB.get(PATH_REDPACKET);
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    const raw: Record<string, unknown>[] = parsed.redpackets || parsed.redpacket || [];
    return raw.map(toRedPacket);
  } catch {
    return [];
  }
}

/**
 * 按id精准匹配红包
 * @param redpacketId 红包id
 * @returns 红包对象
 */
export async function getRedPacket(redpacketId: string): Promise<RedPacket | null> {
  const raw = await HttpDB.fetchJSON<Record<string, unknown>>(PATH_REDPACKET, redpacketId, "redpacket");
  if (!raw) return null;
  return toRedPacket(raw);
}

/**
 * 保存红包
 * @param redpacket 红包对象
 * @returns 是否成功
 */
export async function saveRedPacket(redpacket: RedPacket): Promise<boolean> {
  return HttpDB.post(PATH_REDPACKET, { redpacket, actorId: redpacket.senderid });
}

export async function claimRedPacket(
  redpacketId: string,
  actorId: string,
  actorName: string
): Promise<{
  ok: boolean;
  amount?: number;
  transactionId?: string;
  account?: { balance?: number; version?: number };
  error?: string;
}> {
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.POST,
    `${PATH_REDPACKET}/${encodeURIComponent(redpacketId)}/claim`,
    {
      actorId,
      actorName,
    }
  );
  try {
    const parsed = JSON.parse(result.body);
    return {
      ok: result.status === 200 && parsed.success,
      amount: parsed.amount,
      transactionId: parsed.transactionId,
      account: parsed.account,
      error: parsed.error,
    };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
