/**
 * domain/bridge.ts — MC → QQ 桥接
 *
 * db-server 收到 SAPI 上报的消息后,直接调 LLBot HTTP `/send_group_msg`
 * 把消息转发到 QQ 群。不再走中间 qq-bridge 进程。
 *
 * 数据流:
 *   SAPI ──POST──→ db-server:3001/api/sfmc/messages
 *                   └─ 写库 + forwardToQQBridge() ──HTTP──→ LLBot:3004/send_group_msg
 *
 * 事务描述:
 *   - 无 DB 事务(本文件不操作 SQLite,只做 HTTP 出站转发)
 *
 * 领域函数:
 *   - makeLLBotConfig(env)  工厂:从 env 构造 LLBotConfig
 *   - forwardToQQBridge()   转发单条 MC 消息到 LLBot;失败仅 warn,不抛错
 */

import { request } from "node:http";

type LLBotConfig = {
  host: string;
  port: number;
  token: string;
  groupId: string;
  prefix: string;
};

/**
 * 构造 LLBotConfig。允许显式传入(测试),默认从 env 推不出,
 * 所以调用方需自己把 env 里读到的值传进来。
 */
export function makeLLBotConfig(env: {
  LLBOT_HOST: string;
  LLBOT_PORT: number;
  LLBOT_TOKEN: string;
  QQ_GROUP_ID: string;
}): LLBotConfig {
  return {
    host: env.LLBOT_HOST,
    port: env.LLBOT_PORT,
    token: env.LLBOT_TOKEN,
    groupId: env.QQ_GROUP_ID,
    prefix: "[MC]",
  };
}

/**
 * @description
 * @author Shiroha7z
 * @date 17/07/2026
 * @export
 * @param {LLBotConfig} config LLBot 连接信息(host/port/token/groupId/prefix)
 * @param {string} channelId   MC 频道 ID(用于过滤 / 标记,目前仅做日志)
 * @param {string} fromName    MC 玩家名
 * @param {string} content     消息正文
 * @param {string} fromId      MC 玩家 ID
 */
export function forwardToQQBridge(
  config: LLBotConfig,
  channelId: string,
  fromName: string,
  content: string,
  fromId: string
): void {
  if (!config.groupId || config.groupId === "0") {
    console.warn(`[DogeDB] QQ 群未配置 (qq_group_id),跳过 MC→QQ 转发 (channel=${channelId})`);
    return;
  }

  const text = `${config.prefix} ${fromName}: ${content}`;
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
          console.warn(
            `[DogeDB] LLBot send_group_msg → ${res.statusCode}: ${String(body).slice(0, 200)} (from=${fromId}, channel=${channelId})`
          );
        }
      });
    }
  );
  req.on("error", (err) => {
    console.warn(`[DogeDB] LLBot 不可达 (${config.host}:${config.port}): ${err.message}`);
  });
  req.write(payload);
  req.end();
}
