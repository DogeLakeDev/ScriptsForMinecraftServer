/**
 * ws-server.ts — WebSocket 服务端（面向 LLBot reverse-ws 反向连接）
 *
 * 监听端口：默认 3002
 * 核心机制：
 * - 依赖加载：优先加载本地 `ws` 模块，缺失时回退至工作区共享依赖
 * - 消息解包与路由分流：自动将接收到的 WebSocket 帧解析为 JSON，API echo 回包优先消费，其余事件投递至事件分发器
 */

import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import { WebSocket, WebSocketServer } from "ws";
import { llbotWsApi } from "./llbot-ws-api.js";
import { log } from "./log.js";
import type { OneBotDispatcher } from "./onebot.js";

export interface WsServerOptions {
  port: number;
  dispatcher: OneBotDispatcher;
}

const localRequire = createRequire(import.meta.url);

async function loadWs(): Promise<typeof import("ws")> {
  try {
    return localRequire("ws") as typeof import("ws");
  } catch {
    // 兜底：复用 db-server 的 ws
    return localRequire("../db-server/node_modules/ws") as typeof import("ws");
  }
}

/**
 * 启动 WebSocket 服务器并挂接 LLBot 反向连接监听。
 *
 * @param opts 包含监听端口与 OneBot 事件分发器的配置项。
 * @returns 运行中的 WebSocketServer 实例。
 */
export async function startWsServer(opts: WsServerOptions): Promise<WebSocketServer> {

  const ws = await loadWs();
  const { WebSocketServer: WSS } = ws;
  const wss = new WSS({ port: opts.port });
  log.info(`WebSocket 服务启动 ws://0.0.0.0:${opts.port}`);

  wss.on("connection", (sock: WebSocket, req: IncomingMessage) => {
    const path = req.url ?? "/";
    log.info(`LLBot 已连接 (${path})`);
    llbotWsApi.attach(sock);
    sock.on("message", (raw) => {
      try {
        const text = raw.toString("utf-8");
        const parsed: unknown = JSON.parse(text);
        // API 回包（echo）优先消费，避免误入事件分发
        if (llbotWsApi.tryHandleResponse(parsed)) return;
        // 异步但不阻塞 socket 循环
        void opts.dispatcher.handle(parsed);
      } catch (e) {
        log.error(`解析消息失败: ${(e as Error).message}`);
      }
    });
    sock.on("close", () => {
      llbotWsApi.detach(sock);
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
