/**
 * server.ts — 网关的 HTTP / WebSocket 入口
 *
 * 使用场景：main.ts 调用 startGateway 启动监听。路由按路径结尾匹配，反向代理无论是否去掉前缀都能工作：
 *   GET  …/health        存活检查（无需鉴权，只返回固定内容）
 *   GET  …/manage        WebSocket 升级，鉴权后桥接到 `sfmc manage --stdio`
 *   PUT  …/packs/inbox   上传世界包到实例收件箱（需管理鉴权）
 *   …/auth/*、…/player/* 微信登录、玩家绑定与桌面端设备登录（player-routes.ts / device-routes.ts）
 *   GET  …/player/activity 玩家查看自己的行为记录（player-activity-routes.ts）
 * 管理鉴权走鉴权链（authenticators.ts）：静态令牌、小程序管理员会话、桌面设备凭证三者等价。
 * WebSocket 鉴权失败时先完成升级再以 4401 / 4403 关闭，让客户端拿到可读的原因，而不是一个笼统的握手失败。
 */
import http from "node:http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { AuthThrottle, bearerToken, clientAddress } from "./auth.js";
import { authenticateChain, deviceAuthenticator, playerSessionAuthenticator, staticTokenAuthenticator, type Authenticator } from "./authenticators.js";
import { ManagementBridge } from "./bridge.js";
import type { GatewayConfig } from "./config.js";
import { createDbPlayerDirectory, type PlayerDirectory } from "./db-client.js";
import { createFileGrantStore, DeviceLogin, type DeviceGrantStore } from "./device-login.js";
import { createDeviceRoutes } from "./device-routes.js";
import { createDbActivitySource, type PlayerActivitySource } from "./activity-client.js";
import { createPlayerActivityRoutes } from "./player-activity-routes.js";
import { createPlayerRoutes } from "./player-routes.js";
import { findRoute, HttpError, type Route } from "./routes.js";
import { receivePack, sendJson } from "./upload.js";
import { createWechatIdentity, type WechatIdentity } from "./wechat.js";

/** 自定义关闭码：令牌无效 / 无管理权限 / 尝试过多 / 会话已满（4000–4999 为应用自定义区间） */
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_FORBIDDEN = 4403;
export const CLOSE_THROTTLED = 4429;
export const CLOSE_BUSY = 4503;
/** 鉴权依赖（db-server）暂时不可用：标准关闭码 1013 Try Again Later */
const CLOSE_TRY_AGAIN = 1013;
/** 单个请求帧上限，与 CLI 管理通道的 4MB 帧限制一致 */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
/** 心跳间隔：两次未回应 pong 即判定连接失效 */
const HEARTBEAT_MS = 30_000;

/** 运行中的网关句柄，main.ts 用它优雅退出 */
export interface RunningGateway {
  server: http.Server;
  close(): Promise<void>;
}

/**
 * 可替换的外部依赖（DIP）。
 * 使用场景：生产环境全部取默认实现；单测注入假微信身份、内存绑定目录与内存授权存储，不访问微信与 db-server。
 */
export interface GatewayDeps {
  wechat?: WechatIdentity | null;
  directory?: PlayerDirectory;
  /** 玩家行为记录数据源；缺省经 db-server 读取 */
  activity?: PlayerActivitySource;
  grantStore?: DeviceGrantStore;
  log?: (message: string) => void;
}

/** 带时间戳的网关日志 */
function defaultLog(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/** 管理鉴权的拒绝结果 */
interface Denied {
  status: 401 | 403 | 429 | 503;
  message: string;
}

/** 启动网关监听 */
export function startGateway(config: GatewayConfig, deps: GatewayDeps = {}): Promise<RunningGateway> {
  const log = deps.log ?? defaultLog;
  const throttle = new AuthThrottle();
  const bridges = new Set<ManagementBridge>();
  const alive = new WeakMap<WebSocket, boolean>();

  const wechat = deps.wechat !== undefined ? deps.wechat : config.wechat ? createWechatIdentity(config.wechat) : null;
  const directory = deps.directory ?? createDbPlayerDirectory(config.dbUrl);
  const devices = new DeviceLogin(deps.grantStore ?? createFileGrantStore(config.devicesFile));
  const playerAuth = { sessionSecret: config.sessionSecret, directory };

  /** 管理鉴权链：未启用微信登录时只有静态令牌 */
  const chain: Authenticator[] = [staticTokenAuthenticator(config.token)];
  if (wechat) chain.push(playerSessionAuthenticator(config.sessionSecret, directory), deviceAuthenticator(devices, directory));

  /**
   * 管理鉴权：返回 null 表示通过，否则返回拒绝原因与状态。
   * 使用场景：WebSocket 升级与世界包上传两个入口共用。只有“凭证无效”计入失败限流。
   */
  const authorize = async (request: http.IncomingMessage): Promise<Denied | null> => {
    const address = clientAddress(request, config.trustProxy);
    if (throttle.blocked(address)) return { status: 429, message: "鉴权失败次数过多，请稍后再试" };
    let outcome;
    try {
      outcome = await authenticateChain(chain, bearerToken(request));
    } catch (error) {
      return { status: 503, message: error instanceof Error ? error.message : "鉴权服务暂不可用" };
    }
    if (outcome.ok) {
      throttle.succeed(address);
      return null;
    }
    if (outcome.status === 401) {
      throttle.fail(address);
      log(`鉴权失败: ${address}`);
    }
    return outcome;
  };

  /** 世界包上传（原有接口，改用鉴权链） */
  const uploadRoute: Route = {
    method: "PUT",
    suffix: "/packs/inbox",
    async handle({ request, response, url, address }) {
      const denied = await authorize(request);
      if (denied) {
        sendJson(response, denied.status, { error: denied.message });
        request.resume();
        return;
      }
      await receivePack(request, response, url, config);
      if (response.statusCode === 200) log(`已接收世界包上传 (${address})`);
    },
  };

  const routes: Route[] = [
    { method: "GET", suffix: "/health", handle: ({ response }) => sendJson(response, 200, { ok: true, service: "sfmc-mp-gateway" }) },
    uploadRoute,
    ...createPlayerRoutes({ ...playerAuth, wechat, loginThrottle: new AuthThrottle(), log }),
    ...createDeviceRoutes({ ...playerAuth, wechatEnabled: Boolean(wechat), devices, startThrottle: new AuthThrottle(10, 60_000), log }),
    ...createPlayerActivityRoutes({ ...playerAuth, wechatEnabled: Boolean(wechat), activity: deps.activity ?? createDbActivitySource(config.dbUrl) }),
  ];

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://gateway.local");
    const route = findRoute(routes, request.method ?? "GET", url.pathname);
    if (!route) {
      sendJson(response, 404, { error: "not found" });
      return;
    }
    const address = clientAddress(request, config.trustProxy);
    void Promise.resolve()
      .then(() => route.handle({ request, response, url, address }))
      .catch((error: unknown) => {
        const status = error instanceof HttpError ? error.status : 500;
        if (status === 500) log(`请求处理失败 ${url.pathname}: ${error instanceof Error ? error.message : String(error)}`);
        if (!response.headersSent) sendJson(response, status, { error: error instanceof Error ? error.message : "内部错误" });
        else response.destroy();
        request.resume();
      });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://gateway.local");
    if (!url.pathname.endsWith("/manage")) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      // 鉴权可能要查 db-server（异步）；客户端在 onOpen 后立刻发出的握手帧先暂存，桥接建立后按序重放，避免丢帧。
      const early: Array<[RawData, boolean]> = [];
      const hold = (data: RawData, isBinary: boolean) => early.push([data, isBinary]);
      ws.on("message", hold);
      void authorize(request).then((denied) => {
        ws.off("message", hold);
        if (denied) {
          const code =
            denied.status === 429 ? CLOSE_THROTTLED : denied.status === 403 ? CLOSE_FORBIDDEN : denied.status === 503 ? CLOSE_TRY_AGAIN : CLOSE_UNAUTHORIZED;
          ws.close(code, denied.message);
          return;
        }
        if (ws.readyState !== ws.OPEN) return;
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
        for (const [data, isBinary] of early) ws.emit("message", data, isBinary);
        log(`管理会话建立: ${address}（在线 ${bridges.size}）`);
      });
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
