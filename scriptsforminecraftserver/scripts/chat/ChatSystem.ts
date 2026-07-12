import { world, Player, system } from "@minecraft/server";
import { Command } from "../libs/Command";
import { registerSystemMsgHandler } from "../libs/Tools";
import { DogeChat } from "./DogeChat";
import { ChatGUI } from "../gui/ChatGUI";
import { HttpDB } from "../libs/HttpDB";
import { ConfigManager } from "../libs/ConfigManager";

export class ChatSystem {
  static init() {
    console.log(`Initializing ChatSystem...`);
    DogeChat.ensureDefaultChannels();

    HttpDB.checkHealth().then((ok) => {
      if (ok) console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。");
      else console.warn("[DogeChat] 外部数据库未连接。");
    });

    registerSystemMsgHandler((player, text) => {
      DogeChat.sendSystemMessage(player, text);
    });

    // 启动 QQ 桥接轮询
    const bridgeChannelId = ConfigManager.getSetting("bridge_channel_id", "");
    if (bridgeChannelId) {
      DogeChat.startBridgePolling(bridgeChannelId);
    }

    console.log(`ChatSystem initialized successfully.`);
  }

  static registerEvents() {
    world.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("！")) return;

      event.cancel = true;
      const channel = await DogeChat.getActiveChannel(player);
      if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
    });

    world.afterEvents.playerJoin.subscribe((event) => {
      const player = world.getEntity(event.playerId) as Player;
      system.run(async () => {
        await DogeChat.loadSubscriptions(player);
        const channel = await DogeChat.getActiveChannel(player);
        if (channel) await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
  }

  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.openChannelPanel(player);
      },
      "频道管理 - 订阅/切换频道"
    );

    Command.register(
      "ch",
      "chat.use",
      async (player: Player | undefined) => {
        if (!player) return;
        const next = await DogeChat.cycleChannel(player);
        if (next) await DogeChat.loadChannelHistory(player, next.id);
      },
      "快速切换频道"
    );

    Command.register(
      "msg",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.openPrivateChatPanel(player);
      },
      "快捷私聊"
    );

    Command.register(
      "lo",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendLocation(player);
      },
      "发送当前位置到当前频道"
    );

    Command.register(
      "tp",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendTeleportInvite(player);
      },
      "发送传送邀请"
    );

    Command.register(
      "hongbao",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.openRedPacketPanel(player);
      },
      "红包 - 查看/领取红包"
    );

    Command.register(
      "hb",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendRedPacketQuick(player);
      },
      "发送红包"
    );
  }
}
