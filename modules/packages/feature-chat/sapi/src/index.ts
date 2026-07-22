/**
 * @sfmc/module-feature-chat — v2 入口
 *
 * 合并 v1 chat + chat-gui 后,sapi 入口只剩一个 ModuleRegistry.register:
 *   - registerPermissions / registerCommands / registerEvents
 *   - lifecycle.init / cleanup
 *
 * 业务拆分:
 *   chat-system — init/cleanup + 命令/事件注册
 *   doge-chat   — 消息/频道/红包业务
 *   chat-api    — db.tx / db.query 包装(平台 bootstrap 表)
 *   chat-gui    — MenuNavigator UI
 */

import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission, debug } from "@sfmc/sdk/sapi/runtime";

import { ChatSystem } from "./chat-system.js";

const MODULE_ID = "feature-chat";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("chat.use", Permission.Member);
    },
    registerCommands() {
      ChatSystem.registerCommands();
    },
    registerEvents() {
      ChatSystem.registerEvents();
    },
    async init() {
      ChatSystem.init();
      debug.i("CHAT", "feature-chat init");
    },
    cleanup() {
      ChatSystem.cleanup();
      debug.i("CHAT", "feature-chat cleanup");
    },
  },
});

export { ChatGUI } from "./chat-gui.js";
export { DogeChat } from "./doge-chat.js";
export { ChatSystem } from "./chat-system.js";
export * as ChatApi from "./chat-api.js";