import { Player, system, world } from "@minecraft/server";
import { ChatGUI } from "../gui/ChatGUI";
import { Command } from "../libs/Command";
import { ConfigManager } from "../libs/ConfigManager";
import { debug } from "../libs/DebugLog";
import { HttpDB } from "../libs/HttpDB";
import { registerSystemMsgHandler } from "../libs/Tools";
import { DogeChat } from "./DogeChat";

export class ChatSystem {
  private static chatSendSub: any = undefined;
  private static playerJoinSub: any = undefined;

  static init() {
    debug.i("CHAT", "init");
    console.log(`Initializing ChatSystem...`);
    DogeChat.ensureDefaultChannels();

    HttpDB.checkHealth().then((ok) => {
      if (ok) console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。");
      else console.warn("[DogeChat] 外部数据库未连接。");
    });

    registerSystemMsgHandler((player, text) => {
      DogeChat.sendSystemMessage(player, text);
    });

    const bridgeChannelId = ConfigManager.getSetting("bridge_channel_id", "");
    if (bridgeChannelId) {
      DogeChat.startBridgePolling(bridgeChannelId);
    }

    console.log(`ChatSystem initialized successfully.`);
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
      if (ChatSystem.chatSendSub?.unsubscribe) ChatSystem.chatSendSub.unsubscribe();
    } catch {}
    try {
      if (ChatSystem.playerJoinSub?.unsubscribe) ChatSystem.playerJoinSub.unsubscribe();
    } catch {}
    ChatSystem.chatSendSub = undefined;
    ChatSystem.playerJoinSub = undefined;
    try {
      DogeChat.stopBridgePolling?.();
    } catch {}
  }

  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.openChannelPanel(player);
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
        if (player) ChatGUI.openPrivateChatPanel(player);
      },
      "快捷私聊",
      "chat"
    );

    Command.register(
      "lo",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendLocation(player);
      },
      "发送当前位置到当前频道",
      "chat"
    );

    Command.register(
      "tp",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendTeleportInvite(player);
      },
      "发送传送邀请",
      "chat"
    );

    Command.register(
      "hongbao",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.openRedPacketPanel(player);
      },
      "红包 - 查看/领取红包",
      "chat"
    );

    Command.register(
      "hb",
      "chat.use",
      (player: Player | undefined) => {
        if (player) ChatGUI.sendRedPacketQuick(player);
      },
      "发送红包",
      "chat"
    );
  }
}
