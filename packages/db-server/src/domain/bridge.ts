/**
 * domain/bridge.ts — MC → QQ 桥接（双后端）
 *
 * 数据流:
 *   SAPI ──POST──→ db-server:3001/api/sfmc/messages
 *                   └─ 写库 + forwardToQQBridge()
 *                        ├─ llbot    → LLBot:3004/send_group_msg
 *                        └─ official → OpenAPI /v2/groups/{openid}/messages
 *
 * 事件推送复用 sendGroupOutbound()（正文原样，不加聊天前缀）。
 * 失败仅 warn，不抛错、不重试（与历史 LLBot 行为一致）。
 */

import { request } from "node:http";
import {
  sendGroupTextMessage,
  type QqOfficialCredentials,
} from "@sfmc-bds/sdk/node/qq-official";
import type { QQBackend } from "@sfmc-bds/sdk/node/config";

import { log } from "../lib/log.js";

type LLBotConfig = {
  host: string;
  port: number;
  token: string;
  groupId: string;
  prefix: string;
};

export type OfficialOutboundConfig = {
  backend: "official";
  creds: QqOfficialCredentials;
  groupOpenid: string;
  prefix: string;
};

export type LlbotOutboundConfig = {
  backend: "llbot";
  llbot: LLBotConfig;
};

export type OutboundConfig = OfficialOutboundConfig | LlbotOutboundConfig;

/**
 * 构造 LLBot 桥接配置对象。
 *
 * @param env 环境变量或配置字典。
 * @returns 规范化的 LLBotConfig 配置。
 */
export function makeLLBotConfig(env: {
  LLBOT_HOST: string;
  LLBOT_PORT: number;
  LLBOT_TOKEN: string;
  QQ_GROUP_ID: string;
  MCTOQQ_PREFIX?: string;
}): LLBotConfig {
  return {
    host: env.LLBOT_HOST,
    port: env.LLBOT_PORT,
    token: env.LLBOT_TOKEN,
    groupId: env.QQ_GROUP_ID,
    prefix: env.MCTOQQ_PREFIX ?? "[MC]",
  };
}

/**
 * 根据环境变量与配置组装出站配置（支持 official 官方开放平台与 llbot 双后端）。
 *
 * @param env 环境变量与配置字典。
 * @returns 规范化的 OutboundConfig 出站配置。
 */
export function makeOutboundConfig(env: {
  QQ_BACKEND: QQBackend;
  LLBOT_HOST: string;
  LLBOT_PORT: number;
  LLBOT_TOKEN: string;
  QQ_GROUP_ID: string;
  QQ_APP_ID: string;
  QQ_APP_SECRET: string;
  QQ_SANDBOX: boolean;
  QQ_GROUP_OPENID: string;
  MCTOQQ_PREFIX: string;
}): OutboundConfig {

  if (env.QQ_BACKEND === "llbot") {
    return {
      backend: "llbot",
      llbot: makeLLBotConfig(env),
    };
  }
  return {
    backend: "official",
    creds: {
      appId: env.QQ_APP_ID,
      appSecret: env.QQ_APP_SECRET,
      sandbox: env.QQ_SANDBOX,
    },
    groupOpenid: env.QQ_GROUP_OPENID,
    prefix: env.MCTOQQ_PREFIX || "[MC]",
  };
}

function sendViaLlbot(config: LLBotConfig, text: string, logCtx: string): void {
  if (!config.groupId || config.groupId === "0") {
    log.warn(`QQ 群未配置 (qq_group_id),跳过 MC→QQ (${logCtx})`);
    return;
  }

  const payload = JSON.stringify({
    group_id: parseInt(config.groupId, 10),
    message: [{ type: "text", data: { text } }],
  });

  const headers: Record<string, string | number> = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const req = request(
    {
      hostname: config.host,
      port: config.port,
      path: "/send_group_msg",
      method: "POST",
      headers,
    },
    (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          log.warn(
            `LLBot send_group_msg → ${res.statusCode}: ${String(body).slice(0, 200)} (${logCtx})`
          );
        }
      });
    }
  );
  req.on("error", (err) => {
    log.warn(`LLBot 不可达 (${config.host}:${config.port}): ${err.message}`);
  });
  req.write(payload);
  req.end();
}

function sendViaOfficial(config: OfficialOutboundConfig, text: string, logCtx: string): void {
  if (!config.groupOpenid) {
    log.warn(`官方群 openid 未配置 (qq_group_openid),跳过 MC→QQ (${logCtx})`);
    return;
  }
  if (!config.creds.appId || !config.creds.appSecret) {
    log.warn(`官方 AppID/Secret 未配置,跳过 MC→QQ (${logCtx})`);
    return;
  }

  void sendGroupTextMessage(config.creds, {
    groupOpenid: config.groupOpenid,
    content: text,
  }).then((result) => {
    if (!result.ok) {
      log.warn(`官方发群失败: ${result.error} (${logCtx}, status=${result.status})`);
    }
  });
}

/**
 * 将文本内容直接发送至目标 QQ 群（供服务器事件通知使用，不附加玩家聊天前缀）。
 *
 * @param config 出站配置对象。
 * @param text 待发送的文本内容。
 */
export function sendGroupOutbound(config: OutboundConfig | LLBotConfig, text: string): void {
  const logCtx = "outbound";
  if (!("backend" in config)) {
    sendViaLlbot(config, text, logCtx);
    return;
  }
  if (config.backend === "llbot") {
    sendViaLlbot(config.llbot, text, logCtx);
    return;
  }
  sendViaOfficial(config, text, logCtx);
}

function forwardViaLlbot(
  config: LLBotConfig,
  channelId: string,
  fromName: string,
  content: string,
  fromId: string
): void {
  const text = `${config.prefix} ${fromName}: ${content}`;
  sendViaLlbot(config, text, `from=${fromId}, channel=${channelId}`);
}

function forwardViaOfficial(
  config: OfficialOutboundConfig,
  channelId: string,
  fromName: string,
  content: string,
  fromId: string
): void {
  const text = `${config.prefix} ${fromName}: ${content}`;
  sendViaOfficial(config, text, `from=${fromId}, channel=${channelId}`);
}

/**
 * 将游戏内玩家聊天消息附加前缀后转发至 QQ 群。
 *
 * @param config 出站配置对象。
 * @param channelId 来源频道 ID。
 * @param fromName 消息发送者玩家名称。
 * @param content 聊天消息正文。
 * @param fromId 发送者唯一标识（如 XUID）。
 */
export function forwardToQQBridge(
  config: OutboundConfig | LLBotConfig,
  channelId: string,
  fromName: string,
  content: string,
  fromId: string
): void {

  // 兼容旧调用：直接传 LLBotConfig
  if (!("backend" in config)) {
    forwardViaLlbot(config, channelId, fromName, content, fromId);
    return;
  }
  if (config.backend === "llbot") {
    forwardViaLlbot(config.llbot, channelId, fromName, content, fromId);
    return;
  }
  forwardViaOfficial(config, channelId, fromName, content, fromId);
}
