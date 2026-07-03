/* ---------------------------------------- *\
 *  Name        :  DogeChat GUI 界面         *
 *  Description :  频道管理 / 私聊 / 红包     *
 *  Version     :  3.0.0                    *
 *  Author      :  Shiroha7z               *
\* ---------------------------------------- */

import { Player, world } from "@minecraft/server";
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { DogeChat, Channel, RedPacket } from "../chat/DogeChat";

// ============================================
//  ChatGUI
// ============================================

export class ChatGUI {

  // ============== Level 1: 主面板 ==============

  /** 主面板 — 所有频道列表 */
  static async openChannelPanel(player: Player): Promise<void> {
    const active = DogeChat.getActiveChannel(player);
    const allChannels = DogeChat.getChannels();
    // 显示的频道：排除私聊，系统频道仅显示自己的
    const displayChannels = allChannels.filter(c => {
      if (c.type === "private") return false;
      if (c.type === "system") return c.ownerid === player.id;
      return true;
    });
    const isAdmin = Permission.check(player, "chat.admin");

    const form = Gui.simpleForm("DogeChat", ListFormInfo([
      `当前频道: ${active.prefix} - ${active.name}`,
    ]));
    form.button("频道管理");
    form.button("私聊频道");

    for (const c of displayChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      const mark = c.id === active.id ? "◀ " : "";
      let tag = "";
      if (c.config.isBroadcast) tag = "§7[公告]";
      else if (c.type === "system") tag = "§9[系统]";
      form.button(`${mark}${c.prefix} - ${c.name} ${tag}\n§a${online} 人在线`);
    }
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "DogeChat");
    if (res.canceled) return;
    const sel = (res as any).selection;

    if (sel === 0) { await this.openChannelManager(player); return; }
    if (sel === 1) { await this.openPrivateChatPanel(player); return; }

    const channelIdx = sel - 2;
    if (channelIdx >= 0 && channelIdx < displayChannels.length) {
      const target = displayChannels[channelIdx];
      if (target.config.isBroadcast && !isAdmin && !DogeChat.isChannelOwner(player, target.id)) {
        Msg.warning("此频道为公告板频道，无法发言。管理员可切换到该频道。", player);
        await this.openChannelPanel(player);
        return;
      }
      if (target.id !== active.id) {
        DogeChat.setActiveChannel(player, target.id);
        Msg.success(`已切换到频道: ${target.prefix}`, player);
        await DogeChat.loadChannelHistory(player, target.id);
      }
      await this.openChannelPanel(player);
      return;
    }
  }

  // ============== Level 2a: 频道管理 ==============

  /** 频道管理 — 显示所有频道 */
  static async openChannelManager(player: Player): Promise<void> {
    const allChannels = DogeChat.getChannels();
    const isAdmin = Permission.check(player, "chat.admin");

    const form = Gui.simpleForm("频道管理", ListFormInfo([
      `共有 ${allChannels.length} 个频道`,
    ]));
    form.button("创建频道");

    for (const c of allChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      form.button(`${c.prefix} - §f${c.name}\n§7${online} 人在线`);
    }
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "频道管理");
    if (res.canceled) { await this.openChannelPanel(player); return; }
    const sel = (res as any).selection;

    if (sel === 0) { await this.createChannelDialog(player); return; }

    const channelIdx = sel - 1;
    if (channelIdx >= 0 && channelIdx < allChannels.length) {
      const channel = allChannels[channelIdx];

      // 公告板频道：非管理员不能切换
      if (channel.config.isBroadcast && !isAdmin && !DogeChat.isChannelOwner(player, channel.id)) {
        Msg.warning("此频道为公告板频道，无法切换。管理员可在频道设置中操作。", player);
        await this.openChannelManager(player);
        return;
      }

      // 管理员或拥有者 → 打开设置
      if (isAdmin || DogeChat.isChannelOwner(player, channel.id)) {
        await this.openChannelSettings(player, channel);
      } else {
        DogeChat.setActiveChannel(player, channel.id);
        Msg.success(`已切换到频道: ${channel.prefix}`, player);
        DogeChat.loadChannelHistory(player, channel.id);
        await this.openChannelPanel(player);
      }
      return;
    }
    await this.openChannelPanel(player);
  }

  // ============== Level 3: 频道设置 ==============

  /** 频道设置 — 仅管理员/所有者可操作 */
  static async openChannelSettings(player: Player, channel: Channel): Promise<void> {
    const isOwner = DogeChat.isChannelOwner(player, channel.id);

    const lines: string[] = [
      `${channel.prefix} - ${channel.name}`,
      `类型: ${channel.type}`,
      `在线: ${DogeChat.getOnlineCount(channel.id)} 人`,
      `公告板: ${channel.config.isBroadcast ? "§a开启" : "§c关闭"}`,
    ];
    const form = Gui.simpleForm("频道设置", ListFormInfo(lines));
    form.button("编辑频道名");
    form.button(`公告板模式 (${channel.config.isBroadcast ? "开" : "关"})`);
    if (isOwner && channel.type !== "public") {
      form.button("删除频道");
    }
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "频道设置");
    if (res.canceled) { await this.openChannelManager(player); return; }
    const sel = (res as any).selection;

    let idx = 0;

    if (sel === idx) {
      await this.renameChannelDialog(player, channel);
      return;
    }
    idx++;

    if (sel === idx) {
      DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
      Msg.success(`公告板模式已${channel.config.isBroadcast ? "关闭" : "开启"}。`, player);
      const updated = DogeChat.getChannel(channel.id);
      if (updated) await this.openChannelSettings(player, updated);
      else await this.openChannelManager(player);
      return;
    }
    idx++;

    if (isOwner && channel.type !== "public") {
      if (sel === idx) {
        Gui.confirm(player, "删除频道", `确认删除频道 "${channel.name}" 吗？此操作不可撤销。`, () => {
          DogeChat.deleteChannel(channel.id);
          Msg.success(`频道 "${channel.name}" 已删除。`, player);
        });
        await this.openChannelManager(player);
        return;
      }
      idx++;
    }

    await this.openChannelManager(player);
  }

  // ============== 创建频道 ==============

  private static async createChannelDialog(player: Player): Promise<void> {
    const form = Gui.modalForm("创建频道");
    form.textField("频道名称", "输入频道名称");
    form.textField("显示前缀", "聊天显示的前缀，建议简短");

    const res = await Gui.showForm(player, form, "创建频道");
    if (res.canceled) { await this.openChannelManager(player); return; }
    const vals = (res as any).formValues!;
    const name = (vals[0] as string).trim();
    const prefix = (vals[1] as string).trim();

    if (!name || !prefix) {
      Msg.error("频道名称和前缀不能为空。", player);
      await this.createChannelDialog(player);
      return;
    }

    const cid = DogeChat.createChannel(name, prefix, "custom", {}, player);
    if (cid) {
      DogeChat.setActiveChannel(player, cid);
      Msg.success(`频道 "${name}" 创建成功，已自动切换。`, player);
      DogeChat.loadChannelHistory(player, cid);
    } else {
      Msg.error("频道名称已存在。", player);
    }
    await this.openChannelPanel(player);
  }

  // ============== 编辑频道名 ==============

  private static async renameChannelDialog(player: Player, channel: Channel): Promise<void> {
    const form = Gui.modalForm("编辑频道名");
    form.textField("频道名称", "输入新名称", { "defaultValue": channel.name });
    form.textField("显示前缀", "输入新前缀", { "defaultValue": channel.prefix });

    const res = await Gui.showForm(player, form, "编辑频道名");
    if (res.canceled) { await this.openChannelSettings(player, channel); return; }
    const vals = (res as any).formValues!;
    const newName = (vals[0] as string).trim();
    const newPrefix = (vals[1] as string).trim();

    if (!newName || !newPrefix) {
      Msg.error("名称和前缀不能为空。", player);
      await this.renameChannelDialog(player, channel);
      return;
    }

    DogeChat.updateChannelName(channel.id, newName, newPrefix);
    Msg.success(`频道已重命名为: ${newPrefix} - ${newName}`, player);
    const updated = DogeChat.getChannel(channel.id);
    if (updated) await this.openChannelSettings(player, updated);
    else await this.openChannelManager(player);
  }

  // ============== Level 2b: 私聊频道 ==============

  static async openPrivateChatPanel(player: Player): Promise<void> {
    const active = DogeChat.getActiveChannel(player);
    const privateChannels = DogeChat.getPrivateChannels(player);

    const form = Gui.simpleForm("私聊频道", ListFormInfo([]));
    form.button("新消息");

    for (const c of privateChannels) {
      const otherName = c.name.replace("与 ", "").replace(" 的私聊", "");
      const mark = c.id === active.id ? "◀ " : "";
      form.button(`${mark}${otherName}`);
    }
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "私聊频道");
    if (res.canceled) { await this.openChannelPanel(player); return; }
    const sel = (res as any).selection;

    if (sel === 0) {
      await this.selectPlayerForPrivate(player);
      return;
    }

    const channelIdx = sel - 1;
    if (channelIdx >= 0 && channelIdx < privateChannels.length) {
      const target = privateChannels[channelIdx];
      if (target.id !== active.id) {
        DogeChat.setActiveChannel(player, target.id);
        Msg.success(`已切换到频道: ${target.prefix}`, player);
        DogeChat.loadChannelHistory(player, target.id);
      }
      await this.openPrivateChatPanel(player);
      return;
    }
    await this.openChannelPanel(player);
  }

  /** 选择在线玩家发起私聊 */
  private static async selectPlayerForPrivate(player: Player): Promise<void> {
    const onlinePlayers = player.dimension.getPlayers().filter(p => p.id !== player.id);
    if (onlinePlayers.length === 0) {
      Msg.info("当前没有其他在线玩家。", player);
      await this.openPrivateChatPanel(player);
      return;
    }

    const form = Gui.simpleForm("选择玩家", ListFormInfo(["选择要发送私聊的玩家"]));
    for (const p of onlinePlayers) {
      form.button(p.name);
    }
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "选择玩家");
    if (res.canceled) { await this.openPrivateChatPanel(player); return; }
    const sel = (res as any).selection;
    if (sel >= onlinePlayers.length) { await this.openPrivateChatPanel(player); return; }

    const target = onlinePlayers[sel];
    const channel = DogeChat.ensurePrivateChannel(player.id, target.id);
    DogeChat.setActiveChannel(player, channel.id);
    Msg.success(`已切换到与 ${target.name} 的私聊频道。`, player);
    DogeChat.loadChannelHistory(player, channel.id);
    await this.openPrivateChatPanel(player);
  }

  // ============== 红包 ==============

  static async openRedPacketPanel(player: Player): Promise<void> {
    const available = DogeChat.getAvailableRedPackets(player);
    const body = ListFormInfo(
      available.length > 0
        ? [`有 ${available.length} 个红包可领取`]
        : ["暂无可用红包"]
    );
    const form = Gui.simpleForm("红包", body);
    form.button("发送红包");
    if (available.length > 0) form.button("领取红包");
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "红包");
    if (res.canceled) return;
    const sel = (res as any).selection;
    if (sel === 0) {
      await this.sendRedPacketDialog(player);
    } else if (available.length > 0 && sel === 1) {
      await this.claimRedPacketDialog(player, available);
    }
  }

  private static async sendRedPacketDialog(player: Player): Promise<void> {
    const form = Gui.modalForm("发送红包");
    form.textField("金额", "输入红包总金额");
    form.textField("份数", "输入红包份数");
    form.dropdown("目标类型", ["当前频道", "指定玩家"]);
    form.textField("目标玩家名（指定玩家时填写）", "留空则发到当前频道");

    const res = await Gui.showForm(player, form, "发送红包");
    if (res.canceled) return;
    const vals = (res as any).formValues!;
    const amount = parseInt(vals[0] as string);
    const count = parseInt(vals[1] as string);
    const targetTypeIdx = vals[2] as number;
    const targetPlayer = (vals[3] as string).trim();

    if (isNaN(amount) || isNaN(count) || amount <= 0 || count <= 0) {
      Msg.error("请填写有效的金额和份数。", player);
      return;
    }

    if (targetTypeIdx === 0) {
      const active = DogeChat.getActiveChannel(player);
      DogeChat.sendRedPacket(player, amount, count, "group", active.id);
    } else {
      const target = player.dimension.getPlayers().find(p => p.name === targetPlayer);
      if (!target) { Msg.error(`玩家 "${targetPlayer}" 不在线。`, player); return; }
      DogeChat.sendRedPacket(player, amount, count, "player", target.id);
    }
  }

  private static async claimRedPacketDialog(player: Player, packets: RedPacket[]): Promise<void> {
    const form = Gui.simpleForm("领取红包", ListFormInfo([`可领取 ${packets.length} 个红包`]));
    for (const p of packets) {
      form.button(`${p.senderName} 的红包 §7(${p.remainingAmount} 剩余)`);
    }
    form.button("§l返回");
    const res = await Gui.showForm(player, form, "领取红包");
    if (res.canceled) return;
    const sel = (res as any).selection;
    if (sel >= packets.length) return;
    DogeChat.claimRedPacket(player, packets[sel].id);
  }

  // ============== 快捷指令：定位 / 传送 / 红包 ==============

  /** !lo — 发送定位到当前频道 */
  static async sendLocation(player: Player): Promise<void> {
    const channel = DogeChat.getActiveChannel(player);
    const loc = DogeChat.createLocationMessage(player);
    await DogeChat.sendChannelMessage(player, channel.id, loc, "location");
  }

  /** !tp — 发送传送邀请 */
  static async sendTeleportInvite(player: Player): Promise<void> {
    const channel = DogeChat.getActiveChannel(player);

    // 公告板频道 → 非管理员不可发言
    if (channel.config.isBroadcast && !DogeChat.isChannelOwner(player, channel.id)) {
      Msg.warning("此频道为公告板频道，无法发言。", player);
      return;
    }

    // 私聊频道 → 直接发送给另一方
    if (channel.type === "private") {
      const otherid = DogeChat.getPrivateOther(channel.id, player.id);
      if (!otherid) { Msg.error("无法找到私聊对象。", player); return; }
      const target = world.getPlayers().find(p => p.id === otherid);
      if (!target) { Msg.error("对方不在线。", player); return; }
      DogeChat.sendTeleportInvite(player, target);
      return;
    }

    // 多人频道 → 选择要邀请的在线玩家
    const online = world.getPlayers().filter(p => p.id !== player.id);
    if (online.length === 0) { Msg.info("当前没有其他在线玩家可邀请。", player); return; }

    const form = Gui.simpleForm("传送邀请", ListFormInfo(["选择要邀请的玩家"]));
    for (const p of online) form.button(p.name);
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "传送邀请");
    if (res.canceled) return;
    const sel = (res as any).selection;
    if (sel >= online.length) return;

    DogeChat.sendTeleportInvite(player, online[sel]);
  }

  /** !hb — 发送红包（快捷指令，直接打开发送对话框） */
  static async sendRedPacketQuick(player: Player): Promise<void> {
    const channel = DogeChat.getActiveChannel(player);

    if (channel.config.isBroadcast && !DogeChat.isChannelOwner(player, channel.id)) {
      Msg.warning("此频道为公告板频道，无法发言。", player);
      return;
    }

    if (channel.type === "private") {
      // 私聊 → 只有金额输入
      const form = Gui.modalForm("发送红包");
      form.textField("金额", "输入红包金额");

      const res = await Gui.showForm(player, form, "发送红包");
      if (res.canceled) return;
      const amount = parseInt((res as any).formValues![0] as string);
      if (isNaN(amount) || amount <= 0) { Msg.error("请填写有效的金额。", player); return; }

      const otherid = DogeChat.getPrivateOther(channel.id, player.id);
      if (!otherid) { Msg.error("无法找到私聊对象。", player); return; }
      DogeChat.sendRedPacket(player, amount, 1, "player", otherid);
    } else {
      // 多人/公共 → 金额 + 份数
      const form = Gui.modalForm("发送红包");
      form.textField("金额", "输入红包总金额");
      form.textField("份数", "输入红包份数");

      const res = await Gui.showForm(player, form, "发送红包");
      if (res.canceled) return;
      const vals = (res as any).formValues!;
      const amount = parseInt(vals[0] as string);
      const count = parseInt(vals[1] as string);
      if (isNaN(amount) || isNaN(count) || amount <= 0 || count <= 0) {
        Msg.error("请填写有效的金额和份数。", player);
        return;
      }
      DogeChat.sendRedPacket(player, amount, count, "group", channel.id);
    }
  }
}
