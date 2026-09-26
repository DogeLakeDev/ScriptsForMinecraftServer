---
"@sfmc-bds/qq-bridge": minor
"@sfmc-bds/sdk": patch
"@sfmc-bds/cli": patch
"@sfmc-bds/db-server": patch
"@sfmc-bds/bds-tools": patch
---

官方 QQ 机器人可选择 Webhook 接收事件；官方与 LLBot 配置改为分组对象。Webhook 模式自动跳过游戏机的桥进程，并安全同步共享配置到云端。群全量事件中的 `<@…>` 机器人提及也能正确触发指令面板命令。官方回复不再附带 LLBot 风格的编号和“发送：”列表。
