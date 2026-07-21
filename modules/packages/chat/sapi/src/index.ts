/**
 * @sfmc/module-chat — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - ChatSystem.registerCommands / registerEvents / init / cleanup
 *   - DogeChat:频道消息核心类(供本模块或迁到 gui 的 ChatGUI 内部使用)
 *   - 相关 chat 类型从 @sfmc/types 透传
 *
 * ChatGUI 由 @sfmc/module-chat-gui 导出,模块间 import 走包名空间。
 */

export { ChatSystem } from "./ChatSystem.js";
export { DogeChat } from "./DogeChat.js";
export type { Channel, ChannelConfig, ChatMessage, MessageType, RedPacket } from "./DogeChat.js";