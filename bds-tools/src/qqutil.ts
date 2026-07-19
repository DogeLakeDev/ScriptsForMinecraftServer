/**
 * qqutil.ts — QQ 通知工具 (基于 LLBot HTTP OneBot 11)
 *
 * 改进:
 *  - sendTimeout 提供总超时，避免通知发送挂死主流程
 *  - 静默模式 (失败不抛出)，保证主流程不被通知干扰
 */

import http from "node:http";
import fs from "node:fs";
import { configPath, modulePath } from "@sfmc/config";
import { ROOT_DIR } from "./paths.js";
import { log } from "./log.js";

interface QqConfig {
  llbot_http?: string;
  qq_group_id?: string;
}

let cachedCfg: QqConfig | null = null;
function getConfig(): QqConfig {
  if (cachedCfg) return cachedCfg;
  const cfgPath = configPath(ROOT_DIR, "qq_config.json");
  try {
    cachedCfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8")) as QqConfig;
  } catch {
    cachedCfg = {};
  }
  return cachedCfg;
}

/** 检查 qq-bridge 模块是否启用 */
export function isQqBridgeEnabled(): boolean {
  try {
    const catalog = JSON.parse(fs.readFileSync(modulePath(ROOT_DIR, "catalog.json"), "utf-8")) as { modules?: Array<{ id?: string; configKey?: string }> };
    const lock = JSON.parse(fs.readFileSync(modulePath(ROOT_DIR, "module-lock.json"), "utf-8")) as { modules?: Record<string, { enabled?: boolean }> };
    const mod = catalog.modules?.find((m) => m.id === "qq-bridge" || m.configKey === "qq_bridge");
    return mod ? lock.modules?.[mod.id ?? ""]?.enabled === true : false;
  } catch {
    return true; // 默认开启: 模块目录缺失则保守视为可用
  }
}

function sendToLLBot(payload: unknown, timeoutMs = 5_000): Promise<void> {
  const cfg = getConfig();
  const url = new URL(cfg.llbot_http || "http://127.0.0.1:3000");
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 3000,
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

export async function sendText(text: string): Promise<void> {
  const cfg = getConfig();
  if (!isQqBridgeEnabled() || !cfg.qq_group_id) {
    log.warn("[QQ] qq-bridge 未启用或 qq_group_id 缺失");
    return;
  }
  await safeSend("sendText", () =>
    sendToLLBot({
      group_id: parseInt(cfg.qq_group_id ?? "0", 10),
      message: [{ type: "text", data: { text } }],
    })
  );
}

export async function sendMixed(segments: unknown[]): Promise<void> {
  const cfg = getConfig();
  if (!isQqBridgeEnabled() || !cfg.qq_group_id) {
    log.warn("[QQ] qq-bridge 未启用或 qq_group_id 缺失");
    return;
  }
  await safeSend("sendMixed", () =>
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
