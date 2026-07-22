/**
 * chat-api.ts — chat 模块对平台 bootstrap 表的 db.tx/db.query 包装
 *
 * 把 v1 HttpDB 客户端调用替换为 v2 协议:db-server 启动时已 bootstrap 出
 * sfmc_chat_channels / sfmc_chat_messages / sfmc_chat_redpackets 三张表,
 * 直接 db.tx + tx.insert/update/query 即可,不需要 v1 routes。
 *
 * qq-bridge(MC↔QQ 转发)仍走 v1 routes(db-server/src/routes/channels.ts /
 * messages.ts / redpacket.ts),它们与本模块互不干扰。
 *
 * Column mappings (schema-registry 列名来自 db-server/src/domain/schema.ts):
 *   sfmc_chat_channels: id, name, type, prefix, owner_id, created_at,
 *     config_allow_chat, config_slow_mode, config_is_broadcast
 *   sfmc_chat_messages: id, from_id, from_name, channel_id, type,
 *     content, attachment, show_timestamp, created_at
 *   sfmc_chat_redpackets: id, sender_id, sender_name, total_amount,
 *     remaining_amount, total_count, remaining_count, receivers (JSON str),
 *     target_type, target_id, created_at, expires_at
 */

import { db } from "@sfmc/sdk/sapi/db";

export interface Channel {
  id: string;
  name: string;
  type: "public" | "private" | "system" | "custom" | string;
  prefix: string;
  ownerid?: string;
  createdAt: number;
  config: {
    allowChat: boolean;
    slowMode: number;
    isBroadcast: boolean;
  };
}

export interface ChatMessage {
  id: string;
  fromid: string;
  fromName: string;
  channelId: string;
  type: "text" | "location" | "teleport_invite" | "redpacket" | string;
  content: string;
  attachment?: string;
  showTimestamp: boolean;
  timestamp: number;
}

export interface RedPacket {
  id: string;
  senderid: string;
  senderName: string;
  totalAmount: number;
  remainingAmount: number;
  totalCount: number;
  remainingCount: number;
  receivers: string[];
  targetType: "player" | "group";
  targetId: string;
  createdAt: number;
  expiresAt: number;
}

interface ChannelRow {
  id: string;
  name: string;
  type: string;
  prefix: string;
  owner_id: string;
  created_at: number;
  config_allow_chat: number;
  config_slow_mode: number;
  config_is_broadcast: number;
}

interface MessageRow {
  id: string;
  from_id: string;
  from_name: string;
  channel_id: string;
  type: string;
  content: string;
  attachment: string;
  show_timestamp: number;
  created_at: number;
}

interface RedPacketRow {
  id: string;
  sender_id: string;
  sender_name: string;
  total_amount: number;
  remaining_amount: number;
  total_count: number;
  remaining_count: number;
  receivers: string;
  target_type: string;
  target_id: string;
  created_at: number;
  expires_at: number;
}

function rowToChannel(r: ChannelRow): Channel {
  const c: Channel = {
    id: r.id,
    name: r.name,
    type: r.type,
    prefix: r.prefix,
    createdAt: r.created_at,
    config: {
      allowChat: !!r.config_allow_chat,
      slowMode: r.config_slow_mode || 0,
      isBroadcast: !!r.config_is_broadcast,
    },
  };
  if (r.owner_id) c.ownerid = r.owner_id;
  return c;
}

function rowToMessage(r: MessageRow): ChatMessage {
  const m: ChatMessage = {
    id: r.id,
    fromid: r.from_id,
    fromName: r.from_name,
    channelId: r.channel_id,
    type: r.type || "text",
    content: r.content,
    showTimestamp: !!r.show_timestamp,
    timestamp: r.created_at,
  };
  if (r.attachment) m.attachment = r.attachment;
  return m;
}

function rowToRedPacket(r: RedPacketRow): RedPacket {
  return {
    id: r.id,
    senderid: r.sender_id,
    senderName: r.sender_name,
    totalAmount: r.total_amount,
    remainingAmount: r.remaining_amount,
    totalCount: r.total_count,
    remainingCount: r.remaining_count,
    receivers: safeParseStringArray(r.receivers),
    targetType: r.target_type as RedPacket["targetType"],
    targetId: r.target_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

function safeParseStringArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function channelToRow(c: Channel): ChannelRow & { updated_at: number } {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    prefix: c.prefix,
    owner_id: c.ownerid ?? "",
    created_at: c.createdAt,
    config_allow_chat: c.config?.allowChat ? 1 : 0,
    config_slow_mode: c.config?.slowMode ?? 0,
    config_is_broadcast: c.config?.isBroadcast ? 1 : 0,
    updated_at: Date.now(),
  };
}

function messageToRow(m: ChatMessage): MessageRow {
  return {
    id: m.id,
    from_id: m.fromid,
    from_name: m.fromName,
    channel_id: m.channelId,
    type: m.type,
    content: m.content,
    attachment: m.attachment ?? "",
    show_timestamp: m.showTimestamp ? 1 : 0,
    created_at: m.timestamp,
  };
}

function redPacketToRow(r: RedPacket): RedPacketRow {
  return {
    id: r.id,
    sender_id: r.senderid,
    sender_name: r.senderName,
    total_amount: r.totalAmount,
    remaining_amount: r.remainingAmount,
    total_count: r.totalCount,
    remaining_count: r.remainingCount,
    receivers: JSON.stringify(r.receivers ?? []),
    target_type: r.targetType,
    target_id: r.targetId,
    created_at: r.createdAt,
    expires_at: r.expiresAt,
  };
}

// ── Channels ──

export async function getChannels(filter?: {
  search?: string;
  type?: string;
  ownerId?: string;
  minCreatedAt?: number;
  maxCreatedAt?: number;
}): Promise<Channel[] | null> {
  const conds: Array<Record<string, unknown>> = [];
  if (filter?.type) conds.push({ eq: ["type", filter.type] });
  if (filter?.ownerId) conds.push({ eq: ["owner_id", filter.ownerId] });
  if (filter?.minCreatedAt !== undefined) conds.push({ gte: ["created_at", filter.minCreatedAt] });
  if (filter?.maxCreatedAt !== undefined) conds.push({ lte: ["created_at", filter.maxCreatedAt] });
  let where: Record<string, unknown> | undefined;
  if (conds.length === 1) where = conds[0];
  else if (conds.length > 1) where = { and: conds };
  let rows = await db.query<ChannelRow>("sfmc_chat_channels", where ? { where } : {});
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }
  return rows.map(rowToChannel);
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  const row = await db.get<ChannelRow>("sfmc_chat_channels", channelId);
  return row ? rowToChannel(row) : null;
}

export async function createChannel(channel: Channel): Promise<boolean> {
  return saveChannels([channel]);
}

export async function saveChannels(channels: Channel[]): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      for (const c of channels) await tx.insert("sfmc_chat_channels", channelToRow(c));
    });
    return true;
  } catch {
    return false;
  }
}

export async function patchChannel(channelId: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.prefix !== undefined) patch.prefix = data.prefix;
    if (data.configAllowChat !== undefined) patch.config_allow_chat = data.configAllowChat ? 1 : 0;
    if (data.configSlowMode !== undefined) patch.config_slow_mode = data.configSlowMode;
    if (data.configIsBroadcast !== undefined) patch.config_is_broadcast = data.configIsBroadcast ? 1 : 0;
    if (Object.keys(patch).length === 0) return false;
    await db.tx(async (tx) => {
      await tx.update("sfmc_chat_channels", channelId, patch);
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.delete("sfmc_chat_channels", channelId, { hard: true });
    });
    return true;
  } catch {
    return false;
  }
}

// ── Messages ──

export async function getMessages(filter?: {
  search?: string;
  type?: string;
  channelId?: string;
  from?: string;
  minSentAt?: number;
  maxSentAt?: number;
}): Promise<ChatMessage[] | null> {
  const conds: Array<Record<string, unknown>> = [];
  if (filter?.type) conds.push({ eq: ["type", filter.type] });
  if (filter?.channelId) conds.push({ eq: ["channel_id", filter.channelId] });
  if (filter?.from) conds.push({ eq: ["from_id", filter.from] });
  if (filter?.minSentAt !== undefined) conds.push({ gte: ["created_at", filter.minSentAt] });
  if (filter?.maxSentAt !== undefined) conds.push({ lte: ["created_at", filter.maxSentAt] });
  let where: Record<string, unknown> | undefined;
  if (conds.length === 1) where = conds[0];
  else if (conds.length > 1) where = { and: conds };
  const rows = await db.query<MessageRow>("sfmc_chat_messages", where ? { where } : {});
  return rows.map(rowToMessage);
}

export async function saveMessages(messages: ChatMessage[]): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      for (const m of messages) await tx.insert("sfmc_chat_messages", messageToRow(m));
    });
    return true;
  } catch {
    return false;
  }
}

// ── Red packets ──

export async function getRedPackets(): Promise<RedPacket[]> {
  const rows = await db.query<RedPacketRow>("sfmc_chat_redpackets", {});
  return rows.map(rowToRedPacket);
}

export async function getRedPacket(redpacketId: string): Promise<RedPacket | null> {
  const row = await db.get<RedPacketRow>("sfmc_chat_redpackets", redpacketId);
  return row ? rowToRedPacket(row) : null;
}

export async function saveRedPacket(redpacket: RedPacket): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      // 先扣发送者经济账户,再落红包行(与 v1 domain/redpacket.createRedpacketTx 同序)
      await tx.call("economy.account.debit", {
        playerId: redpacket.senderid,
        playerName: redpacket.senderName,
        amount: redpacket.totalAmount,
        reason: "redpacket_create",
        meta: { redpacketId: redpacket.id },
      });
      await tx.insert("sfmc_chat_redpackets", redPacketToRow(redpacket));
    });
    return true;
  } catch {
    return false;
  }
}

export async function claimRedPacket(
  redpacketId: string,
  actorId: string,
  actorName: string
): Promise<{ ok: boolean; amount?: number; account?: { balance?: number; version?: number }; error?: string }> {
  try {
    const result = await db.tx<{ amount: number; balance: number; version: number }>(async (tx) => {
      const row = await tx.get("sfmc_chat_redpackets", redpacketId);
      if (!row) throw new Error("redpacket_not_found");
      const rp = rowToRedPacket(row as unknown as RedPacketRow);
      if (rp.remainingCount <= 0) throw new Error("redpacket_empty");
      const receivers = new Set(rp.receivers);
      if (receivers.has(actorId)) throw new Error("already_claimed");
      if (Date.now() > rp.expiresAt) throw new Error("redpacket_expired");
      let amount: number;
      if (rp.remainingCount === 1) {
        amount = rp.remainingAmount;
      } else {
        const max = Math.floor((rp.remainingAmount / rp.remainingCount) * 2);
        amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
        amount = Math.min(amount, rp.remainingAmount - (rp.remainingCount - 1));
      }
      receivers.add(actorId);
      await tx.update("sfmc_chat_redpackets", redpacketId, {
        remaining_amount: rp.remainingAmount - amount,
        remaining_count: rp.remainingCount - 1,
        receivers: JSON.stringify([...receivers]),
      });
      const credited = (await tx.call("economy.account.credit", {
        playerId: actorId,
        playerName: actorName,
        amount,
        reason: "redpacket_claim",
        meta: { redpacketId },
      })) as { balance?: number; version?: number } | null;
      return {
        amount,
        balance: Number(credited?.balance ?? 0),
        version: Number(credited?.version ?? 0),
      };
    });
    return { ok: true, amount: result.amount, account: { balance: result.balance, version: result.version } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}