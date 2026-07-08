/* ---------------------------------------- *\
 *  Name        :  DogeChat 消息系统         *
 *  Description :  频道化聊天 + 消息同步      *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z               *
\* ---------------------------------------- */

import { world, Player } from "@minecraft/server";
import { Msg, formatTimestamp, generateId } from "../libs/Tools";
import { Money } from "../libs/Money";
import { HttpDB } from "../libs/HttpDB";
import * as ChatApi from "../api/ChatApi";
import { ChannelConfig, Channel, ChatMessage, RedPacket, MessageType } from "./DogeTypes";

export type { MessageType, ChannelConfig, Channel, ChatMessage, RedPacket };

// ============================================
//  DogeChat 核心类
// ============================================

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

  /** 当前在线玩家活跃频道映射（运行时状态，非缓存，仅用于广播推送给同一频道的其他玩家） */
  private static activeChannelMap: Map<string, string> = new Map();

  // ---------- 保留期 ----------
  /** 拉取消息历史时的频道消息保留期（毫秒） */
  static getRetention(channel: Channel): number {
    if (channel.config.isBroadcast) return Infinity;
    switch (channel.type) {
      case "private":
        return 30 * 24 * 60 * 60 * 1000; // 30 天
      case "system":
        return 24 * 60 * 60 * 1000; // 1 天
      case "public":
      case "custom":
      default:
        return 7 * 24 * 60 * 60 * 1000; // 7 天
    }
  }

  // ============================================
  //  频道初始化
  // ============================================
  /** 确保默认频道存在于 DB */
  static async ensureDefaultChannels(): Promise<void> {
    const existing = await ChatApi.getChannels();
    if (existing && existing.length > 0) return;
    await ChatApi.saveChannels(DogeChat.DEFAULT_CHANNELS).catch((err) =>
      console.warn(`[DogeChat] 保存默认频道失败: ${err}`)
    );
  }

  /** 获取公共频道 */
  static async getPublicChannel(): Promise<Channel | null> {
    const rows = await ChatApi.getChannels({ type: "public" });
    if (rows && rows.length > 0) return rows[0];
    await this.ensureDefaultChannels();
    const retry = await ChatApi.getChannels({ type: "public" });
    return retry && retry.length > 0 ? retry[0] : null;
  }

  /** 获取活跃频道对象 */
  static async getActiveChannel(player: Player): Promise<Channel | null> {
    const channelId = DogeChat.activeChannelMap.get(player.id);
    if (channelId) {
      const ch = await ChatApi.getChannel(channelId);
      if (ch) return ch;
    }
    const pub = await this.getPublicChannel();
    if (pub) {
      DogeChat.activeChannelMap.set(player.id, pub.id);
      HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: pub.id } }).catch(() => {});
    }
    return pub;
  }

  /** 设置玩家的活跃频道 */
  static async setActiveChannel(player: Player, channelId: string): Promise<void> {
    DogeChat.activeChannelMap.set(player.id, channelId);
    await HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: channelId } }).catch(() => {});
  }

  /** 频道在线人数 */
  static getOnlineCount(channelId: string): number {
    let count = 0;
    for (const p of world.getPlayers()) {
      if (DogeChat.activeChannelMap.get(p.id) === channelId) count++;
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
    const channel: Channel = {
      id: generateId("CH"),
      name,
      prefix,
      type: type as Channel["type"],
      ownerid: owner?.id,
      createdAt: Date.now(),
      config: { ...DogeChat.DEFAULT_CHANNEL_CONFIG, ...config },
    };
    const ok = await ChatApi.createChannel(channel);
    return ok ? channel.id : "";
  }

  /** 删除指定频道 */
  static async deleteChannel(channelId: string): Promise<boolean> {
    const ch = await ChatApi.getChannel(channelId);
    if (!ch) return false;
    if (ch.type === "public") return false;
    return ChatApi.deleteChannel(channelId);
  }

  /** 更新频道配置 */
  static async updateChannelConfig(channelId: string, config: Partial<ChannelConfig>): Promise<boolean> {
    const data: Record<string, unknown> = {};
    if (config.allowChat !== undefined) data.configAllowChat = config.allowChat ? 1 : 0;
    if (config.slowMode !== undefined) data.configSlowMode = config.slowMode;
    if (config.isBroadcast !== undefined) data.configIsBroadcast = config.isBroadcast ? 1 : 0;
    if (Object.keys(data).length === 0) return false;
    return ChatApi.patchChannel(channelId, data);
  }

  /** 更新频道名称和前缀 */
  static async updateChannelName(channelId: string, newName: string, newPrefix: string): Promise<boolean> {
    return ChatApi.patchChannel(channelId, { name: newName, prefix: newPrefix });
  }

  /** 获取玩家的私聊频道 */
  static async getPrivateChannels(player: Player): Promise<Channel[]> {
    const rows = await ChatApi.getChannels({ type: "private", ownerId: player.id });
    return rows ?? [];
  }

  // ============================================
  //  系统消息频道
  // ============================================

  /** 玩家的系统频道 ID */
  static getSystemChannelId(player: Player): string {
    return `sys_${player.id}`;
  }

  /** 确保系统频道存在 */
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
    await ChatApi.createChannel(channel).catch(() => {});
    return channel;
  }

  /** 发送系统消息到玩家的系统频道 */
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

  /** 判断是否为私聊频道参与者 */
  static isPrivateParticipant(channelId: string, playerId: string): boolean {
    if (!channelId.startsWith("priv_")) return false;
    return channelId.includes(playerId);
  }

  /** 获取私聊频道中的另一方 id */
  static getPrivateOther(channelId: string, myId: string): string | undefined {
    if (!channelId.startsWith("priv_")) return undefined;
    const parts = channelId.split("_");
    return parts[1] === myId ? parts[2] : parts[1];
  }

  /** 循环切换频道（跳过私聊） */
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

  /** 获取频道的历史消息 */
  static async getChannelHistory(channelId: string): Promise<ChatMessage[]> {
    const channel = await ChatApi.getChannel(channelId);
    if (!channel) return [];
    const cutoff = Date.now() - this.getRetention(channel);
    const rows = await ChatApi.getMessages({ channelId, minSentAt: cutoff });
    if (rows !== null) return rows as ChatMessage[];
    return [];
  }

  /** 加载历史消息 */
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
      if (msg.showTimestamp) {
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
    const channel = await ChatApi.getChannel(channelId);
    if (!channel) {
      Msg.warning("频道不存在。", from);
      return false;
    }

    if (!channel.config?.allowChat) {
      if (channel.type === "system") Msg.warning("该频道只读。", from);
      return false;
    }

    // 公告板模式
    if (channel.config?.isBroadcast) {
      const owner = await this.isChannelOwner(from, channelId);
      if (!owner) {
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
        attachment,
        timestamp: Date.now(),
        showTimestamp: true,
      };
      await ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
      const prefix = `§a[${channel.prefix}]`;
      Msg.info(`§r§7${formatTimestamp(msg.timestamp)}`, from);
      from.sendMessage({ rawtext: [{ text: `${prefix} ${from.name}: ${content}` }] });
      return true;
    }

    // slowMode
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

    // showTimestamp
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
      attachment,
      timestamp: Date.now(),
      showTimestamp,
    };
    ChatApi.saveMessages([msg]).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
    if (showTimestamp) from.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
    from.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${content}` }] });

    // 广播给同一频道的其他在线玩家
    for (const p of world.getPlayers()) {
      if (p.id === from.id) continue;
      if (DogeChat.activeChannelMap.get(p.id) !== channelId) continue;

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
      (p as any).chatNamePrefix = `[${channel.prefix}]`;
      p.sendMessage(`${display}`);
    }

    if (channel.config?.slowMode && channel.config.slowMode > 0) {
      if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, new Map());
      this.slowModeTracker.get(from.id)!.set(channelId, Date.now());
    }
    return true;
  }

  /** 发送私聊 */
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
      if (DogeChat.activeChannelMap.get(p.id) === channel.id) {
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

  /** 创建或获取私聊频道 */
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
    await ChatApi.createChannel(channel).catch(() => {});
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
  //  红包（纯 DB，无缓存）
  // ============================================

  static async sendRedPacket(
    sender: Player,
    amount: number,
    count: number,
    targetType: "player" | "group",
    targetId: string
  ): Promise<boolean> {
    if (amount <= 0 || count <= 0 || count > amount) {
      Msg.error("红包参数无效。", sender);
      return false;
    }
    const balance = Money.get(sender);
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

    Money.set(sender, balance - amount);
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

    const updated = await ChatApi.updateRedPacket(packet.id, {
      remainingAmount: packet.remainingAmount - amount,
      remainingCount: packet.remainingCount - 1,
      receivers: [...packet.receivers, player.id],
    });
    if (!updated) {
      Msg.error("领取失败，请稍后重试。", player);
      return 0;
    }

    Money.add(player, amount);
    Msg.success(`你领取了 ${packet.senderName} 的红包，获得 ${amount} ${Money.UNIT}！`, player);
    return amount;
  }

  static async getAvailableRedPackets(player: Player): Promise<RedPacket[]> {
    const rows = await ChatApi.getRedPackets();
    const now = Date.now();
    return rows.filter((p) => {
      if (p.remainingCount <= 0 || now > p.expiresAt) return false;
      if (p.receivers.includes(player.id)) return false;
      if (p.targetType === "player") return p.targetId === player.id;
      return true;
    });
  }

  /** DB 层面过期的红包不返回即可，无需显式清理 */
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
}
