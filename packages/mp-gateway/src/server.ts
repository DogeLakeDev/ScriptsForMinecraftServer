/**
 * server.ts — 网关的 HTTP / WebSocket 入口
 *
 * 使用场景：main.ts 调用 startGateway 启动监听。路由按路径结尾匹配，反向代理无论是否去掉前缀都能工作：
 *   GET  …/health        存活检查（无需鉴权，只返回固定内容）
 *   GET  …/manage        WebSocket 升级，鉴权后桥接到 `sfmc manage --stdio`
 *   PUT  …/packs/inbox   上传世界包到实例收件箱（需鉴权）
 * WebSocket 鉴权失败时先完成升级再以 4401 关闭，让小程序拿到可读的原因，而不是一个笼统的握手失败。
 */
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { AuthThrottle, bearerToken, clientAddress, tokenMatches } from "./auth.js";
import { ManagementBridge } from "./bridge.js";
import type { GatewayConfig } from "./config.js";
import { receivePack, sendJson } from "./upload.js";

/** 自定义关闭码：令牌无效 / 尝试过多 / 会话已满（4000–4999 为应用自定义区间） */
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_THROTTLED = 4429;
export const CLOSE_BUSY = 4503;
/** 单个请求帧上限，与 CLI 管理通道的 4MB 帧限制一致 */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
/** 心跳间隔：两次未回应 pong 即判定连接失效 */
const HEARTBEAT_MS = 30_000;

/** 运行中的网关句柄，main.ts 用它优雅退出 */
export interface RunningGateway {
  server: http.Server;
  close(): Promise<void>;
}

/** 带时间戳的网关日志 */
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/** 启动网关监听 */
export function startGateway(config: GatewayConfig): Promise<RunningGateway> {
  const throttle = new AuthThrottle();
  const bridges = new Set<ManagementBridge>();
  const alive = new WeakMap<WebSocket, boolean>();

  /**
   * 鉴权：返回 null 表示通过，否则返回拒绝原因与状态。
   * 使用场景：WebSocket 升级与上传两个入口共用。
   */
  const authorize = (request: http.IncomingMessage): { status: 401 | 429; message: string } | null => {
    const address = clientAddress(request, config.trustProxy);
    if (throttle.blocked(address)) return { status: 429, message: "鉴权失败次数过多，请稍后再试" };
    if (!tokenMatches(config.token, bearerToken(request))) {
      throttle.fail(address);
      log(`鉴权失败: ${address}`);
      return { status: 401, message: "访问令牌无效" };
    }
    throttle.succeed(address);
    return null;
  };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://gateway.local");
    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      sendJson(response, 200, { ok: true, service: "sfmc-mp-gateway" });
      return;
    }
    if (request.method === "PUT" && url.pathname.endsWith("/packs/inbox")) {
      const denied = authorize(request);
      if (denied) {
        sendJson(response, denied.status, { error: denied.message });
        request.resume();
        return;
      }
      void receivePack(request, response, url, config).then(() => {
        if (response.statusCode === 200) log(`已接收世界包上传 (${clientAddress(request, config.trustProxy)})`);
      });
      return;
    }
    sendJson(response, 404, { error: "not found" });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://gateway.local");
    if (!url.pathname.endsWith("/manage")) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const denied = authorize(request);
      if (denied) {
        ws.close(denied.status === 429 ? CLOSE_THROTTLED : CLOSE_UNAUTHORIZED, denied.message);
        return;
      }
      if (bridges.size >= config.maxSessions) {
        ws.close(CLOSE_BUSY, "管理会话已满，请关闭其他设备上的连接");
        return;
      }
      alive.set(ws, true);
      ws.on("pong", () => alive.set(ws, true));
      const address = clientAddress(request, config.trustProxy);
      const bridge = new ManagementBridge(ws, config, log, () => {
        if (bridges.delete(bridge)) log(`管理会话结束: ${address}（在线 ${bridges.size}）`);
      });
      bridges.add(bridge);
      bridge.start();
      log(`管理会话建立: ${address}（在线 ${bridges.size}）`);
    });
  });

  // 移动网络切后台时常常不发 FIN，靠心跳及时回收子进程。
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve({
        server,
        close: async () => {
          clearInterval(heartbeat);
          for (const bridge of [...bridges]) bridge.shutdown(1001, "网关正在关闭");
          wss.close();
          await new Promise<void>((done) => server.close(() => done()));
        },
      });
    });
  });
}
