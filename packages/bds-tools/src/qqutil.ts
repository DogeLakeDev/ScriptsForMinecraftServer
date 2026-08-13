/**
 * qqutil.ts — QQ 通知工具（官方 Bot / LLBot 双后端）
 *
 * 改进:
 *  - sendTimeout 提供总超时，避免通知发送挂死主流程
 *  - 静默模式 (失败不抛出)，保证主流程不被通知干扰
 *  - qq_backend=official 时走 SDK 发群；llbot 仍走 OneBot HTTP
 */

import {
  configPath,
  modulePath,
  readJson,
  type Catalog,
  type ModuleLock,
  type QQBridgeConfig,
} from "@sfmc-bds/sdk/node/config";
import { sendGroupTextMessage } from "@sfmc-bds/sdk/node/qq-official";
import http from "node:http";
import { log } from "./log.js";
import { ROOT_DIR } from "./paths.js";

type QqConfig = Pick<
  QQBridgeConfig,
  | "llbot_http"
  | "qq_group_id"
  | "qq_backend"
  | "qq_app_id"
  | "qq_app_secret"
  | "qq_sandbox"
  | "qq_group_openid"
>;

let cachedCfg: QqConfig | null = null;
function getConfig(): QqConfig {
  if (cachedCfg) return cachedCfg;
  cachedCfg = (readJson<QQBridgeConfig>(configPath(ROOT_DIR, "qq_config.json")) ?? {}) as QqConfig;
  return cachedCfg;
}

/** 检查 qq-bridge 模块是否启用 */
export function isQqBridgeEnabled(): boolean {
  const catalog = readJson<Catalog>(modulePath(ROOT_DIR, "catalog.json"));
  const lock = readJson<ModuleLock>(modulePath(ROOT_DIR, "module-lock.json"));
  if (!catalog || !lock) return true; // 模块目录缺失则保守视为可用
  const mod = catalog.modules?.find((m) => m.id === "qq-bridge" || m.configKey === "qq_bridge") as
    | { id?: string }
    | undefined;
  return mod ? lock.modules?.[mod.id ?? ""]?.enabled === true : false;
}

function isOfficialBackend(cfg: QqConfig): boolean {
  return (cfg.qq_backend ?? "official") === "official";
}

function sendToLLBot(payload: unknown, timeoutMs = 5_000): Promise<void> {
  const cfg = getConfig();
  const url = new URL(cfg.llbot_http || "http://127.0.0.1:3004");
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 3004,
        path: "/send_group_msg",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`LLBot HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`LLBot 超时 ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function safeSend(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    log.warn(`[QQ] ${label} 失败: ${(e as Error).message}`);
  }
}

async function sendOfficialText(text: string): Promise<void> {
  const cfg = getConfig();
  const appId = String(cfg.qq_app_id ?? "");
  const appSecret = String(cfg.qq_app_secret ?? "");
  const groupOpenid = String(cfg.qq_group_openid ?? "");
  if (!appId || !appSecret || !groupOpenid) {
    throw new Error("官方后端缺少 qq_app_id / qq_app_secret / qq_group_openid");
  }
  const result = await sendGroupTextMessage(
    { appId, appSecret, sandbox: cfg.qq_sandbox === true },
    { groupOpenid, content: text }
  );
  if (!result.ok) throw new Error(result.error);
}

export async function sendText(text: string): Promise<void> {
  const cfg = getConfig();
  if (!isQqBridgeEnabled()) {
    log.warn("[QQ] qq-bridge 未启用");
    return;
  }
  if (isOfficialBackend(cfg)) {
    await safeSend("sendText(official)", () => sendOfficialText(text));
    return;
  }
  if (!cfg.qq_group_id) {
    log.warn("[QQ] qq_group_id 缺失");
    return;
  }
  await safeSend("sendText(llbot)", () =>
    sendToLLBot({
      group_id: parseInt(cfg.qq_group_id ?? "0", 10),
      message: [{ type: "text", data: { text } }],
    })
  );
}

export async function sendMixed(segments: unknown[]): Promise<void> {
  const cfg = getConfig();
  if (!isQqBridgeEnabled()) {
    log.warn("[QQ] qq-bridge 未启用");
    return;
  }
  if (isOfficialBackend(cfg)) {
    // 官方路径仅拼纯文本；图片段降级为 [图片]
    const text = segments
      .map((seg) => {
        const s = seg as { type?: string; data?: { text?: string } };
        if (s?.type === "text") return String(s.data?.text ?? "");
        if (s?.type === "image") return "[图片]";
        return "";
      })
      .join("")
      .trim();
    if (!text) return;
    await safeSend("sendMixed(official)", () => sendOfficialText(text));
    return;
  }
  if (!cfg.qq_group_id) {
    log.warn("[QQ] qq_group_id 缺失");
    return;
  }
  await safeSend("sendMixed(llbot)", () =>
    sendToLLBot({
      group_id: parseInt(cfg.qq_group_id ?? "0", 10),
      message: segments,
    })
  );
}

export async function sendWithImage(text: string, base64Img: string): Promise<void> {
  const segments: unknown[] = [];
  if (text) segments.push({ type: "text", data: { text } });
  if (base64Img) segments.push({ type: "image", data: { file: `base64://${base64Img}` } });
  if (segments.length === 0) return;
  await sendMixed(segments);
}
