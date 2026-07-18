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
export {};
//# sourceMappingURL=index.d.ts.map