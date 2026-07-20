/**
 * @sfmc/module-chat — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - ChatSystem.registerCommands / registerEvents / init / cleanup
 *   - DogeChat:频道消息核心类(供本模块或迁到 gui 的 ChatGUI 内部使用)
 *   - 相关 chat 类型从 @sfmc/types 透传
 *
 * ChatSystem 依赖 scriptsforminecraftserver/scripts/gui/ChatGUI.js,该 GUI
 * 文件按计划留在旧路径下,直到 stage H 把 gui/ChatGUI 搬走。模块导入通过
 * 5-up 相对路径指过去,行为保持等价。
 */

export { ChatSystem } from "./ChatSystem.js";
export { DogeChat } from "./DogeChat.js";
export type { Channel, ChannelConfig, ChatMessage, MessageType, RedPacket } from "./DogeChat.js";