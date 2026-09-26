/**
 * commands/reply-llbot.ts — LLBot ReplyPort
 *
 * 优先经 reverse-WS 调 send_group_msg；WS 不可用时再回退 HTTP(llbot.port)。
 */

import { request } from "node:http";
import { llbotWsApi } from "../llbot-ws-api.js";
import { log } from "../log.js";
import { splitMessage } from "./message-text.js";
import { renderLlbot } from "./render.js";
import type { CommandResult, InboundMessage, ReplyPort, ReplyTarget } from "./types.js";

export type LlbotReplyConfig = {
  host: string;
  port: number;
  token: string;
  groupId: string;
};

export function createLlbotReplyPort(cfg: LlbotReplyConfig): ReplyPort {
  return {
    async send(_target: ReplyTarget, result: CommandResult, _inbound: InboundMessage): Promise<void> {
      if (!cfg.groupId || cfg.groupId === "0") {
        throw new Error("llbot llbot.group_id 未配置");
      }
      const { text } = renderLlbot(result);

      for (const part of splitMessage(text)) {
        if (llbotWsApi.connected) {
          await llbotWsApi.sendGroupMsg(cfg.groupId, part);
        } else {
          log.warn("LLBot reverse-ws 未连接，回退 HTTP send_group_msg");
          await sendGroupMsgHttp(cfg, part);
        }
      }
    },
  };
}

function sendGroupMsgHttp(cfg: LlbotReplyConfig, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      group_id: parseInt(cfg.groupId, 10),
      message: [{ type: "text", data: { text } }],
    });
    const headers: Record<string, string | number> = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    };
    if (cfg.token) {
      headers["Authorization"] = `Bearer ${cfg.token}`;
    }
    const req = request(
      {
        hostname: cfg.host,
        port: cfg.port,
        path: "/send_group_msg",
        method: "POST",
        timeout: 5_000,
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            log.warn(`LLBot HTTP send_group_msg → ${res.statusCode}: ${body.slice(0, 200)}`);
            reject(new Error(`LLBot HTTP ${res.statusCode}`));
            return;
          }
          try {
            const result = JSON.parse(body) as { status?: string; retcode?: number };
            if (result.status !== "ok" || result.retcode !== 0) throw new Error("LLBot 发送失败");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("LLBot 请求超时")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
