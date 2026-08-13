/**
 * official/gateway.ts — QQ 开放平台 Gateway（WebSocket）客户端
 *
 * 流程: getAccessToken → GET /gateway/bot → Hello → Identify → 心跳 / Resume
 * 仅订阅 GROUP_AND_C2C_EVENT，处理 GROUP_AT_MESSAGE_CREATE。
 */

import {
  QQ_INTENT_GROUP_C2C_INTERACTION,
  QqAccessTokenManager,
  fetchGatewayUrl,
  type QqOfficialCredentials,
} from "@sfmc-bds/sdk/node/qq-official";
import { createRequire } from "node:module";
import { log } from "../log.js";
import type { InteractionRouter } from "../commands/interaction-router.js";
import type { OfficialAtMessageDispatcher, OfficialC2cMessage, OfficialGroupAtMessage } from "./events.js";

const localRequire = createRequire(import.meta.url);

const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_RESUME = 6;
const OP_RECONNECT = 7;
const OP_INVALID_SESSION = 9;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

type WsPayload = {
  op: number;
  d?: unknown;
  s?: number | null;
  t?: string;
};

export type OfficialGatewayOptions = {
  creds: QqOfficialCredentials;
  dispatcher: OfficialAtMessageDispatcher;
  /** INTERACTION 回调分发 */
  interactionRouter?: InteractionRouter;
  /** 测试可注入；默认用 tokenManager */
  tokenManager?: QqAccessTokenManager;
};

async function loadWs(): Promise<typeof import("ws")> {
  try {
    return localRequire("ws") as typeof import("ws");
  } catch {
    return localRequire("../db-server/node_modules/ws") as typeof import("ws");
  }
}

/**
 * 启动官方 Gateway；返回 stop()。断线自动重连（指数退避，上限 60s）。
 */
export async function startOfficialGateway(opts: OfficialGatewayOptions): Promise<{ stop: () => void }> {
  const tokenManager =
    opts.tokenManager ?? new QqAccessTokenManager(opts.creds);
  let stopped = false;
  let ws: import("ws").WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionId: string | null = null;
  let lastSeq: number | null = null;
  let reconnectAttempt = 0;
  let botSelfId: string | null = null;

  const clearHeartbeat = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const sendJson = (payload: WsPayload): void => {
    if (!ws || ws.readyState !== 1 /* OPEN */) return;
    ws.send(JSON.stringify(payload));
  };

  const startHeartbeat = (intervalMs: number): void => {
    clearHeartbeat();
    const period = Math.max(5000, intervalMs);
    heartbeatTimer = setInterval(() => {
      sendJson({ op: OP_HEARTBEAT, d: lastSeq });
    }, period);
  };

  const handleDispatch = async (t: string | undefined, d: unknown, s: number | null | undefined): Promise<void> => {
    if (typeof s === "number") lastSeq = s;
    // 诊断：任何 Dispatch 都打一行（排障「@了但没日志」）
    if (t && t !== "READY" && t !== "RESUMED") {
      const preview =
        t === "GROUP_AT_MESSAGE_CREATE" || t === "C2C_MESSAGE_CREATE"
          ? (() => {
              const msg = d as { group_openid?: string; content?: string; author?: { id?: string } };
              return ` group=${msg.group_openid ?? "—"} author=${msg.author?.id ?? "—"} content=${JSON.stringify(String(msg.content ?? "").slice(0, 80))}`;
            })()
          : "";
      log.info(`官方 Dispatch t=${t}${preview}`);
    }
    if (t === "READY") {
      const ready = d as { session_id?: string; user?: { id?: string; username?: string } };
      sessionId = String(ready.session_id ?? "") || null;
      botSelfId = ready.user?.id ? String(ready.user.id) : null;
      reconnectAttempt = 0;
      log.info(
        `官方 Gateway READY (session=${sessionId ?? "?"}, bot=${ready.user?.username ?? botSelfId ?? "?"}, intents=${QQ_INTENT_GROUP_C2C_INTERACTION})`
      );
      return;
    }
    if (t === "RESUMED") {
      reconnectAttempt = 0;
      log.info("官方 Gateway 会话已恢复 (RESUMED)");
      return;
    }
    if (t === "GROUP_AT_MESSAGE_CREATE") {
      await opts.dispatcher.handleGroupAtMessage(d as OfficialGroupAtMessage);
      return;
    }
    if (t === "C2C_MESSAGE_CREATE") {
      await opts.dispatcher.handleC2cMessage(d as OfficialC2cMessage);
      return;
    }
    if (t === "INTERACTION_CREATE") {
      if (opts.interactionRouter) {
        await opts.interactionRouter.handle(d);
      } else {
        log.warn("收到 INTERACTION_CREATE 但未配置 interactionRouter");
      }
      return;
    }
  };

  const scheduleReconnect = (): void => {
    if (stopped) return;
    clearHeartbeat();
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
    reconnectAttempt += 1;
    log.warn(`官方 Gateway 将在 ${delay}ms 后重连 (attempt=${reconnectAttempt})`);
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;
    try {
      const token = await tokenManager.getAccessToken();
      const gatewayUrl = await fetchGatewayUrl(opts.creds, { tokenManager });
      const wsMod = await loadWs();
      const { WebSocket } = wsMod;

      await new Promise<void>((resolve, reject) => {
        const sock = new WebSocket(gatewayUrl);
        ws = sock;
        let helloDone = false;

        const fail = (err: Error): void => {
          try {
            sock.close();
          } catch {
            /* ignore */
          }
          reject(err);
        };

        sock.on("open", () => {
          log.info(`官方 Gateway 已连接 ${gatewayUrl}`);
        });

        sock.on("message", (raw) => {
          void (async () => {
            let payload: WsPayload;
            try {
              payload = JSON.parse(raw.toString("utf-8")) as WsPayload;
            } catch (e) {
              log.error(`官方 Gateway 解析失败: ${(e as Error).message}`);
              return;
            }

            if (payload.op === OP_HELLO) {
              const interval = Number(
                (payload.d as { heartbeat_interval?: number } | undefined)?.heartbeat_interval ?? 41250
              );
              startHeartbeat(interval);
              if (sessionId && lastSeq !== null) {
                sendJson({
                  op: OP_RESUME,
                  d: {
                    token: `QQBot ${token}`,
                    session_id: sessionId,
                    seq: lastSeq,
                  },
                });
              } else {
                log.info(`官方 Gateway Identify intents=${QQ_INTENT_GROUP_C2C_INTERACTION} (GROUP_C2C+INTERACTION)`);
                sendJson({
                  op: OP_IDENTIFY,
                  d: {
                    token: `QQBot ${token}`,
                    intents: QQ_INTENT_GROUP_C2C_INTERACTION,
                    shard: [0, 1],
                    properties: {
                      $os: process.platform,
                      $browser: "sfmc-qq-bridge",
                      $device: "sfmc-qq-bridge",
                    },
                  },
                });
              }
              helloDone = true;
              resolve();
              return;
            }

            if (payload.op === OP_HEARTBEAT_ACK) return;

            if (payload.op === OP_RECONNECT) {
              log.warn("官方 Gateway 要求重连 (op=7)");
              try {
                sock.close();
              } catch {
                /* ignore */
              }
              return;
            }

            if (payload.op === OP_INVALID_SESSION) {
              log.warn("官方 Gateway Invalid Session，清空 session 后重连");
              sessionId = null;
              lastSeq = null;
              try {
                sock.close();
              } catch {
                /* ignore */
              }
              return;
            }

            if (payload.op === OP_DISPATCH) {
              await handleDispatch(payload.t, payload.d, payload.s ?? null);
            }
          })();
        });

        sock.on("close", () => {
          clearHeartbeat();
          ws = null;
          if (!helloDone) {
            fail(new Error("Gateway 在 Hello 前关闭"));
            return;
          }
          if (!stopped) scheduleReconnect();
        });

        sock.on("error", (err) => {
          log.error(`官方 Gateway 错误: ${err.message}`);
          if (!helloDone) fail(err);
        });
      });
    } catch (e) {
      log.error(`官方 Gateway 连接失败: ${(e as Error).message}`);
      scheduleReconnect();
    }
  };

  await connect();

  return {
    stop: () => {
      stopped = true;
      clearHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}

/** 供 status 命令读取（当前进程内无全局 self_id 导出时由 index 持有） */
export type OfficialGatewayHandle = Awaited<ReturnType<typeof startOfficialGateway>>;

