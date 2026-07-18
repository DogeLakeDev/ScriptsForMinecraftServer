#!/usr/bin/env node
/**
 * index.ts — QQ ↔ MC 桥接进程入口
 *
 * 端口: 3002 (默认) — WebSocket (LLBot reverse-ws)
 *
 * 数据流:
 *   QQ → MC:  LLBot ──WS:3002──→ qq-bridge ──POST──→ db-server:3001/api/sfmc/messages
 *   MC → QQ:  SAPI ──POST──→ db-server:3001 ──(内部)──→ LLBot:3004/send_group_msg
 *
 * 注意: 本进程只做 WS 入口,不再起 HTTP server。MC→QQ 由 db-server 直连 LLBot
 *       (见 db-server/src/domain/bridge.ts:forwardToQQBridge)
 *
 * 循环防护:
 *   1. 跳过 sender.user_id === botSelfId 的回声
 *      (botSelfId 通过 LLBot 的 lifecycle 元事件捕获)
 *   2. 5 秒内同 message_id 短期去重 (防 race)
 */

import { loadInitialConfig } from "./config.js";
import { OneBotDispatcher } from "./onebot.js";
import { startWsServer } from "./ws-server.js";
import { startConsole } from "./console.js";
import { logger } from "./logger.js";
import type { QQBridgeConfig } from "./types.js";

async function main(): Promise<void> {
  const cfg: QQBridgeConfig = loadInitialConfig();

  if (!cfg.qq_enabled) {
    logger.info("已禁用 (qq_enabled = false)");
    process.exit(0);
  }

  // 让控制台 status 命令读到 bot 当前的 self_id
  const botSelfIdRef: { value: string | null } = { value: null };

  const dispatcher = new OneBotDispatcher({
    qqGroupId: cfg.qq_group_id,
    db: {
      host: cfg.db_host,
      port: cfg.db_port,
      channelId: cfg.bridge_channel_id,
    },
  });

  // botSelfId 通过 dispatcher 内部维护; 控制台读 self_id 时取最新值
  Object.defineProperty(botSelfIdRef, "value", {
    get: () => dispatcher.selfId,
  });

  await startWsServer({ port: cfg.qq_ws_port, dispatcher });

  logger.info(
    `等待 LLBot 连接 (主群: ${cfg.qq_group_id || "未配置"}, channel: ${cfg.bridge_channel_id || "未配置"}, db: ${cfg.db_host}:${cfg.db_port})`
  );

  startConsole({
    config: cfg,
    initialEnabled: cfg.qq_enabled,
    wsPort: cfg.qq_ws_port,
    botSelfIdRef,
  });

  logger.info("启动完成");
}

main().catch((e) => {
  logger.error(`未捕获异常: ${(e as Error).message}`);
  process.exit(1);
});
