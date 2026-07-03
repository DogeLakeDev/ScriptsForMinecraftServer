/* ---------------------------------------- *\
 *  Name        :  DogeChat 消息系统         *
 *  Description :  频道化聊天 + 消息同步      *
 *  Version     :  3.0.0                    *
 *  Author      :  Shiroha7z               *
\* ---------------------------------------- */

import { world, Player } from "@minecraft/server";
import { Msg } from "../libs/Tools";
import { Money } from "../libs/Money";
import { HttpDB } from "../libs/HttpDB";

// ============================================
//  类型定义
// ============================================

export type MessageType = "text" | "location" | "redpacket" | "teleport_invite" | "attachment";

/** 频道配置 
 * @param allowChat 是否允许聊天 
 * @param slowMode 慢速模式（秒），0=无限制 
 * @param isBroadcast 是否为公告板模式：仅管理发言 */
export interface ChannelConfig {
  allowChat: boolean;
  slowMode: number; 
  isBroadcast: boolean; 
}

/** 频道定义 
 * @param id 频道ID 
 * @param name 频道名称 
 * @param type 频道类型 
 * @param prefix 频道前缀 
 * @param ownerid 频道所有者id 
 * @param createdAt 频道创建时间 
 * @param config 频道配置 */
export interface Channel {
  id: string;
  name: string;
  type: "public" | "private" | "custom" | "system";
  prefix: string;
  ownerid?: string;
  createdAt: number;
  config: ChannelConfig;
}

/** 玩家频道设置 — 仅记录当前活跃频道 
 * @param id 玩家id 
 * @param activeChannel 玩家当前活跃频道ID */
export interface PlayerChannelSettings {
  id: string;
  activeChannel: string;
}

/** 聊天消息 
 * @param id 消息ID 
 * @param fromid 发送者id 
 * @param fromName 发送者名称 
 * @param channelId 频道ID 
 * @param type 消息类型 
 * @param content 消息内容 
 * @param attachment 附件 
 * @param timestamp 消息时间戳 
 * @param showTimestamp 是否在消息前显示时间戳 */
export interface ChatMessage {
  id: string;
  fromid: string;
  fromName: string;
  channelId: string;
  type: MessageType;
  content: string;
  attachment?: string;
  timestamp: number;
  showTimestamp?: boolean;
}

/** 红包消息 
 * @param id 红包ID 
 * @param senderid 发送者id 
 * @param senderName 发送者名称 
 * @param totalAmount 总金额 
 * @param remainingAmount 剩余金额 
 * @param totalCount 总人数 
 * @param remainingCount 剩余人数 
 * @param receivers 接收者id列表 
 * @param targetType 接收者类型 
 * @param targetId 接收者ID 
 * @param createdAt 创建时间 
 * @param expiresAt 过期时间 */
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

// ============================================
//  缓存读写辅助（委托至 Storage）
// ============================================

import { Storage } from "../libs/Storage";

function getData<T>(key: string, fallback: T): T {
  return Storage.get<T>(key, fallback);
}

function setData<T>(key: string, value: T): void {
  Storage.set(key, value);
}

/** 格式化时间戳为YYYY-MM-DD HH:mm */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================
//  DogeChat 核心类
// ============================================

export class DogeChat {
  static readonly KEY_CHANNELS = "chat:channels";
  static readonly KEY_PLAYER_SETTINGS = "chat:player_settings";
  static readonly KEY_CHANNEL_HISTORY = "chat:channel_history";
  static readonly KEY_REDPACKETS = "chat:redpackets";

  private static slowModeTracker = new Map<string, Map<string, number>>();

  static readonly DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
    allowChat: true,
    slowMode: 0,
    isBroadcast: false,
  };

  /** 生成唯一ID */
  static generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---------- 保留期 ----------
  /** 获取频道消息保留期（毫秒） */
  static getRetention(channel: Channel): number {
    if (channel.config.isBroadcast) return Infinity;
    switch (channel.type) {
      case "private": return 30 * 24 * 60 * 60 * 1000;// 30 天
      case "system": return 24 * 60 * 60 * 1000; // 1 天
      case "public":
      case "custom":
      default: return 7 * 24 * 60 * 60 * 1000;// 7 天
    }
  }

  // ============================================
  //  频道管理
  // ============================================
  /** 初始化默认频道 */
  static initChannels(): void {
    const channels = getData<Channel[]>(this.KEY_CHANNELS, []);
    if (channels.length > 0) return;

    channels.push({
      id: this.generateId(),
      name: "公共频道",
      type: "public",
      prefix: "PB",
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG },
    });

    channels.push({
      id: this.generateId(),
      name: "公告",
      type: "custom",
      prefix: "BC",
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, isBroadcast: true },
    });

    setData(this.KEY_CHANNELS, channels);
  }

  /** 获取所有频道 */
  static getChannels(): Channel[] {
    return getData<Channel[]>(this.KEY_CHANNELS, []);
  }

  /** 获取指定频道 */
  static getChannel(id: string): Channel | undefined {
    return this.getChannels().find(c => c.id === id);
  }

  /** 获取公共频道 */
  static getPublicChannel(): Channel {
    const channels = this.getChannels();
    let pub = channels.find(c => c.type === "public");
    if (!pub) {
      this.initChannels();
      pub = this.getChannels().find(c => c.type === "public")!;
    }
    return pub;
  }

  /** 创建新频道 
   @param name 频道名称 
   @param prefix 频道前缀 
   @param type 频道类型 
   @param config 频道配置 
   @param owner 频道所有者
   @returns 频道ID */
  static createChannel(name: string, prefix: string, type: string, config?: Partial<ChannelConfig>, owner?: Player): string {
    const channels = this.getChannels();
    if (channels.some(c => c.name === name)) return ""; // 名称查重
    const channel: Channel = {
      id: this.generateId(),
      name, prefix,
      type: type as Channel["type"],
      ownerid: owner?.id,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, ...config },
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
    return channel.id;
  }

  /** 删除指定频道 
   @param channelId 频道ID 
   @returns 是否删除成功 */
   static deleteChannel(channelId: string): boolean {
    const channels = this.getChannels();
    const idx = channels.findIndex(c => c.id === channelId);
    if (idx === -1) return false; // 频道不存在
    if (channels[idx].type === "public") return false; // 公共频道不能删除
    channels.splice(idx, 1);
    setData(this.KEY_CHANNELS, channels);

    // 清理 Dynamic Property 中的历史
    const history = getData<Record<string, ChatMessage[]>>(this.KEY_CHANNEL_HISTORY, {});
    delete history[channelId];
    setData(this.KEY_CHANNEL_HISTORY, history);

    // 清理 HttpDB 中的历史
    HttpDB.deleteChannelMessages(channelId).catch(() => {});

    return true;
  }

  /** 更新指定频道配置 
   @param channelId 频道ID 
   @param config 频道配置 
   @returns 是否更新成功 */
  static updateChannelConfig(channelId: string, config: Partial<ChannelConfig>): boolean {
    const channels = this.getChannels();
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false; // 频道不存在
    channel.config = { ...channel.config, ...config };
    setData(this.KEY_CHANNELS, channels);
    return true;
  }

  /** 更新指定频道名称 
   @param channelId 频道ID 
   @param newName 新名称 
   @param newPrefix 新前缀 
   @returns 是否更新成功 */
  static updateChannelName(channelId: string, newName: string, newPrefix: string): boolean {
    const channels = this.getChannels();
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false; // 频道不存在
    channel.name = newName;
    channel.prefix = newPrefix;
    setData(this.KEY_CHANNELS, channels);
    return true;
  }

  // ============================================
  //  玩家活跃频道
  // ============================================

  /** 获取所有玩家的活跃频道设置 
  @param player 玩家 
  @returns 所有玩家的活跃频道设置 */
  static getPlayerSettings(player: Player): PlayerChannelSettings {
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    if (!all[player.id]) {
      const pub = this.getPublicChannel();
      all[player.id] = { id: player.id, activeChannel: pub.id };
      setData(this.KEY_PLAYER_SETTINGS, all);
    }
    return all[player.id];
  }

  /** 获取玩家的活跃频道 
  @param player 玩家 
  @returns 玩家的活跃频道 */
  static getActiveChannel(player: Player): Channel {
    const settings = this.getPlayerSettings(player);
    const channel = this.getChannel(settings.activeChannel);
    if (channel) return channel;
    const pub = this.getPublicChannel();
    settings.activeChannel = pub.id;
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    all[player.id] = settings;
    setData(this.KEY_PLAYER_SETTINGS, all);
    return pub;
  }

  /** 设置玩家的活跃频道 
  @param player 玩家 
  @param channelId 频道ID 
  @returns 是否设置成功 */
  static setActiveChannel(player: Player, channelId: string): boolean {
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    const settings = all[player.id];
    if (!settings) return false;
    settings.activeChannel = channelId;
    setData(this.KEY_PLAYER_SETTINGS, all);
    return true;
  }

  /** 频道在线人数（活跃频道为该频道的在线玩家数） 
   * @param channelId 频道ID 
   * @returns 频道在线人数 */
  static getOnlineCount(channelId: string): number {
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    let count = 0;
    for (const p of world.getPlayers()) {
      if (all[p.id]?.activeChannel === channelId) count++;
    }
    return count;
  }

  /** 获取玩家的私聊频道 
  @param player 玩家 
  @returns 玩家的私聊频道列表 */
  static getPrivateChannels(player: Player): Channel[] {
    return this.getChannels().filter(c =>
      c.type === "private" && c.id.includes(player.id)
    );
  }

  // ============================================
  //  系统消息频道
  // ============================================

  /** 获取玩家的系统消息频道ID 每个玩家单独分配
  @param player 玩家 
  @returns 玩家的系统消息频道ID */
  static getSystemChannelId(player: Player): string {
    return `sys_${player.id}`;
  }

  /** 确保玩家的系统消息频道存在 
  @param player 玩家 
  @returns 玩家的系统消息频道 */
  static ensureSystemChannel(player: Player): Channel {
    const channelId = this.getSystemChannelId(player);
    const existing = this.getChannel(channelId);
    if (existing) return existing;

    const channels = getData<Channel[]>(this.KEY_CHANNELS, []);
    const channel: Channel = {
      id: channelId,
      name: "系统消息",
      type: "system",
      prefix: "SYS",
      ownerid: player.id,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, allowChat: false },
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
    return channel;
  }

  /** 发送系统消息到玩家的系统频道 
  @param player 玩家 
  @param content 系统消息内容 */
  static sendSystemMessage(player: Player, content: string): void {
    const channel = this.ensureSystemChannel(player);
    const msg: ChatMessage = {
      id: this.generateId(),
      fromid: "system",
      fromName: "SYS",
      channelId: channel.id,
      type: "text",
      content,
      timestamp: Date.now(),
      showTimestamp: true,
    };
    this.addToHistory(channel.id, msg);

    /* // 如果玩家当前在系统频道，直接显示
    const settings = this.getPlayerSettings(player);
    if (settings.activeChannel === channel.id) {
      player.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
      player.sendMessage(`§9[系统] ${content}`);
    } */
  }

  /** 判断是否为私聊频道的参与者 
  @param channelId 频道ID 
  @param playerId 玩家ID 
  @returns 是否为私聊频道的参与者 */
  static isPrivateParticipant(channelId: string, playerId: string): boolean {
    if (!channelId.startsWith("priv_")) return false;
    return channelId.includes(playerId);
  }

  /** 获取私聊频道中的另一方 id 
  @param channelId 频道ID 
  @param myId 玩家ID 
  @returns 另一方 id 如果是私聊频道的参与者 */
  static getPrivateOther(channelId: string, myId: string): string | undefined {
    if (!channelId.startsWith("priv_")) return undefined;
    const parts = channelId.split("_");
    return parts[1] === myId ? parts[2] : parts[1];
  }

  /** 循环切换频道（跳过私聊） 
  @param player 玩家 
  @returns 切换后的频道 */
  static cycleChannel(player: Player): Channel {
    const all = this.getChannels();
    const switchable = all.filter(c => c.type !== "private");
    if (switchable.length === 0) {
      const pub = this.getPublicChannel();
      this.setActiveChannel(player, pub.id);
      return pub;
    }
    const current = this.getActiveChannel(player);
    const idx = switchable.findIndex(c => c.id === current.id);
    const next = switchable[(idx + 1) % switchable.length];
    this.setActiveChannel(player, next.id);
    return next;
  }

  // ============================================
  //  消息同步
  // ============================================

  /** 获取频道的历史消息（优先 HttpDB，回退到 Dynamic Property） */
  static async getChannelHistory(channelId: string): Promise<ChatMessage[]> {
    const channel = this.getChannel(channelId);
    if (!channel) return [];
    const cutoff = Date.now() - this.getRetention(channel);

    // 尝试从 HttpDB 获取，失败则回退到 Dynamic Property
    const rows = await HttpDB.loadHistory(channelId, cutoff);
    if (rows !== null) return rows as ChatMessage[];

    // 回退
    const history = getData<Record<string, ChatMessage[]>>(this.KEY_CHANNEL_HISTORY, {});
    const msgs = history[channelId] || [];
    return msgs.filter(m => m.timestamp >= cutoff);
  }

  /** 添加至频道历史消息记录 */
  private static addToHistory(channelId: string, msg: ChatMessage): void {
    const channel = this.getChannel(channelId);
    if (!channel) return;

    // 始终写入 Dynamic Property（同步回退）
    const history = getData<Record<string, ChatMessage[]>>(this.KEY_CHANNEL_HISTORY, {});
    if (!history[channelId]) history[channelId] = [];
    history[channelId].push(msg);
    const cutoff = Date.now() - this.getRetention(channel);
    history[channelId] = history[channelId].filter(m => m.timestamp >= cutoff);
    setData(this.KEY_CHANNEL_HISTORY, history);

    // 异步写入 HttpDB（连接可用时）
    HttpDB.saveMessage(channelId, {
      id: msg.id,
      fromid: msg.fromid,
      fromName: msg.fromName,
      type: msg.type,
      content: msg.content,
      attachment: msg.attachment,
      showTimestamp: !!msg.showTimestamp,
      timestamp: msg.timestamp,
    }).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
  }

  /** 切换频道时加载历史消息 */
  static async loadChannelHistory(player: Player, channelId: string): Promise<void> {
    const channel = this.getChannel(channelId);
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
        case "location": display = `§a[定位] ${display}`; break;
        case "teleport_invite": display = `§e[传送邀请] ${display}`; break;
        case "redpacket": display = `§6[红包] ${display}`; break;
      }
      player.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${msg.fromName}: ${display}` }] });
    }
    player.sendMessage(`§7--- 以上为历史消息，共 ${history.length} 条 ---`);
    player.sendMessage("§7!lo §8发送定位 §7| !tp §8传送邀请 §7| !hb §8发送红包");
  }

  // ============================================
  //  发送消息
  // ============================================

  static async sendChannelMessage(from: Player, channelId: string, content: string, type: MessageType = "text", attachment?: string): Promise<boolean> {
    const channel = this.getChannel(channelId);
    if (!channel) return false;
    if (!channel.config.allowChat) {
      if (channel.type === "system") Msg.warning("该频道只读。", from);
      return false;
    }

    // 公告板模式
    if (channel.config.isBroadcast) {
      if (!this.isChannelOwner(from, channelId)) {
        Msg.warning("此频道为公告板模式，只有管理员才能发言。", from);
        return false;
      }
      const msg: ChatMessage = {
        id: this.generateId(),
        fromid: from.id, fromName: from.name,
        channelId, type, content, attachment,
        timestamp: Date.now(),
        showTimestamp: true, // 公告板每条消息都显示时间
      };
      this.addToHistory(channelId, msg);

      // 推送给所有在线玩家（同时显示时间戳）
      const prefix = `§a[${channel.prefix}公告]`;
      for (const p of world.getPlayers()) {
        if (p.id === from.id) continue;
        p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
        p.sendMessage({ rawtext: [{ text: `${prefix} ${from.name}: ${content}` }] });
      }
      return true;
    }

    // slowMode
    if (channel.config.slowMode > 0) {
      const playerMap = this.slowModeTracker.get(from.id);
      const lastTs = playerMap?.get(channelId) ?? 0;
      const elapsed = (Date.now() - lastTs) / 1000;
      if (elapsed < channel.config.slowMode) {
        Msg.warning(`频道 ${channel.prefix} 慢速模式中，请等待 ${Math.ceil(channel.config.slowMode - elapsed)} 秒。`, from);
        return false;
      }
    }

    // 计算 showTimestamp（距离上条消息超过 5 分钟）
    const history = await this.getChannelHistory(channelId);
    const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
    const showTimestamp = !lastMsg || (Date.now() - lastMsg.timestamp) > 5 * 60 * 1000;

    const msg: ChatMessage = {
      id: this.generateId(),
      fromid: from.id, fromName: from.name,
      channelId, type, content, attachment,
      timestamp: Date.now(),
      showTimestamp,
    };
    this.addToHistory(channelId, msg);

    // 回显给发送者
    if (showTimestamp) from.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
    from.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${content}` }] });

    // 推送给其他活跃频道匹配的在线玩家
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    for (const p of world.getPlayers()) {
      if (p.id === from.id) continue;
      if (all[p.id]?.activeChannel !== channelId) continue;

      let display = content;
      switch (type) {
        case "location": display = `§a[定位] ${display}`; break;
        case "teleport_invite": display = `§e[传送邀请] ${display}`; break;
        case "redpacket": display = `§6[红包] ${display}`; break;
      }

      if (showTimestamp) p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
      p.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${display}` }] });
    }

    if (channel.config.slowMode > 0) {
      if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, new Map());
      this.slowModeTracker.get(from.id)!.set(channelId, Date.now());
    }
    return true;
  }

  /** 发送私聊 */
  static async sendPrivateMessage(from: Player, toPlayer: Player, content: string, type: MessageType = "text"): Promise<boolean> {
    const channel = this.ensurePrivateChannel(from.id, toPlayer.id);

    const history = await this.getChannelHistory(channel.id);
    const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
    const showTimestamp = !lastMsg || (Date.now() - lastMsg.timestamp) > 5 * 60 * 1000;

    const msg: ChatMessage = {
      id: this.generateId(),
      fromid: from.id, fromName: from.name,
      channelId: channel.id, type, content,
      timestamp: Date.now(),
      showTimestamp,
    };
    this.addToHistory(channel.id, msg);

    // 推送给活跃频道匹配的玩家
    const all = getData<Record<string, PlayerChannelSettings>>(this.KEY_PLAYER_SETTINGS, {});
    for (const p of [from, toPlayer]) {
      if (all[p.id]?.activeChannel === channel.id) {
        let display = content;
        switch (type) {
          case "location": display = `§a[定位] ${display}`; break;
          case "teleport_invite": display = `§e[传送邀请] ${display}`; break;
          case "redpacket": display = `§6[红包] ${display}`; break;
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
  static ensurePrivateChannel(idA: string, idB: string): Channel {
    const ids = [idA, idB].sort();
    const channelId = `priv_${ids[0]}_${ids[1]}`;
    let channel = this.getChannel(channelId);
    if (channel) return channel;

    const nameB = world.getPlayers().find(p => p.id === idB)?.name ?? idB;

    const channels = getData<Channel[]>(this.KEY_CHANNELS, []);
    channel = {
      id: channelId,
      name: `与 ${nameB} 的私聊`,
      type: "private",
      prefix: `私聊-${nameB}`,
      ownerid: idA,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG },
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
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

  static sendRedPacket(sender: Player, amount: number, count: number, targetType: "player" | "group", targetId: string): boolean {
    if (amount <= 0 || count <= 0 || count > amount) { Msg.error("红包参数无效。", sender); return false; }
    const balance = Money.get(sender);
    if (balance < amount) { Msg.error(`${Money.UNIT}不足，需要 ${amount}，当前 ${balance}。`, sender); return false; }
    Money.set(sender, balance - amount);

    const packet: RedPacket = {
      id: this.generateId(),
      senderid: sender.id, senderName: sender.name,
      totalAmount: amount, remainingAmount: amount,
      totalCount: count, remainingCount: count,
      receivers: [],
      targetType, targetId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    const packets = getData<RedPacket[]>(this.KEY_REDPACKETS, []);
    packets.push(packet);
    setData(this.KEY_REDPACKETS, packets);
    Msg.success(`${sender.name} 发送了红包：${amount} ${Money.UNIT}（共 ${count} 份）。`, sender);

    if (targetType === "group" && this.getChannel(targetId)) {
      this.addToHistory(targetId, {
        id: this.generateId(),
        fromid: sender.id, fromName: sender.name,
        channelId: targetId, type: "redpacket",
        content: `发送了 ${amount} ${Money.UNIT} 的红包（共 ${count} 份）`,
        timestamp: Date.now(),
      });
    }
    return true;
  }

  static claimRedPacket(player: Player, packetId: string): number {
    const packets = getData<RedPacket[]>(this.KEY_REDPACKETS, []);
    const packet = packets.find(p => p.id === packetId);
    if (!packet) { Msg.error("红包不存在。", player); return 0; }
    if (packet.remainingCount <= 0) { Msg.error("红包已被领完。", player); return 0; }
    if (packet.receivers.includes(player.id)) { Msg.warning("你已经领取过这个红包了。", player); return 0; }
    if (Date.now() > packet.expiresAt) { Msg.error("红包已过期。", player); return 0; }

    let amount: number;
    if (packet.remainingCount === 1) {
      amount = packet.remainingAmount;
    } else {
      const max = Math.floor((packet.remainingAmount / packet.remainingCount) * 2);
      amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
      amount = Math.min(amount, packet.remainingAmount - (packet.remainingCount - 1));
    }

    packet.remainingAmount -= amount;
    packet.remainingCount--;
    packet.receivers.push(player.id);
    setData(this.KEY_REDPACKETS, packets);
    Money.add(player, amount);
    Msg.success(`你领取了 ${packet.senderName} 的红包，获得 ${amount} ${Money.UNIT}！`, player);
    return amount;
  }

  static getAvailableRedPackets(player: Player): RedPacket[] {
    const packets = getData<RedPacket[]>(this.KEY_REDPACKETS, []);
    const now = Date.now();
    return packets.filter(p => {
      if (p.remainingCount <= 0 || now > p.expiresAt) return false;
      if (p.receivers.includes(player.id)) return false;
      if (p.targetType === "player") return p.targetId === player.id;
      return true; // group → 任何玩家都可领
    });
  }

  static cleanupExpiredRedPackets(): void {
    const packets = getData<RedPacket[]>(this.KEY_REDPACKETS, []);
    const valid = packets.filter(p => Date.now() <= p.expiresAt);
    if (valid.length < packets.length) setData(this.KEY_REDPACKETS, valid);
  }

  // ============================================
  //  权限判断
  // ============================================

  static isChannelOwner(player: Player, channelId: string): boolean {
    return this.getChannel(channelId)?.ownerid === player.id;
  }
}
