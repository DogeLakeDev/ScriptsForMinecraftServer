# QQ bridge

Requires [LLBot](https://www.llonebot.com/zh-CN/) (OneBot 11). SFMC bridges messages only; it does not implement QQ protocol itself.

## Message path

```text
QQ → MC:  LLBot ─WS:3002→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTP:3004→ LLBot
```

## Configuration

Edit `configs/qq_config.json` (defaults are created on first start):

| Key | Description |
| ------------------------------------------- | ------------------------- |
| `qq_ws_port` | qq-bridge listen port; default 3002 |
| `qq_group_id` | Primary group id; `0` disables forwarding |
| `llbot_enabled` | Whether sfmc starts LLBot |
| `llbot_path` / `llbot_cwd` | LLBot executable / working directory |
| `llbot_host` / `llbot_port` / `llbot_token` | db-server MC→QQ HTTP client |
| `bridge_channel_id` | In-game bridge channel id |
| `mctoqq_prefix` | MC message prefix; default `[MC]` |

## LLBot setup

Configure reverse WebSocket:

```text
ws://127.0.0.1:3002
```

## Start

```bash
sfmc> start db
sfmc> start qq
# or
sfmc> start -all
```

Recommended order: db, then qq (and llbot), then bds. See [Service management](./services.md).

## Loop prevention

- Drop messages from the bot itself (`sender.user_id === self_id`)
- Dedupe identical `message_id` within ~5 seconds

Troubleshooting: [Troubleshooting](./troubleshooting.md).
