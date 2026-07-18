/**
 * ws-server.ts — WebSocket 服务 (LLBot reverse-ws 入口)
 *
 * 端口: 3002 (默认)
 * 行为与旧实现完全一致:
 *   - 优先加载本地 node_modules/ws
 *   - 加载失败时 fallback 到 ../db-server/node_modules/ws
 *   - 每个连接把消息 JSON.parse 后交给 dispatcher
 *
 * fallback 用 createRequire 加载: 避免 TypeScript 在编译期检查
 * ../db-server/node_modules/ws 的相对路径(不在 tsconfig 包含范围)。
 */
import { WebSocketServer } from "ws";
import type { OneBotDispatcher } from "./onebot.js";
export interface WsServerOptions {
    port: number;
    dispatcher: OneBotDispatcher;
}
export declare function startWsServer(opts: WsServerOptions): Promise<WebSocketServer>;
//# sourceMappingURL=ws-server.d.ts.map