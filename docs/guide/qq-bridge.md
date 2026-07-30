# QQ 互通

依赖 [LLBot](https://www.llonebot.com/zh-CN/)（OneBot 11）。SFMC 只做桥接，不内置 QQ 协议。

## 消息路径

```text
QQ → MC:  LLBot ─WS:3002→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTP:3004→ LLBot
```

## 配置

编辑 `configs/qq_config.json`（首次启动会生成默认值）：

| 键                                          | 说明                      |
| ------------------------------------------- | ------------------------- |
| `qq_ws_port`                                | qq-bridge 监听，默认 3002 |
| `qq_group_id`                               | 主群号；`0` 表示不转发    |
| `llbot_enabled`                             | 是否由 sfmc 拉起 LLBot    |
| `llbot_path` / `llbot_cwd`                  | LLBot 可执行文件/工作目录 |
| `llbot_host` / `llbot_port` / `llbot_token` | db-server 发 MC→QQ 用     |
| `bridge_channel_id`                         | MC 侧桥接频道 id          |
| `mctoqq_prefix`                             | MC 消息前缀，默认 `[MC]`  |

## LLBot 侧

设置反向 WebSocket ：

```text
ws://127.0.0.1:3002
```

## 启动

```bash
sfmc> start db
sfmc> start qq
# 或
sfmc> start -all
```

建议顺序：先 db，再 qq（及 llbot），最后 bds。见 [服务管理](./services.md)。

## 防循环

- 跳过机器人自己发的消息（`sender.user_id === self_id`）
- 约 5 秒内相同 `message_id` 去重

排障见 [排障](./troubleshooting.md)。
