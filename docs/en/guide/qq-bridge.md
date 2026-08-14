# QQ bridge

Two backends (`qq_config.json` → `qq_backend`):

| Backend | Notes |
| --- | --- |
| `official` (default) | [QQ Open Platform](https://q.qq.com/) official bot (Access Token + Gateway) |
| `llbot` | [LLBot](https://www.llonebot.com/zh-CN/) (OneBot 11) |

SFMC only bridges messages; the MC envelope remains `/api/sfmc/messages`.

## Message path

### Official (`qq_backend: "official"`)

```text
QQ → MC:  Official Gateway ─WS→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTPS→ OpenAPI /v2/groups/{group_openid}/messages
```

- QQ→MC: only **@bot** group messages (`GROUP_AT_MESSAGE_CREATE`)
- MC→QQ: **active** group push (group owner must allow the bot to speak proactively; rate limits apply)

### LLBot (`qq_backend: "llbot"`)

```text
QQ → MC:  LLBot ─WS:3002→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTP:3004→ LLBot
```

## Configuration

Edit `configs/qq_config.json` (defaults are created on first start):

| Key | Description |
| --- | --- |
| `qq_backend` | `official` \| `llbot`; default `official` |
| `qq_app_id` / `qq_app_secret` | Official bot credentials (do not commit secrets) |
| `qq_sandbox` | Official sandbox; default `false` |
| `qq_group_openid` | Official group openid (not the numeric group id) |
| `qq_group_panel_id` | Official group command-panel id (written back after sync) |
| `qq_sync_menu_panel` | Sync C2C menu + group panel on official startup; default `true` |
| `qq_ws_port` | llbot: qq-bridge listen port; default 3002 |
| `qq_group_id` | llbot: primary group id; `0` disables |
| `llbot_enabled` | Whether sfmc starts LLBot (only when `qq_backend=llbot`) |
| `llbot_path` / `llbot_cwd` | LLBot executable / working directory |
| `llbot_host` / `llbot_port` / `llbot_token` | db-server MC→QQ (llbot) |
| `bridge_channel_id` | In-game bridge channel id |
| `mctoqq_prefix` | MC message prefix; default `[MC]` |
| `qq_admin_openids` | QQ admin openids (join approval / kick / join settings); empty = cannot approve |
| `qq_events` | Event-to-group switches (see below); default all on, 60s window |

### Obtaining `qq_group_openid`

1. Configure AppID/Secret, add the bot to the group, subscribe to group @ events
2. Start the `qq` service and @ the bot in the group
3. If openid is unset, qq-bridge logs the received `group_openid`
4. Copy it into `qq_group_openid`, then restart db-server and qq-bridge

## Official checklist

1. Subscribe to `GROUP_AT_MESSAGE_CREATE` in the console
2. Bot is in the target group
3. Group owner enables proactive bot messages
4. Sandbox: configure a sandbox group and set `qq_sandbox: true`
5. If IP allowlist is on, add the server public IP (production only)

## LLBot setup

When `qq_backend: "llbot"`, configure reverse WebSocket:

```text
ws://127.0.0.1:3002
```

Upgrading from older installs: set `"qq_backend": "llbot"` explicitly; otherwise the default is official.

## QQ-side commands (no MC required)

qq-bridge intercepts commands **before** forwarding to MC. Same command registry; presentation differs by backend:

| Trigger | Behavior |
| --- | --- |
| `菜单` / `help` / `/help` | Common commands; official Markdown + keyboard, llbot numbered menu |
| `ping` / `/ping` | Liveness probe |
| `whoami` / `我的绑定` | QQ id; shows MC name if bound |
| `status` / `状态` | Server summary: online, world, host uptime, BDS/db uptime, memory/CPU (`GET /api/sfmc/status`) |
| `online` / `在线` | Online roster (truncated) |
| `绑定` / `bind` | Request bind code (needs game module `qq-link`) |
| `解绑` / `unbind` | Unbind |
| `申请入服` / `join` | Request BDS allowlist entry (admin approve + module apply) |
| `频道` / `channel` | Read-only: whether `bridge_channel_id` is set (in-game chat bridge) |
| `管理` / `admin` | **Admin submenu** (admins only): group info / config / pending / approve / reject / kick |

Admin commands are hidden from the main menu and official C2C quick menu; triggers like `踢人` / `待审` still work when typed directly.

- **official**: @bot then send the trigger; optional sync to [custom menu / command panel](https://bot.q.qq.com/wiki/develop/api-v2/server-inter/menu-panel/) (`sync-menu` console command). C2C messages also hit the command router. With interaction intent, approval uses callback buttons (`INTERACTION_CREATE`).
- **llbot**: same triggers; numbered replies within **60s**; **no** native panel / INTERACTION — use `通过/拒绝 <id>`.
- Non-command messages still use the QQ→MC forward path (needs `bridge_channel_id`).
- `status`: world day and difficulty on separate lines; official adds a QQ group summary when APIs allow.

## In-game chat bridge (`bridge_channel_id`)

Set `bridge_channel_id` in `configs/qq_config.json` (any stable id, e.g. `main`), then **restart** db-server, qq-bridge, and BDS (`qq-link` reads it at boot).

| Direction | Behavior |
| --- | --- |
| QQ → game | Official: only **@bot** non-command messages are stored; `qq-link` polls and broadcasts `[QQ] name: text` |
| Game → QQ | Normal chat (not `!` commands / not bind-code wait) → `POST /api/sfmc/messages`; db-server forwards to the group **only if** `channelId === bridge_channel_id` (prefix default `[MC]`) |

If unset: QQ→MC is skipped with a warning; game chat is not forwarded; event push is unchanged. LLBot outbound chat still needs HTTP (default 3004).

Check: configure + restart → `@bot hello` appears in game → game chat appears in QQ → `频道` / `channel` shows whether set.

## QQ↔MC binding

Platform APIs on db-server (loopback): `POST /api/sfmc/qq/bind/{request,confirm,unbind}` and `GET /api/sfmc/qq/bind/me`.

## Join approval & dual admin sides

| Side | Capability | Where |
| --- | --- | --- |
| **QQ** | Request/approve/pending, group info/bot_state, notify | qq-bridge + OpenAPI; state in db-server |
| **BDS** | `allowList.add`, `kickPlayer` | Only game module `qq-link` via `@minecraft/server-admin` |

The platform never writes BDS `allowlist.json` directly. Flow: QQ request → DB `pending` → admin approve → `approved` → module polls `apply-queue` → `allowList.add` → `applied`. Kick uses `admin/action-queue` → `kickPlayer` (player must be online).

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/sfmc/qq/join/request` | Apply |
| `POST` | `/api/sfmc/qq/join/decide` | Approve/reject (`qq_admin_openids`) |
| `GET` | `/api/sfmc/qq/join/pending` | Pending |
| `GET` | `/api/sfmc/qq/join/apply-queue` | SAPI pulls approved-not-applied |
| `POST` | `/api/sfmc/qq/join/applied` | SAPI ack |
| `POST` | `/api/sfmc/qq/admin/kick` | Enqueue kick |
| `GET` | `/api/sfmc/qq/admin/action-queue` | Action queue |
| `POST` | `/api/sfmc/qq/admin/action-done` | Action ack |

If BDS is down, approvals can queue and apply after restart. Stopping BDS does not block read-only `群信息` (OpenAPI only).

### Join switches (module config `configs/qq_link.json`)

Owned by the **qq-link plugin**, not the SDK / `qq_config`. Defaults are created on first read/write:

| Key | Default | Meaning |
| --- | --- | --- |
| `allowlist_enabled` | `true` | Master switch; off = no new requests and empty apply-queue |
| `require_approval` | `true` | Off = auto-`approved` into the apply queue |
| `treat_group_admins_as_admins` | `false` | Treat QQ group owner/admins as SFMC admins; **file-only write**, readable via bot/API |

Bot (`qq_admin_openids`, or group admins when the flag above is on): `配置` opens a button panel (official INTERACTION / llbot numbers); text `配置 白名单|审批 开|关` still works. API: `GET/POST /api/sfmc/qq/join/settings` (POST cannot change `treat_group_admins_as_admins`).

### Group OpenAPI allowlist (error **11253**)

`GET /v2/groups/{group_openid}/info` and `bot_state` may require a platform allowlist. When blocked, `status` / `群信息` show a clear tip; chat bridge and join flow still work.

Game side is the same module **`qq-link`** (`@sfmc-bds/module-qq-link`): `!bind` + allowList apply + kick + join/leave/death reporting + chat-bridge poll. Install with `sfmc mod install qq-link --from dir:<repo> --link`, then behavior-pack build/deploy and restart BDS.

Read-only ops: public `GET /api/sfmc/status` backs `status` / `online`. Payload includes `host` (uptime/memory/CPU) and `processes.bds` / `processes.db` (process uptime; BDS from `.sfmc/bds.pid` or `bedrock_server` probe).

## Event push (throttled)

Join / leave / death / BDS lifecycle posts to the QQ group and does **not** require `bridge_channel_id` (separate from chat bridging).

| Event | Source | When |
| --- | --- | --- |
| Join / leave / death | Game module `qq-link` | Aggregated about every `window_sec` (default 60s) |
| BDS unexpected exit | `bds-manager` (not manual stop) | Immediate |
| BDS start success | `bds-manager` after spawn | Immediate |

Outbound still goes db-server → official OpenAPI / LLBot HTTP (same as MC→QQ; llbot needs port 3004). Official proactive group messages are rate-limited, so game events must be batched.

Config (`qq_config.json` → `qq_events`; restart db-server after edits):

```json
"qq_events": {
  "enabled": true,
  "window_sec": 60,
  "join": true,
  "leave": true,
  "death": true,
  "crash": true,
  "start": true
}
```

`enabled: false` disables all. API: `POST /api/sfmc/qq/events` (loopback; one object or `{ "events": [...] }`, max 100).

Manual `stop` does not emit crash; crash auto-restart emits crash then start. Not in scope: achievements, per-death instant push, chat mirroring via this path.

## Start

```bash
sfmc> start db
sfmc> start qq
# or
sfmc> start -all
```

Recommended order: db, then qq (llbot is started only for the llbot backend when enabled), then bds. See [Service management](./services.md).

## Loop prevention

- Drop messages from the bot itself
- Dedupe identical message ids within ~5 seconds

Troubleshooting: [Troubleshooting](./troubleshooting.md).

