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
import { createRequire } from "node:module";
import { WebSocket, WebSocketServer } from "ws";
import { log } from "./log.js";
const localRequire = createRequire(import.meta.url);
async function loadWs() {
    try {
        return localRequire("ws");
    }
    catch {
        // 兜底:复用 db-server 的 ws
        return localRequire("../db-server/node_modules/ws");
    }
}
export async function startWsServer(opts) {
    const ws = await loadWs();
    const { WebSocketServer: WSS } = ws;
    const wss = new WSS({ port: opts.port });
    log.info(`WebSocket 服务启动 ws://0.0.0.0:${opts.port}`);
    wss.on("connection", (sock, req) => {
        const path = req.url ?? "/";
        log.info(`LLBot 已连接 (${path})`);
        sock.on("message", (raw) => {
            try {
                const text = raw.toString("utf-8");
                const parsed = JSON.parse(text);
                // 异步但不阻塞 socket 循环
                void opts.dispatcher.handle(parsed);
            }
            catch (e) {
                log.error(`解析消息失败: ${e.message}`);
            }
        });
        sock.on("close", () => {
            log.info("LLBot 已断开");
        });
        sock.on("error", (err) => {
            log.error(`WebSocket 连接错误: ${err.message}`);
        });
    });
    wss.on("error", (err) => {
        log.error(`WebSocket 服务器错误: ${err.message}`);
    });
    return wss;
}
//# sourceMappingURL=ws-server.js.map