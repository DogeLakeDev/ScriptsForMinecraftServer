/**
 * dbserver.ts — 转发 QQ 消息至 db-server 消息聚合端点（/api/sfmc/messages）
 *
 * 核心机制：
 * - 消息标准化：将外部群消息构造为标准 `IncomingChatMessage` 对象（发送者标识统一加上 `qq_` 前缀）
 * - 快速响应与容错：请求超时（5 秒）后自动熔断；转发失败仅记录告警日志，不阻塞主事件循环
 */

import { request as httpRequest, type RequestOptions } from "node:http";
import { log } from "./log.js";
import type { IncomingChatMessage, PostMessagesBody } from "./types.js";

export interface DBServerConfig {
  host: string;
  port: number;
  channelId: string;
}

const REQUEST_TIMEOUT_MS = 5_000;

function postJSON<T>(url: URL, body: unknown, timeoutMs: number): Promise<T> {
  const payload = JSON.stringify(body);
  const options: RequestOptions = {
    hostname: url.hostname,
    port: url.port || "3001",
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
    timeout: timeoutMs,
  };
  return new Promise<T>((resolve, reject) => {
    const req = httpRequest(options, (res) => {
      let buf = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        buf += chunk;
      });
      res.on("end", () => {
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 300) {
          try {
            resolve(JSON.parse(buf) as T);
          } catch {
            // 允许返回非 JSON：仍视为成功
            resolve(buf as unknown as T);
          }
        } else {
          reject(new Error(`db-server ${code}: ${buf.slice(0, 200)}`));
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`db-server 超时 ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * 构造标准聊天消息结构体并 POST 发送至 db-server 消息端点。
 *
 * @param cfg db-server 目标连接与频道配置。
 * @param fromId 发送方唯一标识符（通常形如 `qq_<user_id>`）。
 * @param fromName 发送方展示昵称。
 * @param content 消息纯文本内容。
 * @param now 消息时间戳（毫秒，默认取当前时间）。
 */
export async function forwardGroupMessage(
  cfg: DBServerConfig,
  fromId: string,
  fromName: string,
  content: string,
  now: number = Date.now()
): Promise<void> {
  const message: IncomingChatMessage = {
    id: `${fromId}_${now}`,
    channelId: cfg.channelId,
    fromid: fromId,
    fromName,
    type: "text",
    content,
    showTimestamp: true,
    timestamp: now,
  };
  const body: PostMessagesBody = { messages: [message] };
  const url = new URL(`http://${cfg.host}:${cfg.port}/api/sfmc/messages`);
  await postJSON<unknown>(url, body, REQUEST_TIMEOUT_MS);
}

/**
 * 安全转发消息至 db-server（内部捕获异常并记录日志，避免抛出给主事件循环）。
 *
 * @param cfg db-server 连接配置。
 * @param fromId 发送方唯一标识符。
 * @param fromName 发送方昵称。
 * @param content 消息文本内容。
 */
export async function tryForward(
  cfg: DBServerConfig,
  fromId: string,
  fromName: string,
  content: string
): Promise<void> {
  try {
    await forwardGroupMessage(cfg, fromId, fromName, content);
    log.info(`QQ → MC: ${fromName}: ${content.slice(0, 60)}`);
  } catch (e) {
    log.error(`转发到 db-server 失败: ${(e as Error).message}`);
  }
}

