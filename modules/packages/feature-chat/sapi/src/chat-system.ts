import { Player, system, world } from "@minecraft/server";
import { Command, debug, registerSystemMsgHandler } from "@sfmc/sdk/sapi/runtime";
import { ConfigManager } from "@sfmc/sdk/module-loader";
import { db } from "@sfmc/sdk/sapi/db";

import { ChatGUI } from "./chat-gui.js";
import { DogeChat } from "./doge-chat.js";

export class ChatSystem {
  private static chatSendSub: { unsubscribe(): void } | undefined = undefined;
  private static playerJoinSub: { unsubscribe(): void } | undefined = undefined;

  static init() {
    debug.i("CHAT", "init");
    void DogeChat.ensureDefaultChannels();

    // 用一次轻量 query 探测 db 可达,替代 HttpDB.checkHealth
    void db
      .query("sfmc_chat_channels", { limit: 1 })
      .then(() => console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。"))
      .catch(() => console.warn("[DogeChat] 外部数据库未连接。"));

    registerSystemMsgHandler((player: Player, text: string) => {
      DogeChat.sendSystemMessage(player, text);
    });

    // bridge_channel_id 属于跨切面 settings(qq_config 回落),走既有 ConfigManager.getSetting
    const bridgeChannelId = ConfigManager.getSetting("bridge_channel_id", "");
    if (bridgeChannelId) {
      DogeChat.startBridgePolling(bridgeChannelId);
    }

    debug.i("CHAT", "ChatSystem initialized");
  }

  static registerEvents() {
    ChatSystem.chatSendSub = world.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("！")) return;

      event.cancel = true;
      const channel = await DogeChat.getActiveChannel(player);
      if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
    });

    ChatSystem.playerJoinSub = world.afterEvents.playerJoin.subscribe((event) => {
      const player = world.getEntity(event.playerId) as Player;
      system.run(async () => {
        await DogeChat.loadSubscriptions(player);
        const channel = await DogeChat.getActiveChannel(player);
        if (channel) await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
  }

  static cleanup() {
    debug.i("CHAT", "cleanup");
    try {
      ChatSystem.chatSendSub?.unsubscribe();
    } catch {
      /* ignore */
    }
    try {
      ChatSystem.playerJoinSub?.unsubscribe();
    } catch {
      /* ignore */
    }
    ChatSystem.chatSendSub = undefined;
    ChatSystem.playerJoinSub = undefined;
    try {
      DogeChat.stopBridgePolling?.();
    } catch {
      /* ignore */
    }
  }

  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openChannelPanel(player);
      },
      "频道管理 - 订阅/切换频道",
      "chat"
    );

    Command.register(
      "ch",
      "chat.use",
      async (player: Player | undefined) => {
        if (!player) return;
        const next = await DogeChat.cycleChannel(player);
        if (next) await DogeChat.loadChannelHistory(player, next.id);
      },
      "快速切换频道",
      "chat"
    );

    Command.register(
      "msg",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openPrivateChatPanel(player);
      },
      "快捷私聊",
      "chat"
    );

    Command.register(
      "lo",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendLocation(player);
      },
      "发送当前位置到当前频道",
      "chat"
    );

    Command.register(
      "tp",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendTeleportInvite(player);
      },
      "发送传送邀请",
      "chat"
    );

    Command.register(
      "hongbao",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openRedPacketPanel(player);
      },
      "红包 - 查看/领取红包",
      "chat"
    );

    Command.register(
      "hb",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendRedPacketQuick(player);
      },
      "发送红包",
      "chat"
    );
  }
}
