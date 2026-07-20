/**
 * @sfmc/module-chat-gui — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - ChatGUI.openChannelPanel / openPrivateChatPanel / sendLocation / sendTeleportInvite
 *   - ChatGUI.openRedPacketPanel / sendRedPacketQuick
 *
 * 内部 API 调用折叠在 ./ChatApi.ts(原 scripts/api/ChatApi.ts)
 */

export { ChatGUI } from "./ChatGUI.js";
export * as ChatApi from "./ChatApi.js";