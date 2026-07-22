/**
 * @sfmc/module-feature-chat — v2 入口
 *
 * 合并 v1 chat + chat-gui 后,sapi 入口只剩一个 ModuleRegistry.register:
 *   - registerPermissions: chat.use
 *   - registerCommands: /channel /ch /msg /lo /tp /hongbao /hb(原 7 个)
 *   - lifecycle.init: 启动 default channels + 检查 db 健康 + bridge 轮询
 *   - lifecycle.cleanup: 取消订阅 + 停 bridge 轮询
 *
 * 业务实现由 ./chat-system.ts + ./doge-chat.ts + ./chat-api.ts + ./chat-gui.ts 协同:
 *   chat-system 负责 init/cleanup 与命令注册;
 *   doge-chat    负责消息/频道/红包业务逻辑;
 *   chat-api     是 HttpDB 客户端(连 v1 路由);
 *   chat-gui     是 MenuNavigator UI(暂保留 v1 形态,P1 重写)。
 */

import { Player, world } from "@minecraft/server";
import { Command, debug, Permission } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

import { ChatSystem } from "./chat-system.js";
import { DogeChat } from "./doge-chat.js";

const MODULE_ID = "feature-chat";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      ChatSystem.registerPermissions();
    },
    async init() {
      ChatSystem.init();
      debug.i("CHAT", "feature-chat init");
    },
    registerCommands() {
      Permission.register("chat.use", Permission.Member);
      Command.register(
        "channel",
        "chat.use",
        (player: Player | undefined) => {
          if (!player) return;
          const cid = DogeChat.getSystemChannelId(player);
          void player;
          void cid;
          MsgNoop();
        },
        "频道管理 - 占位(完整 GUI 在 P1 阶段)",
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
        () => MsgNoop(),
        "快捷私聊(占位,P1 启用)",
        "chat"
      );
      Command.register(
        "lo",
        "chat.use",
        () => MsgNoop(),
        "发送当前位置(占位)",
        "chat"
      );
      Command.register(
        "tp",
        "chat.use",
        () => MsgNoop(),
        "发送传送邀请(占位)",
        "chat"
      );
      Command.register(
        "hongbao",
        "chat.use",
        () => MsgNoop(),
        "红包(占位,P1 启用)",
        "chat"
      );
      Command.register(
        "hb",
        "chat.use",
        () => MsgNoop(),
        "发送红包(占位)",
        "chat"
      );
    },
    cleanup() {
      ChatSystem.cleanup();
      debug.i("CHAT", "feature-chat cleanup");
    },
  },
});

function MsgNoop(): void {
  // 占位实现 — P1 阶段由 chat-gui.ts MenuNavigator 接管实际 UI。
  // 故意引入,以保持 v1 命令集合不变(避免破坏玩家已知的按键绑定)。
  void world;
}