/** QQ 官方机器人 HTTP 回调入口；HTTPS 由同机反向代理终止。 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { InteractionRouter } from "../commands/interaction-router.js";
import { log } from "../log.js";
import type { OfficialAtMessageDispatcher, OfficialC2cMessage, OfficialGroupAtMessage } from "./events.js";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_PENDING_EVENTS = 512;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface OfficialWebhookOptions {
  appId: string;
  appSecret: string;
  port: number;
  path: string;
  dispatcher: OfficialAtMessageDispatcher;
  interactionRouter?: InteractionRouter;
}

type CallbackPayload = { op?: number; t?: string; d?: unknown; id?: string; s?: number };

/** QQ 回调协议使用 AppSecret 的 UTF-8 字节循环补齐为 32 字节 Ed25519 种子。 */
function webhookPrivateKey(appSecret: string): KeyObject {
  const secret = Buffer.from(appSecret, "utf8");
  if (secret.length === 0) throw new Error("QQ AppSecret 不能为空");
  const seed = Buffer.alloc(32);
  for (let i = 0; i < seed.length; i++) seed[i] = secret[i % secret.length]!;
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

function sendJson(res: ServerResponse, status: number, value: Record<string, unknown>): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function validTimestamp(value: string): boolean {
  if (!/^\d{10,13}$/.test(value)) return false;
  const number = Number(value);
  const millis = value.length === 10 ? number * 1000 : number;
  return Math.abs(Date.now() - millis) <= MAX_CLOCK_SKEW_MS;
}

async function dispatchEvent(payload: CallbackPayload, opts: OfficialWebhookOptions): Promise<void> {
  const data = payload.d;
  switch (payload.t) {
    case "GROUP_MESSAGE_CREATE":
      await opts.dispatcher.handleGroupMessage(data as OfficialGroupAtMessage);
      break;
    case "GROUP_AT_MESSAGE_CREATE":
      await opts.dispatcher.handleGroupAtMessage(data as OfficialGroupAtMessage);
      break;
    case "C2C_MESSAGE_CREATE":
      await opts.dispatcher.handleC2cMessage(data as OfficialC2cMessage);
      break;
    case "INTERACTION_CREATE":
      await opts.interactionRouter?.handle(data);
      break;
    default:
      if (payload.t) log.info(`官方 Webhook 忽略未处理事件 t=${payload.t}`);
  }
}

/** 本地监听 HTTP；公网仅通过 HTTPS 反向代理转发指定路径。 */
export async function startOfficialWebhook(opts: OfficialWebhookOptions): Promise<{ stop: () => Promise<void> }> {
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error("official.webhook.port 必须是 1–65535 的端口");
  }
  if (!/^\/[A-Za-z0-9/_-]+$/.test(opts.path) || opts.path.includes("//")) {
    throw new Error("official.webhook.path 必须是普通绝对路径");
  }

  const privateKey = webhookPrivateKey(opts.appSecret);
  const publicKey = createPublicKey(privateKey);
  let pending = Promise.resolve();
  let pendingCount = 0;
  const recentEvents = new Map<string, number>();
  const server: Server = createServer((req, res) => {
    void (async () => {
      if (req.url !== opts.path || req.method !== "POST") {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (req.headers["x-bot-appid"] !== opts.appId) {
        sendJson(res, 403, { error: "wrong_appid" });
        return;
      }
      if (Number(req.headers["content-length"] ?? 0) > MAX_BODY_BYTES) {
        sendJson(res, 413, { error: "body_too_large" });
        return;
      }

      let raw: Buffer;
      try {
        raw = await readBody(req);
      } catch {
        sendJson(res, 413, { error: "body_too_large" });
        return;
      }
      let payload: CallbackPayload;
      try {
        payload = JSON.parse(raw.toString("utf8")) as CallbackPayload;
        if (!payload || typeof payload !== "object") throw new Error("invalid");
      } catch {
        sendJson(res, 400, { error: "invalid_json" });
        return;
      }

      if (payload.op === 13) {
        const challenge = payload.d as { plain_token?: unknown; event_ts?: unknown } | undefined;
        if (typeof challenge?.plain_token !== "string" || typeof challenge.event_ts !== "string") {
          sendJson(res, 400, { error: "invalid_challenge" });
          return;
        }
        const signature = sign(
          null,
          Buffer.from(`${challenge.event_ts}${challenge.plain_token}`, "utf8"),
          privateKey
        ).toString("hex");
        sendJson(res, 200, { plain_token: challenge.plain_token, signature });
        return;
      }

      const timestamp = req.headers["x-signature-timestamp"];
      const signature = req.headers["x-signature-ed25519"];
      if (
        typeof timestamp !== "string" ||
        typeof signature !== "string" ||
        !validTimestamp(timestamp) ||
        !/^[0-9a-fA-F]{128}$/.test(signature) ||
        !verify(null, Buffer.concat([Buffer.from(timestamp, "utf8"), raw]), publicKey, Buffer.from(signature, "hex"))
      ) {
        sendJson(res, 403, { error: "invalid_signature" });
        return;
      }
      if (payload.op !== 0 || typeof payload.t !== "string" || !payload.d || typeof payload.d !== "object") {
        sendJson(res, 400, { error: "invalid_event" });
        return;
      }
      const eventId = String(payload.id ?? (payload.d as { id?: unknown }).id ?? "");
      const dedupKey = eventId ? `${payload.t}:${eventId}` : "";
      const lastSeen = dedupKey ? recentEvents.get(dedupKey) : undefined;
      if (lastSeen && Date.now() - lastSeen < MAX_CLOCK_SKEW_MS) {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (pendingCount >= MAX_PENDING_EVENTS) {
        sendJson(res, 503, { error: "queue_full" });
        return;
      }

      if (dedupKey) {
        recentEvents.set(dedupKey, Date.now());
        if (recentEvents.size > 2048) recentEvents.delete(recentEvents.keys().next().value!);
      }
      pendingCount++;
      pending = pending
        .then(() => dispatchEvent(payload, opts))
        .catch((e: unknown) => {
          log.error(`官方 Webhook 事件处理失败: ${(e as Error).message}`);
        })
        .finally(() => {
          pendingCount--;
        });
      sendJson(res, 200, { ok: true });
    })().catch((e: unknown) => {
      log.error(`官方 Webhook 请求处理失败: ${(e as Error).message}`);
      if (!res.headersSent) sendJson(res, 500, { error: "internal_error" });
    });
  });
  server.requestTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  log.info(`官方 Webhook 已监听 http://127.0.0.1:${opts.port}${opts.path}`);
  return { stop: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))) };
}
