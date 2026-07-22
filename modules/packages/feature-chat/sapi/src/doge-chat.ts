/* ---------------------------------------- *\
 *  Name        :  CHAT                     *
 *  Description :  频道式聊天系统            *
 *  Version     :  1.2.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { Player, system, world } from "@minecraft/server";
import type { Channel, ChannelConfig, ChatMessage, MessageType, RedPacket } from "@sfmc/types";
import { db } from "@sfmc/sdk/sapi/db";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { Permission } from "@sfmc/sdk/sapi/runtime";
import { Msg, formatTimestamp, generateId } from "@sfmc/sdk/sapi/runtime";
import * as ChatApi from "./chat-api.js";

export type { Channel, ChannelConfig, ChatMessage, MessageType, RedPacket };

export class DogeChat {
  static readonly DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
    allowChat: true,
    slowMode: 0,
    isBroadcast: false,
  };

  static readonly DEFAULT_CHANNELS: Channel[] = [
    {
      id: generateId("CH"),
      name: "公共频道",
      type: "public",
      prefix: "PB",
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG },
    },
    {
      id: generateId("CH"),
      name: "公告",
      type: "custom",
      prefix: "BC",
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG, isBroadcast: true },
    },
  ];

  private static slowModeTracker = new Map<string, Map<string, number>>();

  /** 发送频道（玩家输入的消息发送到此频道） */
  private static activeChannelMap: Map<string, string> = new Map();

  /** 订阅频道（接收消息的频道列表） */
  private static subscribedChannelsMap: Map<string, Set<string>> = new Map();

  /** QQ 桥接轮询 */
  private static _bridgePollStarted = false;
  private static _bridgePollId: number | undefined = undefined;
  private static _lastBridgeFetch = Date.now();
  private static _lastBridgeTimestamp = 0;

  // ---------- 保留期 ----------
  static getRetention(channel: Channel): number {
    if (channel.config.isBroadcast) return Infinity;
    switch (channel.type) {
      case "private":
        return 30 * 24 * 60 * 60 * 1000;
      case "system":
        return 24 * 60 * 60 * 1000;
      case "public":
      case "custom":
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  // ============================================
  //  频道初始化
  // ============================================

  static async ensureDefaultChannels(): Promise<void> {
    debug.i("CHAT", "ensureDefaultChannels");
    for (let i = 0; i < 5; i++) {
      const existing = await ChatApi.getChannels();
      if (existing && existing.length > 0) {
        debug.i("CHAT", `ensureDefaultChannels: ${existing.length} channels exist`);
        return;
      }
      if (i < 4) {
        await system.waitTicks(40);
        continue;
      }
      const ok = await ChatApi.saveChannels(DogeChat.DEFAULT_CHANNELS).catch((err) => {
        debug.e("CHAT", `ensureDefaultChannels: save failed: ${err}`);
        return false;
      });
      if (ok) {
        debug.i("CHAT", "ensureDefaultChannels: created default channels");
        return;
      }
      await system.waitTicks(40);
    }
  }

  static async getPublicChannel(): Promise<Channel | null> {
    const rows = await ChatApi.getChannels({ type: "public" });
    if (rows && rows.length > 0) return rows[0] ?? null;
    await this.ensureDefaultChannels();
    const retry = await ChatApi.getChannels({ type: "public" });
    return retry && retry.length > 0 ? retry[0] ?? null : null;
  }

  // ============================================
  //  发送频道（!ch 用）
  // ============================================

  static async getActiveChannel(player: Player): Promise<Channel | null> {
    debug.i("CHAT", `getActiveChannel: player=${player.name}`);
    const channelId = DogeChat.activeChannelMap.get(player.id);
    if (channelId) {
      const ch = await ChatApi.getChannel(channelId);
      if (ch) return ch;
    }
    const pub = await this.getPublicChannel();
    if (pub) {
      DogeChat.activeChannelMap.set(player.id, pub.id);
      this._ensureSubscribed(player.id, pub.id);
      void this._persistPlayerChatPrefs(player, { activeChannel: pub.id });
    }
    return pub;
  }

  static async setActiveChannel(player: Player, channelId: string): Promise<void> {
    debug.i("CHAT", `setActiveChannel: player=${player.name} channelId=${channelId}`);
    DogeChat.activeChannelMap.set(player.id, channelId);
    this._ensureSubscribed(player.id, channelId);
    await this._persistPlayerChatPrefs(player, { activeChannel: channelId });
  }

  // ============================================
  //  频道订阅系统
  // ============================================

  static isSubscribed(playerId: string, channelId: string): boolean {
    return this.subscribedChannelsMap.get(playerId)?.has(channelId) ?? false;
  }

  static getSubscribedChannelIds(playerId: string): string[] {
    return Array.from(this.subscribedChannelsMap.get(playerId) ?? []);
  }

  static async getSubscribedChannels(player: Player): Promise<Channel[]> {
    const ids = this.getSubscribedChannelIds(player.id);
    const all = await ChatApi.getChannels();
    if (!all) return [];
    return all.filter((c) => ids.includes(c.id));
  }

  static async toggleSubscription(player: Player, channelId: string): Promise<boolean> {
    const subs = this.subscribedChannelsMap.get(player.id);
    if (!subs) {
      this.subscribedChannelsMap.set(player.id, new Set([channelId]));
      this._saveSubscriptions(player.id);
      return true;
    }
    if (subs.has(channelId)) {
      subs.delete(channelId);
      if (subs.size === 0) {
        const pub = await this.getPublicChannel();
        if (pub) subs.add(pub.id);
      }
      this._saveSubscriptions(player.id);
      return false;
    }
    subs.add(channelId);
    this._saveSubscriptions(player.id);
    return true;
  }

  static async setSubscriptions(player: Player, channelIds: string[]): Promise<void> {
    this.subscribedChannelsMap.set(player.id, new Set(channelIds));
    this._saveSubscriptions(player.id);
  }

  private static _ensureSubscribed(playerId: string, channelId: string): void {
    if (!this.subscribedChannelsMap.has(playerId)) {
      this.subscribedChannelsMap.set(playerId, new Set());
    }
    this.subscribedChannelsMap.get(playerId)!.add(channelId);
  }

  private static _saveSubscriptions(playerId: string): void {
    const ids = Array.from(this.subscribedChannelsMap.get(playerId) ?? []);
    const player = world.getAllPlayers().find((p) => p.id === playerId);
    if (!player) return;
    void this._persistPlayerChatPrefs(player, { subscribedChannels: JSON.stringify(ids) });
  }

  /** 把 active_channel / subscribed_channels 写回平台 sfmc_players(联合主键 id|name) */
  private static async _persistPlayerChatPrefs(
    player: Player,
    patch: { activeChannel?: string; subscribedChannels?: string }
  ): Promise<void> {
    try {
      const rowId = `${player.id}|${player.name}`;
      const existing = await db.get<{ id: string }>("sfmc_players", rowId);
      const now = Date.now();
      if (!existing) {
        await db.tx(async (tx) => {
          await tx.insert("sfmc_players", {
            id: player.id,
            name: player.name,
            active_channel: patch.activeChannel ?? "",
            subscribed_channels: patch.subscribedChannels ?? "[]",
            updated_at: now,
          });
        });
        return;
      }
      const dbPatch: Record<string, unknown> = { updated_at: now };
      if (patch.activeChannel !== undefined) dbPatch.active_channel = patch.activeChannel;
      if (patch.subscribedChannels !== undefined) dbPatch.subscribed_channels = patch.subscribedChannels;
      await db.tx(async (tx) => {
        await tx.update("sfmc_players", rowId, dbPatch);
      });
    } catch (e) {
      console.warn("[DogeChat] persist chat prefs failed:", e);
    }
  }

  static async loadSubscriptions(player: Player): Promise<void> {
    debug.i("CHAT", `loadSubscriptions: player=${player.name}`);
    const raw = await db.get<{ subscribed_channels?: string; active_channel?: string }>(
      "sfmc_players",
      `${player.id}|${player.name}`
    );
    if (raw?.subscribed_channels) {
      try {
        const ids: string[] = JSON.parse(raw.subscribed_channels);
        this.subscribedChannelsMap.set(player.id, new Set(ids));
      } catch {
        /* ignore */
      }
    }
    if (raw?.active_channel) {
      this.activeChannelMap.set(player.id, raw.active_channel);
    }
    // ensure at least one subscription
    if (!this.subscribedChannelsMap.has(player.id) || this.subscribedChannelsMap.get(player.id)!.size === 0) {
      const pub = await this.getPublicChannel();
      if (pub) this.subscribedChannelsMap.set(player.id, new Set([pub.id]));
    }
    // ensure sending channel is set
    if (!this.activeChannelMap.has(player.id)) {
      const pub = await this.getPublicChannel();
      if (pub) this.activeChannelMap.set(player.id, pub.id);
    }
  }

  /** 频道在线人数（按订阅统计） */
  static getOnlineCount(channelId: string): number {
    let count = 0;
    for (const p of world.getPlayers()) {
      if (this.subscribedChannelsMap.get(p.id)?.has(channelId)) count++;
    }
    return count;
  }

  /** 创建新频道 */
  static async createChannel(
    name: string,
    prefix: string,
    type: string,
    config?: Partial<ChannelConfig>,
    owner?: Player
  ): Promise<string> {
    debug.i("CHAT", `createChannel: name=${name} prefix=${prefix} type=${type}`);
    const ownerid = owner?.id;
    const channel: Channel = {
      id: generateId("CH"),
      name,
      prefix,
      type: type as Channel["type"],
      ...(ownerid !== undefined && { ownerid }),
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG, ...config },
    };
    const ok = await ChatApi.createChannel(channel);
    return ok ? channel.id : "";
  }

  static async deleteChannel(channelId: string): Promise<boolean> {
    debug.i("CHAT", `deleteChannel: channelId=${channelId}`);
    const ch = await ChatApi.getChannel(channelId);
    if (!ch) {
      debug.w("CHAT", "deleteChannel: not found");
      return false;
    }
    if (ch.type === "public") {
      debug.w("CHAT", "deleteChannel: cannot delete public channel");
      return false;
    }
    return ChatApi.deleteChannel(channelId);
  }

  static async updateChannelConfig(channelId: string, config: Partial<ChannelConfig>): Promise<boolean> {
    const data: Record<string, unknown> = {};
    if (config.allowChat !== undefined) data.configAllowChat = config.allowChat ? 1 : 0;
    if (config.slowMode !== undefined) data.configSlowMode = config.slowMode;
    if (config.isBroadcast !== undefined) data.configIsBroadcast = config.isBroadcast ? 1 : 0;
    if (Object.keys(data).length === 0) return false;
    return ChatApi.patchChannel(channelId, data);
  }

  static async updateChannelName(channelId: string, newName: string, newPrefix: string): Promise<boolean> {
    return ChatApi.patchChannel(channelId, { name: newName, prefix: newPrefix });
  }

  static async getPrivateChannels(player: Player): Promise<Channel[]> {
    const rows = await ChatApi.getChannels({ type: "private", ownerId: player.id });
    return rows ?? [];
  }

  // ============================================
  //  系统消息频道
  // ============================================

  static getSystemChannelId(player: Player): string {
    return `sys_${player.id}`;
  }

  static async ensureSystemChannel(player: Player): Promise<Channel> {
    const channelId = this.getSystemChannelId(player);
    const existing = await ChatApi.getChannel(channelId);
    if (existing) return existing;
    const channel: Channel = {
      id: channelId,
      name: "系统消息",
      type: "system",
      prefix: "SYS",
      ownerid: player.id,
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG, allowChat: false },
    };
    await ChatApi.createChannel(channel).catch((e) => console.warn("[DogeChat] error:", e));
    return channel;
  }

  static async sendSystemMessage(player: Player, content: string): Promise<void> {
    const channel = await this.ensureSystemChannel(player);
    const msg: ChatMessage = {
      id: generateId("M"),
      fromid: "system",
      fromName: "SYS",
      channelId: channel.id,
      type: "text",
      content,
      timestamp: Date.now(),
      showTimestamp: true,
    };
    ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
  }

  static isPrivateParticipant(channelId: string, playerId: string): boolean {
    if (!channelId.startsWith("priv_")) return false;
    return channelId.includes(playerId);
  }

  static getPrivateOther(channelId: string, myId: string): string | undefined {
    if (!channelId.startsWith("priv_")) return undefined;
    const parts = channelId.split("_");
    return parts[1] === myId ? parts[2] : parts[1];
  }

  /** 循环切换发送频道（!ch 用），同时订阅目标频道 */
  static async cycleChannel(player: Player): Promise<Channel | null> {
    const all = await ChatApi.getChannels();
    if (!all) return null;
    const switchable = all.filter((c) => c.type !== "private");
    if (switchable.length === 0) {
      const pub = await this.getPublicChannel();
      if (pub) await this.setActiveChannel(player, pub.id);
      return pub;
    }
    const currentId = DogeChat.activeChannelMap.get(player.id);
    const current = all.find((c) => c.id === currentId);
    const idx = current ? switchable.findIndex((c) => c.id === current.id) : -1;
    const next = switchable[(idx + 1) % switchable.length];
    if (next) await this.setActiveChannel(player, next.id);
    return next ?? null;
  }

  // ============================================
  //  消息同步
  // ============================================

  static async getChannelHistory(channelId: string): Promise<ChatMessage[]> {
    const channel = await ChatApi.getChannel(channelId);
    if (!channel) return [];
    const cutoff = Date.now() - this.getRetention(channel);
    const rows = await ChatApi.getMessages({ channelId, minSentAt: cutoff });
    if (rows !== null) return rows as ChatMessage[];
    return [];
  }

  static async loadChannelHistory(player: Player, channelId: string): Promise<void> {
    const channel = await ChatApi.getChannel(channelId);
    if (!channel) return;
    const history = await this.getChannelHistory(channelId);
    if (history.length === 0) {
      player.sendMessage(`§7--- §f${channel.prefix} §7频道暂无历史消息 ---`);
      return;
    }
    player.sendMessage(`§7--- §f${channel.prefix} §7频道历史消息 ---`);
    for (const msg of history) {
      const isBroadcast = channel.config.isBroadcast;
      if (msg.showTimestamp && !isBroadcast) {
        player.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
      }
      let display = msg.content;
      switch (msg.type) {
        case "location":
          display = `§a[定位] ${display}`;
          break;
        case "teleport_invite":
          display = `§e[传送邀请] ${display}`;
          break;
        case "redpacket":
          display = `§6[红包] ${display}`;
          break;
      }
      player.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${msg.fromName}: ${display}` }] });
    }
    player.sendMessage(`§7--- 以上为历史消息，共 ${history.length} 条 ---`);
    player.sendMessage("§7!lo §8发送定位 §7| !tp §8传送邀请 §7| !hb §8发送红包");
  }

  // ============================================
  //  发送消息
  // ============================================

  static async sendChannelMessage(
    from: Player,
    channelId: string,
    content: string,
    type: MessageType = "text",
    attachment?: string
  ): Promise<boolean> {
    debug.i("CHAT", `sendChannelMessage: from=${from.name} channelId=${channelId} type=${type}`);
    const channel = await ChatApi.getChannel(channelId);
    if (!channel) {
      Msg.warning("频道不存在。", from);
      return false;
    }
    if (!channel.config?.allowChat) {
      if (channel.type === "system") Msg.warning("该频道只读。", from);
      return false;
    }
    if (channel.config?.isBroadcast) {
      const owner = await this.isChannelOwner(from, channelId);
      const isAdmin = Permission.check(from, "chat.admin");
      if (!owner && !isAdmin) {
        Msg.warning("此频道为公告板模式，只有管理员才能发言。", from);
        return false;
      }
      const msg: ChatMessage = {
        id: generateId("M"),
        fromid: from.id,
        fromName: from.name,
        channelId,
        type,
        content,
        ...(attachment !== undefined && { attachment }),
        timestamp: Date.now(),
        showTimestamp: true,
      };
      await ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
      from.sendMessage({ rawtext: [{ text: `§a[${channel.prefix}] ${from.name}: ${content}` }] });
      return true;
    }

    if (channel.config?.slowMode && channel.config.slowMode > 0) {
      const playerMap = this.slowModeTracker.get(from.id);
      const lastTs = playerMap?.get(channelId) ?? 0;
      const elapsed = (Date.now() - lastTs) / 1000;
      if (elapsed < channel.config.slowMode) {
        Msg.warning(
          `频道 ${channel.prefix} 慢速模式中，请等待 ${Math.ceil(channel.config.slowMode - elapsed)} 秒。`,
          from
        );
        return false;
      }
    }

    const history = await this.getChannelHistory(channelId);
    const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
    const showTimestamp = !lastMsg || Date.now() - lastMsg!.timestamp > 5 * 60 * 1000;

    const msg: ChatMessage = {
      id: generateId("M"),
      fromid: from.id,
      fromName: from.name,
      channelId,
      type,
      content,
      ...(attachment !== undefined && { attachment }),
      timestamp: Date.now(),
      showTimestamp,
    };
    ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
    if (showTimestamp) from.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
    from.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${content}` }] });

    this._broadcastToSubscribers(channel, msg, showTimestamp, from.id);

    if (channel.config?.slowMode && channel.config.slowMode > 0) {
      if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, new Map());
      this.slowModeTracker.get(from.id)!.set(channelId, Date.now());
    }
    return true;
  }

  /** 广播消息给所有订阅了该频道的玩家 */
  private static _broadcastToSubscribers(
    channel: Channel,
    msg: ChatMessage,
    showTimestamp: boolean,
    excludeId?: string
  ): void {
    const isBroadcast = channel.config.isBroadcast;
    for (const p of world.getPlayers()) {
      if (p.id === excludeId) continue;
      if (!this.isSubscribed(p.id, channel.id)) continue;
      let display = msg.content;
      switch (msg.type) {
        case "location":
          display = `§a[定位] ${display}`;
          break;
        case "teleport_invite":
          display = `§e[传送邀请] ${display}`;
          break;
        case "redpacket":
          display = `§6[红包] ${display}`;
          break;
      }
      if (showTimestamp && !isBroadcast) p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
      (p as any).chatNamePrefix = `[${channel.prefix}]`;
      p.sendMessage(`${display}`);
    }
  }

  static async sendPrivateMessage(
    from: Player,
    toPlayer: Player,
    content: string,
    type: MessageType = "text"
  ): Promise<boolean> {
    const channel = await this.ensurePrivateChannel(from.id, toPlayer.id);
    const history = await this.getChannelHistory(channel.id);
    const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
    const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1000;

    const msg: ChatMessage = {
      id: generateId("M"),
      fromid: from.id,
      fromName: from.name,
      channelId: channel.id,
      type,
      content,
      timestamp: Date.now(),
      showTimestamp,
    };
    ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));

    for (const p of [from, toPlayer]) {
      if (this.isSubscribed(p.id, channel.id)) {
        let display = content;
        switch (type) {
          case "location":
            display = `§a[定位] ${display}`;
            break;
          case "teleport_invite":
            display = `§e[传送邀请] ${display}`;
            break;
          case "redpacket":
            display = `§6[红包] ${display}`;
            break;
        }
        if (showTimestamp) p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
        const sender = p.id === from.id ? toPlayer.name : from.name;
        p.sendMessage({ rawtext: [{ text: `§d[私信] §f${sender}: ${display}` }] });
      } else if (p.id !== from.id) {
        Msg.info(`§b${from.name} 发来一条私信。使用 !channel 切换到私聊频道查看。`, p);
      }
    }
    return true;
  }

  static async ensurePrivateChannel(idA: string, idB: string): Promise<Channel> {
    const ids = [idA, idB].sort();
    const channelId = `priv_${ids[0]}_${ids[1]}`;
    const existing = await ChatApi.getChannel(channelId);
    if (existing) return existing;
    const nameB = world.getPlayers().find((p) => p.id === idB)?.name ?? idB;
    const channel: Channel = {
      id: channelId,
      name: `与 ${nameB} 的私聊`,
      type: "private",
      prefix: `私聊-${nameB}`,
      ownerid: idA,
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG },
    };
    await ChatApi.createChannel(channel).catch((e) => console.warn("[DogeChat] error:", e));
    return channel;
  }

  // ============================================
  //  定位 & 传送
  // ============================================

  static createLocationMessage(player: Player): string {
    const loc = player.location;
    return `${player.dimension.id}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
  }

  static sendTeleportInvite(from: Player, toPlayer: Player): Promise<boolean> {
    const loc = from.location;
    const locStr = `${from.dimension.id}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
    return this.sendPrivateMessage(from, toPlayer, `${from.name} 邀请你传送到他的位置！(${locStr})`, "teleport_invite");
  }

  // ============================================
  //  红包
  // ============================================

  static async sendRedPacket(
    sender: Player,
    amount: number,
    count: number,
    targetType: "player" | "group",
    targetId: string
  ): Promise<boolean> {
    debug.i(
      "CHAT",
      `sendRedPacket: sender=${sender.name} amount=${amount} count=${count} type=${targetType} targetId=${targetId}`
    );
    if (amount <= 0 || count <= 0 || count > amount) {
      Msg.error("红包参数无效。", sender);
      return false;
    }
    const balance = await Money.load(sender);
    if (balance < amount) {
      Msg.error(`${Money.UNIT}不足，需要 ${amount}，当前 ${balance}。`, sender);
      return false;
    }
    const packet: RedPacket = {
      id: generateId("RP"),
      senderid: sender.id,
      senderName: sender.name,
      totalAmount: amount,
      remainingAmount: amount,
      totalCount: count,
      remainingCount: count,
      receivers: [],
      targetType,
      targetId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    const saved = await ChatApi.saveRedPacket(packet);
    if (!saved) {
      Msg.error("红包发送失败，请稍后重试。", sender);
      return false;
    }
    await Money.load(sender);
    Msg.success(`${sender.name} 发送了红包：${amount} ${Money.UNIT}（共 ${count} 份）。`, sender);
    const channelId = targetType === "group" ? targetId : (await this.ensurePrivateChannel(sender.id, targetId)).id;
    ChatApi.saveMessages([
      {
        id: generateId("M"),
        fromid: sender.id,
        fromName: sender.name,
        channelId,
        type: "redpacket" as MessageType,
        content: `发送了 ${amount} ${Money.UNIT} 的红包（共 ${count} 份）`,
        timestamp: Date.now(),
      },
    ]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
    return true;
  }

  static async claimRedPacket(player: Player, packetId: string): Promise<number> {
    debug.i("CHAT", `claimRedPacket: player=${player.name} packetId=${packetId}`);
    const packet = await ChatApi.getRedPacket(packetId);
    if (!packet) {
      Msg.error("红包不存在。", player);
      return 0;
    }
    if (packet.remainingCount <= 0) {
      Msg.error("红包已被领完。", player);
      return 0;
    }
    if (packet.receivers.includes(player.id)) {
      Msg.warning("你已经领取过这个红包了。", player);
      return 0;
    }
    if (Date.now() > packet.expiresAt) {
      Msg.error("红包已过期。", player);
      return 0;
    }
    let amount: number;
    if (packet.remainingCount === 1) {
      amount = packet.remainingAmount;
    } else {
      const max = Math.floor((packet.remainingAmount / packet.remainingCount) * 2);
      amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
      amount = Math.min(amount, packet.remainingAmount - (packet.remainingCount - 1));
    }
    const result = await ChatApi.claimRedPacket(packet.id, player.id, player.name);
    if (!result.ok) {
      Msg.error("领取失败，请稍后重试。", player);
      return 0;
    }
    const claimedAmount = result.amount ?? amount;
    await Money.load(player);
    Msg.success(`你领取了 ${packet.senderName} 的红包，获得 ${claimedAmount} ${Money.UNIT}！`, player);
    return claimedAmount;
  }

  static async getAvailableRedPackets(player: Player): Promise<RedPacket[]> {
    const rows = await ChatApi.getRedPackets();
    const now = Date.now();
    return rows.filter((p) => {
      if (p.remainingCount <= 0 || now > p.expiresAt) return false;
      if (p.targetType === "player") return p.targetId === player.id;
      return true;
    });
  }

  static cleanupExpiredRedPackets(): void {
    /* no-op */
  }

  // ============================================
  //  权限判断
  // ============================================

  static async isChannelOwner(player: Player, channelId: string): Promise<boolean> {
    const ch = await ChatApi.getChannel(channelId);
    return ch?.ownerid === player.id;
  }

  // ============================================
  //  QQ 桥接轮询
  // ============================================

  static startBridgePolling(bridgeChannelId: string): void {
    debug.i("CHAT", `startBridgePolling: channelId=${bridgeChannelId}`);
    if (this._bridgePollStarted) return;
    this._bridgePollStarted = true;
    this._lastBridgeFetch = Date.now();
    this._bridgePollId = system.runInterval(async () => {
      try {
        const since = this._lastBridgeFetch;
        this._lastBridgeFetch = Date.now();
        const msgs = await ChatApi.getMessages({ channelId: bridgeChannelId, minSentAt: since });
        if (!msgs || msgs.length === 0) return;
        const channel = await ChatApi.getChannel(bridgeChannelId);
        if (!channel) return;
        for (const msg of msgs) {
          if (msg.fromid.startsWith("qq_")) {
            const isBroadcast = channel.config.isBroadcast;
            for (const p of world.getPlayers()) {
              if (!this.isSubscribed(p.id, bridgeChannelId)) continue;
              if (!isBroadcast && msg.timestamp - this._lastBridgeTimestamp > 300000) {
                this._lastBridgeTimestamp = msg.timestamp;
                p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
              }
              p.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${msg.fromName}: §r${msg.content}` }] });
            }
          }
        }
      } catch {
        /* ignore */
      }
    }, 600);
  }

  static stopBridgePolling(): void {
    debug.i("CHAT", "stopBridgePolling");
    if (this._bridgePollId !== undefined) {
      try {
        system.clearRun(this._bridgePollId);
      } catch {}
      this._bridgePollId = undefined;
    }
    this._bridgePollStarted = false;
  }
}