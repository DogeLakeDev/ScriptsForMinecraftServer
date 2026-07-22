import { Player, world } from "@minecraft/server";
import type { Channel, RedPacket } from "@sfmc/types";
import { DogeChat } from "./doge-chat.js";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { FormStatus, MenuNavigator, obsNum, obsStr } from "@sfmc/sdk/sapi/runtime";
import { Permission } from "@sfmc/sdk/sapi/runtime";
import { ListFormInfo, Msg } from "@sfmc/sdk/sapi/runtime";
import * as ChatApi from "./chat-api.js";

export class ChatGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }

  static openChannelPanel(player: Player): Promise<void> {
    const gui = new ChatGUI(player);
    return gui.nav.start("panel");
  }

  static openRedPacketPanel(player: Player): Promise<void> {
    const gui = new ChatGUI(player);
    return gui.nav.start("redpacket");
  }

  static openPrivateChatPanel(player: Player): Promise<void> {
    const gui = new ChatGUI(player);
    return gui.nav.start("private");
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
    new ChatGUI(player).nav.start("invite");
  }

  static async sendRedPacketQuick(player: Player): Promise<void> {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;

    if (channel.config.isBroadcast && !(await DogeChat.isChannelOwner(player, channel.id))) {
      Msg.warning("此频道为公告板频道，无法发言。", player);
      return;
    }

    if (channel.type === "private") {
      new ChatGUI(player).nav.start("quickSendPrivate");
    } else {
      new ChatGUI(player).nav.start("quickSendGroup");
    }
  }

  private registerSections(): void {
    this.nav.section("panel", "DogeChat", (page) => this.buildPanel(page));
    this.nav.section("manager", "频道管理", (page) => this.buildManager(page));
    this.nav.section("settings", "频道设置", (page) => this.buildSettings(page));
    this.nav.section("private", "私聊频道", (page) => this.buildPrivate(page));
    this.nav.section("redpacket", "红包", (page) => this.buildRedPacket(page));
    this.nav.section("create", "创建频道", (page) => this.buildCreate(page));
    this.nav.section("rename", "编辑频道", (page) => this.buildRename(page));
    this.nav.section("pickPlayer", "选择玩家", (page) => this.buildPickPlayer(page));
    this.nav.section("send", "发送红包", (page) => this.buildSendRedPacket(page));
    this.nav.section("claim", "领取红包", (page) => this.buildClaimRedPacket(page));
    this.nav.section("invite", "传送邀请", (page) => this.buildInvite(page));
    this.nav.section("quickSendPrivate", "发送红包", (page) => this.buildQuickSendPrivate(page));
    this.nav.section("quickSendGroup", "发送红包", (page) => this.buildQuickSendGroup(page));
  }

  private async buildPanel(page: any): Promise<void> {
    const active = await DogeChat.getActiveChannel(this.player);
    if (!active) {
      page.label(ListFormInfo(["数据库连接失败，无法加载频道。"]));
      return;
    }
    const allChannels = (await ChatApi.getChannels()) ?? [];
    const displayChannels = allChannels.filter((c) => {
      if (c.type === "private") return false;
      if (c.type === "system") return c.ownerid === this.player.id;
      return true;
    });

    const activeLabel = obsStr(`→ ${active.prefix} - ${active.name}（发送到此频道）`);
    page.label(activeLabel);
    page.button("频道管理", () => this.nav.go("manager"));
    page.button("私聊频道", () => this.nav.go("private"));

    for (const c of displayChannels) {
      const isPublic = c.type === "public";
      const subscribed = isPublic ? true : DogeChat.isSubscribed(this.player.id, c.id);
      const label = obsStr(
        `${subscribed ? "§a☑" : "§7☐"} ${c.prefix} - ${c.name}\n§a${DogeChat.getOnlineCount(c.id)} 人在线`
      );
      page.button(label, async () => {
        if (isPublic) {
          if (c.id !== active.id) {
            DogeChat.setActiveChannel(this.player, c.id);
            activeLabel.setData(`→ ${c.prefix} - ${c.name}（发送到此频道）`);
            await DogeChat.loadChannelHistory(this.player, c.id);
          }
          return;
        }
        const nowSubscribed = DogeChat.isSubscribed(this.player.id, c.id);
        if (nowSubscribed) {
          DogeChat.toggleSubscription(this.player, c.id);
          label.setData(`§7☐ ${c.prefix} - ${c.name}\n§a${DogeChat.getOnlineCount(c.id)} 人在线`);
          if (c.id === active.id) {
            const pub = await DogeChat.getPublicChannel();
            if (pub) {
              DogeChat.setActiveChannel(this.player, pub.id);
              activeLabel.setData(`→ ${pub.prefix} - ${pub.name}（发送到此频道）`);
            }
          }
        } else {
          DogeChat.toggleSubscription(this.player, c.id);
          label.setData(`§a☑ ${c.prefix} - ${c.name}\n§a${DogeChat.getOnlineCount(c.id)} 人在线`);
          DogeChat.setActiveChannel(this.player, c.id);
          activeLabel.setData(`→ ${c.prefix} - ${c.name}（发送到此频道）`);
          await DogeChat.loadChannelHistory(this.player, c.id);
        }
      });
    }
  }

  private async buildManager(page: any): Promise<void> {
    const status = new FormStatus(page);
    const allChannels = (await ChatApi.getChannels()) ?? [];
    const isAdmin = Permission.check(this.player, "chat.admin");

    page.label(ListFormInfo([`共有 ${allChannels.length} 个频道`]));
    page.button("创建频道", () => this.nav.go("create"));

    for (const c of allChannels) {
      page.button(`${c.prefix} - §f${c.name}\n§7${DogeChat.getOnlineCount(c.id)} 人在线`, async () => {
        if (isAdmin || (await DogeChat.isChannelOwner(this.player, c.id))) {
          this.nav.state.channel = c;
          await this.nav.rebuild("settings");
        } else {
          await DogeChat.setActiveChannel(this.player, c.id);
          status.ok(`已切换到频道: ${c.prefix}`);
          await DogeChat.loadChannelHistory(this.player, c.id);
          await this.nav.rebuild("panel");
        }
      });
    }
  }

  private async buildSettings(page: any): Promise<void> {
    const status = new FormStatus(page);
    const channel = this.nav.state.channel as Channel;
    if (!channel) {
      page.label("频道数据丢失，请返回重试。");
      return;
    }
    const isOwner = await DogeChat.isChannelOwner(this.player, channel.id);

    page.label(
      ListFormInfo([
        `${channel.prefix} - ${channel.name}`,
        `类型: ${channel.type}`,
        `在线: ${DogeChat.getOnlineCount(channel.id)} 人`,
        `公告板: ${channel.config.isBroadcast ? "§a开启" : "§c关闭"}`,
      ])
    );
    page.button("编辑频道", () => {
      this.nav.state.channel = channel;
      this.nav.go("rename");
    });
    page.button(`公告板模式(${channel.config.isBroadcast ? "开" : "关"})`, async () => {
      const ok = await DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
      if (!ok) {
        status.fail("设置失败，数据库不可用。");
        return;
      }
      const updated = await ChatApi.getChannel(channel.id);
      if (updated) {
        this.nav.state.channel = updated;
        status.ok(`公告板模式已${updated.config.isBroadcast ? "开启" : "关闭"}。`);
      }
      await this.nav.rebuild("settings");
    });
    if (isOwner && channel.type !== "public") {
      page.button("删除频道", () => {
        this.nav.confirm(
          "删除频道",
          `确认删除频道 "${channel.name}" 吗？此操作不可撤销。`,
          () => DogeChat.deleteChannel(channel.id).then(() => status.ok(`频道 "${channel.name}" 已删除。`)),
          () => this.nav.rebuild("manager")
        );
      });
    }
  }

  private async buildPrivate(page: any): Promise<void> {
    const status = new FormStatus(page);
    const active = await DogeChat.getActiveChannel(this.player);
    const privateChannels = await DogeChat.getPrivateChannels(this.player);

    page.label(ListFormInfo([]));
    page.button("新消息", () => this.nav.rebuild("pickPlayer"));

    for (const c of privateChannels) {
      const otherName = c.name.replace("与", "").replace(" 的私聊", "");
      const mark = c.id === (active?.id ?? "") ? "◀ " : "";
      page.button(`${mark}${otherName}`, async () => {
        if (c.id !== (active?.id ?? "")) {
          await DogeChat.setActiveChannel(this.player, c.id);
          status.ok(`已切换到频道: ${c.prefix}`);
          await DogeChat.loadChannelHistory(this.player, c.id);
        }
      });
    }
  }

  private buildCreate(page: any): void {
    const status = new FormStatus(page);
    const name = obsStr("");
    const prefix = obsStr("");
    page.textField("频道名称", name, { description: "输入频道名称" });
    page.textField("显示前缀", prefix, { description: "聊天显示的前缀，建议简短" });
    page.button("创建", async () => {
      const n = name.getData().trim();
      const p = prefix.getData().trim();
      if (!n || !p) {
        status.fail("频道名称和前缀不能为空。");
        return;
      }
      const cid = await DogeChat.createChannel(n, p, "custom", {}, this.player);
      if (cid) {
        await DogeChat.setActiveChannel(this.player, cid);
        status.ok(`频道 "${n}" 创建成功，已自动切换。`);
        await DogeChat.loadChannelHistory(this.player, cid);
        await this.nav.rebuild("panel");
      } else {
        status.fail("创建失败，可能的原因是频道名称已存在。");
      }
    });
  }

  private buildRename(page: any): void {
    const status = new FormStatus(page);
    const channel = this.nav.state.channel as Channel;
    if (!channel) {
      page.label("频道数据丢失。");
      return;
    }
    const newName = obsStr(channel.name);
    const newPrefix = obsStr(channel.prefix);
    page.textField("频道名称", newName, { description: "输入新名称" });
    page.textField("显示前缀", newPrefix, { description: "输入新前缀" });
    page.button("确认", async () => {
      const nn = newName.getData().trim();
      const np = newPrefix.getData().trim();
      if (!nn || !np) {
        status.fail("名称和前缀不能为空。");
        return;
      }
      const ok = await DogeChat.updateChannelName(channel.id, nn, np);
      if (!ok) {
        status.fail("修改失败，数据库不可用。");
        return;
      }
      status.ok(`频道已重命名为: ${np} - ${nn}`);
      const updated = await ChatApi.getChannel(channel.id);
      if (updated) this.nav.state.channel = updated;
      await this.nav.rebuild("settings");
    });
  }

  private async buildPickPlayer(page: any): Promise<void> {
    const status = new FormStatus(page);
    const online = this.player.dimension.getPlayers().filter((p) => p.id !== this.player.id);
    if (online.length === 0) {
      page.label(ListFormInfo(["当前没有其他在线玩家。"]));
      return;
    }
    page.label(ListFormInfo(["选择要发送私聊的玩家"]));
    for (const p of online) {
      page.button(p.name, async () => {
        const pc = await DogeChat.ensurePrivateChannel(this.player.id, p.id);
        await DogeChat.setActiveChannel(this.player, pc.id);
        status.ok(`已切换到与 ${p.name} 的私聊频道。`);
        await DogeChat.loadChannelHistory(this.player, pc.id);
      });
    }
  }

  private async buildRedPacket(page: any): Promise<void> {
    const available = await DogeChat.getAvailableRedPackets(this.player);
    if (available) {
      page.label(ListFormInfo(available.length > 0 ? [`${available.length} 个红包可领取`] : ["暂无可用红包"]));
      page.button("发送红包", () => this.nav.go("send"));
      this.nav.state.redPackets = available;
      if (available.length > 0) {
        page.button("领取红包", () => this.nav.go("claim"));
      }
    }
  }

  private buildSendRedPacket(page: any): void {
    const status = new FormStatus(page);
    const amount = obsStr("");
    const count = obsStr("1");
    const targetTypeIdx = obsNum(0);
    const targetPlayer = obsStr("");

    page.textField("金额", amount, { description: "输入红包总金额" });
    page.textField("份数", count, { description: "输入红包份数" });
    page.dropdown("目标类型", targetTypeIdx, [
      { label: "当前频道", value: 0 },
      { label: "指定玩家", value: 1 },
    ]);
    page.textField("目标玩家名（指定玩家时填写）", targetPlayer, { description: "留空则发到当前频道" });
    page.button("发送", async () => {
      const amt = parseInt(amount.getData());
      const cnt = parseInt(count.getData());
      const tgtType = targetTypeIdx.getData();
      const tp = targetPlayer.getData().trim();

      if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
        status.fail("请填写有效的金额和份数。");
        return;
      }
      if (tgtType === 0) {
        const active = await DogeChat.getActiveChannel(this.player);
        if (active) {
          const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "group", active.id);
          if (ok) await this.nav.leave(() => {});
          else status.fail("发送失败");
        }
      } else {
        const target = this.player.dimension.getPlayers().find((p) => p.name === tp);
        if (!target) {
          status.fail(`玩家 "${tp}" 不在线。`);
          return;
        }
        const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "player", target.id);
        if (ok) await this.nav.leave(() => {});
        else status.fail("发送失败");
      }
    });
  }

  private async buildClaimRedPacket(page: any): Promise<void> {
    const status = new FormStatus(page);
    const packets = this.nav.state.redPackets as RedPacket[] | undefined;
    if (!packets || packets.length === 0) {
      page.label("暂无可用红包");
      return;
    }
    page.label(ListFormInfo([`可领取 ${packets.length} 个红包`]));
    for (const p of packets) {
      page.button(`${p.senderName} 的红包 §7(${p.remainingAmount} 剩余)`, async () => {
        const amount = await DogeChat.claimRedPacket(this.player, p.id);
        if (amount > 0) status.ok(`领取了 ${amount} ${Money.UNIT}！`);
        else status.fail("领取失败");
      });
    }
  }

  private async buildInvite(page: any): Promise<void> {
    const online = world.getPlayers().filter((p) => p.id !== this.player.id);
    if (online.length === 0) {
      page.label(ListFormInfo(["当前没有其他在线玩家可邀请。"]));
      return;
    }
    page.label(ListFormInfo(["选择要邀请的玩家"]));
    for (const p of online) {
      page.button(p.name, () => DogeChat.sendTeleportInvite(this.player, p));
    }
  }

  private buildQuickSendPrivate(page: any): void {
    const status = new FormStatus(page);
    const amount = obsStr("");
    page.textField("金额", amount, { description: "输入红包金额" });
    page.button("发送", async () => {
      const amt = parseInt(amount.getData());
      if (isNaN(amt) || amt <= 0) {
        status.fail("请填写有效的金额。");
        return;
      }
      const channel = await DogeChat.getActiveChannel(this.player);
      if (!channel) return;
      const otherid = DogeChat.getPrivateOther(channel.id, this.player.id);
      if (!otherid) {
        status.fail("无法找到私聊对象。");
        return;
      }
      const ok = await DogeChat.sendRedPacket(this.player, amt, 1, "player", otherid);
      if (ok) await this.nav.leave(() => {});
      else status.fail("发送失败");
    });
  }

  private buildQuickSendGroup(page: any): void {
    const status = new FormStatus(page);
    const amount = obsStr("");
    const count = obsStr("1");
    page.textField("金额", amount, { description: "输入红包总金额" });
    page.textField("份数", count, { description: "输入红包份数" });
    page.button("发送", async () => {
      const amt = parseInt(amount.getData());
      const cnt = parseInt(count.getData());
      if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
        status.fail("请填写有效的金额和份数。");
        return;
      }
      const channel = await DogeChat.getActiveChannel(this.player);
      if (!channel) return;
      const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "group", channel.id);
      if (ok) await this.nav.leave(() => {});
      else status.fail("发送失败");
    });
  }
}