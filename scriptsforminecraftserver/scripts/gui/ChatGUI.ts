import { Player, world } from "@minecraft/server";
import { Gui, ObservableString, ObservableNumber } from "../libs/Gui";
import { CustomForm } from "@minecraft/server-ui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { DogeChat } from "../chat/DogeChat";
import { Channel, RedPacket } from "../chat/DogeTypes";
import * as ChatApi from "../api/ChatApi";

export class ChatGUI {
  static async openChannelPanel(player: Player): Promise<void> {
    const active = (await DogeChat.getActiveChannel(player))!;
    const allChannels = (await ChatApi.getChannels()) ?? [];
    const displayChannels = allChannels.filter((c) => {
      if (c.type === "private") return false;
      if (c.type === "system") return c.ownerid === player.id;
      return true;
    });
    const isAdmin = Permission.check(player, "chat.admin");

    const form = new CustomForm(player, "DogeChat")
      .label(ListFormInfo([`当前频道: ${active.prefix} - ${active.name}`]))
      .button("频道管理", () => this.openChannelManager(player))
      .button("私聊频道", () => this.openPrivateChatPanel(player));

    for (const c of displayChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      const mark = c.id === active.id ? "◀ " : "";
      let tag = "";
      if (c.config.isBroadcast) tag = "§7[公告]";
      else if (c.type === "system") tag = "§9[系统]";
      form.button(`${mark}${c.prefix} - ${c.name} ${tag}\n§a${online} 人在线`, async () => {
        if (c.config.isBroadcast && !isAdmin && !(await DogeChat.isChannelOwner(player, c.id))) {
          Msg.warning("此频道为公告板频道，无法发言。管理员可切换到该频道。", player);
          return;
        }
        if (c.id !== active.id) {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`已切换到频道: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
        }
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "DogeChat");
  }

  static async openChannelManager(player: Player): Promise<void> {
    const allChannels = (await ChatApi.getChannels()) ?? [];
    const isAdmin = Permission.check(player, "chat.admin");

    const form = new CustomForm(player, "频道管理")
      .label(ListFormInfo([`共有 ${allChannels.length} 个频道`]))
      .button("创建频道", () => this.createChannelDialog(player));

    for (const c of allChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      form.button(`${c.prefix} - §f${c.name}\n§7${online} 人在线`, async () => {
        if (c.config.isBroadcast && !isAdmin && !(await DogeChat.isChannelOwner(player, c.id))) {
          Msg.warning("此频道为公告板频道，无法切换。管理员可在频道设置中操作。", player);
          return;
        }
        if (isAdmin || (await DogeChat.isChannelOwner(player, c.id))) {
          await this.openChannelSettings(player, c);
        } else {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`已切换到频道: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
          await this.openChannelPanel(player);
        }
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "频道管理");
  }

  static async openChannelSettings(player: Player, channel: Channel): Promise<void> {
    const isOwner = await DogeChat.isChannelOwner(player, channel.id);
    const lines = [
      `${channel.prefix} - ${channel.name}`,
      `类型: ${channel.type}`,
      `在线: ${DogeChat.getOnlineCount(channel.id)} 人`,
      `公告板: ${channel.config.isBroadcast ? "§a开启" : "§c关闭"}`,
    ];

    const form = new CustomForm(player, "频道设置")
      .label(ListFormInfo(lines))
      .button("编辑频道名", () => this.renameChannelDialog(player, channel))
      .button(`公告板模式 (${channel.config.isBroadcast ? "开" : "关"})`, async () => {
        await DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
        Msg.success(`公告板模式已${channel.config.isBroadcast ? "关闭" : "开启"}。`, player);
        const updated = await ChatApi.getChannel(channel.id);
        if (updated) await this.openChannelSettings(player, updated);
        else await this.openChannelManager(player);
      });

    if (isOwner && channel.type !== "public") {
      form.button("删除频道", () => {
        Gui.confirm(player, "删除频道", `确认删除频道 "${channel.name}" 吗？此操作不可撤销。`, async () => {
          await DogeChat.deleteChannel(channel.id);
          Msg.success(`频道 "${channel.name}" 已删除。`, player);
        });
        this.openChannelManager(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "频道设置");
  }

  private static async createChannelDialog(player: Player): Promise<void> {
    const name = new ObservableString("");
    const prefix = new ObservableString("");

    const form = new CustomForm(player, "创建频道")
      .textField("频道名称", name, { description: "输入频道名称" })
      .textField("显示前缀", prefix, { description: "聊天显示的前缀，建议简短" })
      .button("创建", async () => {
        const n = name.getData().trim();
        const p = prefix.getData().trim();
        if (!n || !p) {
          Msg.error("频道名称和前缀不能为空。", player);
          return;
        }
        const cid = await DogeChat.createChannel(n, p, "custom", {}, player);
        if (cid) {
          await DogeChat.setActiveChannel(player, cid);
          Msg.success(`频道 "${n}" 创建成功，已自动切换。`, player);
          await DogeChat.loadChannelHistory(player, cid);
        } else {
          Msg.error("创建失败，可能的原因是频道名称已存在。", player);
        }
      })
      .closeButton();
    await Gui.showForm(player, form, "创建频道");
    await this.openChannelPanel(player);
  }

  private static async renameChannelDialog(player: Player, channel: Channel): Promise<void> {
    const newName = new ObservableString(channel.name);
    const newPrefix = new ObservableString(channel.prefix);

    const form = new CustomForm(player, "编辑频道名")
      .textField("频道名称", newName, { description: "输入新名称" })
      .textField("显示前缀", newPrefix, { description: "输入新前缀" })
      .button("确认", async () => {
        const nn = newName.getData().trim();
        const np = newPrefix.getData().trim();
        if (!nn || !np) {
          Msg.error("名称和前缀不能为空。", player);
          return;
        }
        await DogeChat.updateChannelName(channel.id, nn, np);
        Msg.success(`频道已重命名为: ${np} - ${nn}`, player);
      })
      .closeButton();
    await Gui.showForm(player, form, "编辑频道名");
    const updated = await ChatApi.getChannel(channel.id);
    if (updated) await this.openChannelSettings(player, updated);
    else await this.openChannelManager(player);
  }

  static async openPrivateChatPanel(player: Player): Promise<void> {
    const active = await DogeChat.getActiveChannel(player);
    const privateChannels = await DogeChat.getPrivateChannels(player);

    const form = new CustomForm(player, "私聊频道")
      .label(ListFormInfo([]))
      .button("新消息", () => this.selectPlayerForPrivate(player));

    for (const c of privateChannels) {
      const otherName = c.name.replace("与 ", "").replace(" 的私聊", "");
      const mark = c.id === (active?.id ?? "") ? "◀ " : "";
      form.button(`${mark}${otherName}`, async () => {
        if (c.id !== (active?.id ?? "")) {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`已切换到频道: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
        }
        await this.openPrivateChatPanel(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "私聊频道");
  }

  private static async selectPlayerForPrivate(player: Player): Promise<void> {
    const onlinePlayers = player.dimension.getPlayers().filter((p) => p.id !== player.id);
    if (onlinePlayers.length === 0) {
      Msg.info("当前没有其他在线玩家。", player);
      await this.openPrivateChatPanel(player);
      return;
    }

    const form = new CustomForm(player, "选择玩家").label(ListFormInfo(["选择要发送私聊的玩家"]));

    for (const p of onlinePlayers) {
      form.button(p.name, async () => {
        const channel = await DogeChat.ensurePrivateChannel(player.id, p.id);
        await DogeChat.setActiveChannel(player, channel.id);
        Msg.success(`已切换到与 ${p.name} 的私聊频道。`, player);
        await DogeChat.loadChannelHistory(player, channel.id);
        await this.openPrivateChatPanel(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "选择玩家");
  }

  static async openRedPacketPanel(player: Player): Promise<void> {
    const available = await DogeChat.getAvailableRedPackets(player);
    const body = ListFormInfo(available.length > 0 ? [`有 ${available.length} 个红包可领取`] : ["暂无可用红包"]);
    const form = new CustomForm(player, "红包").label(body).button("发送红包", () => this.sendRedPacketDialog(player));
    if (available.length > 0) {
      form.button("领取红包", () => this.claimRedPacketDialog(player, available));
    }
    form.closeButton();
    await Gui.showForm(player, form, "红包");
  }

  private static async sendRedPacketDialog(player: Player): Promise<void> {
    const amount = new ObservableString("");
    const count = new ObservableString("1");
    const targetTypeIdx = new ObservableNumber(0);
    const targetPlayer = new ObservableString("");

    const form = new CustomForm(player, "发送红包")
      .textField("金额", amount, { description: "输入红包总金额" })
      .textField("份数", count, { description: "输入红包份数" })
      .dropdown("目标类型", targetTypeIdx, [
        { label: "当前频道", value: 0 },
        { label: "指定玩家", value: 1 },
      ])
      .textField("目标玩家名（指定玩家时填写）", targetPlayer, { description: "留空则发到当前频道" })
      .button("发送", async () => {
        const amt = parseInt(amount.getData());
        const cnt = parseInt(count.getData());
        const targetType = targetTypeIdx.getData();
        const tp = targetPlayer.getData().trim();

        if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
          Msg.error("请填写有效的金额和份数。", player);
          return;
        }

        if (targetType === 0) {
          const active = await DogeChat.getActiveChannel(player);
          if (active) await DogeChat.sendRedPacket(player, amt, cnt, "group", active.id);
        } else {
          const target = player.dimension.getPlayers().find((p) => p.name === tp);
          if (!target) {
            Msg.error(`玩家 "${tp}" 不在线。`, player);
            return;
          }
          await DogeChat.sendRedPacket(player, amt, cnt, "player", target.id);
        }
      })
      .closeButton();
    await Gui.showForm(player, form, "发送红包");
  }

  private static async claimRedPacketDialog(player: Player, packets: RedPacket[]): Promise<void> {
    const form = new CustomForm(player, "领取红包").label(ListFormInfo([`可领取 ${packets.length} 个红包`]));
    for (const p of packets) {
      form.button(`${p.senderName} 的红包 §7(${p.remainingAmount} 剩余)`, () => {
        DogeChat.claimRedPacket(player, p.id);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "领取红包");
  }

  static async sendLocation(player: Player): Promise<void> {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;
    const loc = DogeChat.createLocationMessage(player);
    await DogeChat.sendChannelMessage(player, channel.id, loc, "location");
  }

  static async sendTeleportInvite(player: Player): Promise<void> {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;

    if (channel.config.isBroadcast && !(await DogeChat.isChannelOwner(player, channel.id))) {
      Msg.warning("此频道为公告板频道，无法发言。", player);
      return;
    }

    if (channel.type === "private") {
      const otherid = DogeChat.getPrivateOther(channel.id, player.id);
      if (!otherid) {
        Msg.error("无法找到私聊对象。", player);
        return;
      }
      const target = world.getPlayers().find((p) => p.id === otherid);
      if (!target) {
        Msg.error("对方不在线。", player);
        return;
      }
      DogeChat.sendTeleportInvite(player, target);
      return;
    }

    const online = world.getPlayers().filter((p) => p.id !== player.id);
    if (online.length === 0) {
      Msg.info("当前没有其他在线玩家可邀请。", player);
      return;
    }

    const form = new CustomForm(player, "传送邀请").label(ListFormInfo(["选择要邀请的玩家"]));
    for (const p of online) {
      form.button(p.name, () => DogeChat.sendTeleportInvite(player, p));
    }
    form.closeButton();
    await Gui.showForm(player, form, "传送邀请");
  }

  static async sendRedPacketQuick(player: Player): Promise<void> {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;

    if (channel.config.isBroadcast && !(await DogeChat.isChannelOwner(player, channel.id))) {
      Msg.warning("此频道为公告板频道，无法发言。", player);
      return;
    }

    if (channel.type === "private") {
      const amount = new ObservableString("");
      const form = new CustomForm(player, "发送红包")
        .textField("金额", amount, { description: "输入红包金额" })
        .button("发送", async () => {
          const amt = parseInt(amount.getData());
          if (isNaN(amt) || amt <= 0) {
            Msg.error("请填写有效的金额。", player);
            return;
          }
          const otherid = DogeChat.getPrivateOther(channel.id, player.id);
          if (!otherid) {
            Msg.error("无法找到私聊对象。", player);
            return;
          }
          await DogeChat.sendRedPacket(player, amt, 1, "player", otherid);
        })
        .closeButton();
      await Gui.showForm(player, form, "发送红包");
    } else {
      const amount = new ObservableString("");
      const count = new ObservableString("1");
      const form = new CustomForm(player, "发送红包")
        .textField("金额", amount, { description: "输入红包总金额" })
        .textField("份数", count, { description: "输入红包份数" })
        .button("发送", async () => {
          const amt = parseInt(amount.getData());
          const cnt = parseInt(count.getData());
          if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
            Msg.error("请填写有效的金额和份数。", player);
            return;
          }
          await DogeChat.sendRedPacket(player, amt, cnt, "group", channel.id);
        })
        .closeButton();
      await Gui.showForm(player, form, "发送红包");
    }
  }
}
