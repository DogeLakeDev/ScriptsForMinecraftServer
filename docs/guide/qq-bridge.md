# QQ 互通

依赖 [LLBot](https://www.llonebot.com/zh-CN/)（OneBot 11）。SFMC 只负责桥接，不内置 QQ 协议实现。

## 消息怎么走

```
QQ → MC:  LLBot ─WS:3002→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTP:3004→ LLBot
```

qq-bridge **只开 WS**；MC 往 QQ 发消息由 db-server 直连 LLBot，不走 3003。

## 配置 `configs/qq_config.json`

| 键 | 说明 |
|----|------|
| `qq_ws_port` | qq-bridge 监听，默认 3002 |
| `qq_group_id` | 主群号，`0` 表示不转发 |
| `llbot_enabled` | 是否由 sfmc 拉起 LLBot |
| `llbot_path` / `llbot_cwd` | LLBot 可执行文件路径 |
| `llbot_host` / `llbot_port` / `llbot_token` | db-server 发 MC→QQ 用 |
| `bridge_channel_id` | MC 侧桥接频道 id |
| `mctoqq_prefix` | MC 消息前缀，默认 `[MC]` |

## LLBot 侧

反向 WebSocket 指到：

```
ws://127.0.0.1:3002
```

## 启动

```bash
node sfmc/dist/main.js start db
node sfmc/dist/main.js start qq
# 或 start -all
```

## 防循环

- 跳过机器人自己发的消息（`sender.user_id === self_id`）
- 约 5 秒内相同 `message_id` 去重

排障见 [排障 → QQ](./troubleshooting.md#qq-桥)。
