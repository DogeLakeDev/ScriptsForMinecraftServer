# QQ 互通

支持两种后端（`qq_config.json` → `qq_backend`）：

|     |
| --- |

## 消息路径

### 官方 Bot（`qq_backend: "official"`）

```text
QQ → MC:  开放平台 Gateway ─WS→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTPS→ OpenAPI /v2/groups/{group_openid}/messages
```

- QQ→MC：**仅**转发群内 **@机器人** 的消息（`GROUP_AT_MESSAGE_CREATE`）
- MC→QQ：**主动推群**（需群主打开「允许机器人主动在群聊内发言」；官方有频控，约 20 条/分钟、1000 条/群/天）

### LLBot（`qq_backend: "llbot"`）

```text
QQ → MC:  LLBot ─WS:3002→ qq-bridge ─POST→ db-server
MC → QQ:  db-server ─HTTP:3004→ LLBot
```

## 配置

编辑 `configs/qq_config.json`（首次启动会生成默认值）：

| 键                                          | 说明                                            |
| ------------------------------------------- | ----------------------------------------------- |
| `qq_backend`                                | `official`                                      | `llbot`，默认 `official` |
| `qq_app_id` / `qq_app_secret`               | 官方 Bot 凭证（勿提交仓库）                     |
| `qq_sandbox`                                | 官方沙箱，默认 `false`                          |
| `qq_group_openid`                           | 官方群 openid（**不是**传统群号）               |
| `qq_group_panel_id`                         | 官方群指令面板 id（sync 后写回；可空）          |
| `qq_sync_menu_panel`                        | official 启动时同步 C2C 菜单/群面板，默认 `true` |
| `qq_ws_port`                                | llbot 后端：qq-bridge 监听，默认 3002           |
| `qq_group_id`                               | llbot 后端：主群号；`0` 表示不转发              |
| `llbot_enabled`                             | 是否由 sfmc 拉起 LLBot（仅 `qq_backend=llbot`） |
| `llbot_path` / `llbot_cwd`                  | LLBot 可执行文件/工作目录                       |
| `llbot_host` / `llbot_port` / `llbot_token` | **MC→QQ**（db-server→LLBot HTTP）；指令回复优先走 reverse-ws，不依赖 3004 |
| `bridge_channel_id`                         | MC 侧桥接频道 id                                |
| `mctoqq_prefix`                             | MC 消息前缀，默认 `[MC]`                        |
| `qq_admin_openids`                          | QQ 管理员 openid 列表（入服审批 / 踢人 / 改入服开关）；空则无法审批 |
| `qq_events`                                 | 事件推群开关对象（见下节）；默认全开、窗口 60s   |

### 如何拿到 `qq_group_openid`

1. 配好 AppID/Secret，把机器人拉进群，订阅群 @ 事件
2. 启动 `qq` 服务，在群里 @ 机器人发一条消息
3. 若尚未配置 openid，qq-bridge 日志会打印收到的 `group_openid`
4. 抄进 `qq_group_openid` 后**重启 db-server**（出站）与 qq-bridge（入站过滤）

## 官方侧 checklist

1. 管理端订阅 `GROUP_AT_MESSAGE_CREATE`
2. 机器人已入群
3. 群主打开「允许机器人主动在群聊内发言」
4. 沙箱测试：管理端配沙箱群，且 `qq_sandbox: true`
5. 若启用 IP 白名单，加入服务器公网 IP（仅正式环境）

## LLBot 侧

`qq_backend: "llbot"` 时，设置反向 WebSocket：

```text
ws://127.0.0.1:3002
```

指令回复经该连接发 `send_group_msg`，**不要求**开启 LLBot 正向 HTTP（3004）。  
MC→QQ（游戏聊天转发）仍由 db-server 调 HTTP `llbot_host:llbot_port`；若也要互通，需在 LLBot 打开 HTTP API，或后续再加 WS 代理。

从旧版升级：请显式设置 `"qq_backend": "llbot"`，否则默认走官方后端。

## QQ 侧指令（不依赖游戏）

qq-bridge 在转发到 MC **之前**拦截指令；同一套命令表，两端呈现不同：

| 触发 | 行为 |
| --- | --- |
| `菜单` / `help` / `/help` | 指令列表；official 为 Markdown + 按钮，llbot 为编号菜单 |
| `ping` / `/ping` | 连通探测 |
| `whoami` / `我的绑定` | QQ id；若已绑定则显示 MC 名 |
| `status` / `状态` | 服务器摘要：在线、世界、主机运行时长、BDS/db 时长、内存/CPU（`GET /api/sfmc/status`） |
| `online` / `在线` | 在线名单（截断） |
| `绑定` / `bind` | 申请绑定码（需游戏模块 `qq-link`） |
| `解绑` / `unbind` | 解除绑定 |
| `申请入服` / `join` | 申请加入 BDS 白名单（需管理员审批 + 模块生效） |
| `待审` / `pending` | 待审列表（管理员） |
| `通过` / `拒绝` | llbot 编号审批；official 优先用回调按钮 |
| `踢人` / `kick` | 排队踢出**游戏内**在线玩家（非 QQ 群踢） |
| `群信息` / `group` | 拉取群 OpenAPI `info` + `bot_state`（仅 official） |
| `配置` / `config` | 管理员入服开关面板：official 互动按钮切换；llbot 编号；群管开关只读 |

- **official**：群内 **@机器人** 后发上述文本；可点菜单按钮。启动时可将命令同步到 [自定义菜单 / 指令面板](https://bot.q.qq.com/wiki/develop/api-v2/server-inter/menu-panel/)（`sync-menu` 控制台命令可重推）。单聊 `C2C_MESSAGE_CREATE` 同样走指令路由。订阅交互 intent 后可点审批回调按钮（`INTERACTION_CREATE`）。
- **llbot**：群内发同样触发词；菜单后 **60 秒内**回复数字 `1`/`2`…；**无**官方原生面板 / INTERACTION；审批用「通过/拒绝 \<id\>」。
- 非指令消息仍走原有 QQ→MC 转发（需 `bridge_channel_id`）。
- `status`：世界日与难度分行；official 额外附带 QQ 群摘要（见下节白名单）。

## QQ↔MC 绑定

平台 API（db-server，loopback）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/sfmc/qq/bind/request` | QQ 侧申请短码 |
| `POST` | `/api/sfmc/qq/bind/confirm` | 游戏侧确认 |
| `POST` | `/api/sfmc/qq/bind/unbind` | 解绑 |
| `GET` | `/api/sfmc/qq/bind/me` | 查询 |

## 入服审批与双管理侧

| 侧 | 能力 | 落点 |
| --- | --- | --- |
| **QQ** | 申请/审批/待审、群 info/bot_state、通知 | qq-bridge + OpenAPI；状态在 db-server |
| **BDS** | `allowList.add`、`kickPlayer` | 仅游戏模块 `qq-link` 调用 `@minecraft/server-admin` |

平台**不**直接改 BDS `allowlist.json`。闭环：

1. QQ「申请入服 \<玩家名\>」→ `sfmc_qq_join_requests` = `pending`
2. 管理员通过（official 回调按钮 / llbot 编号）→ `approved`
3. 模块轮询 `GET /api/sfmc/qq/join/apply-queue` → `dedicatedServer.allowList.add` → `POST .../applied`
4. QQ「踢人」→ `sfmc_qq_admin_actions` → 模块 `kickPlayer`（玩家须在线）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/sfmc/qq/join/request` | 申请 |
| `POST` | `/api/sfmc/qq/join/decide` | 通过/拒绝（校验 `qq_admin_openids`） |
| `GET` | `/api/sfmc/qq/join/pending` | 待审 |
| `GET` | `/api/sfmc/qq/join/apply-queue` | SAPI 拉已批准未生效 |
| `POST` | `/api/sfmc/qq/join/applied` | SAPI 回写 |
| `POST` | `/api/sfmc/qq/admin/kick` | 踢人入队 |
| `GET` | `/api/sfmc/qq/admin/action-queue` | 动作队列 |
| `POST` | `/api/sfmc/qq/admin/action-done` | 动作回写 |

**注意**：BDS 未运行时审批可积压；起来后模块自动 `applied`。杀 BDS 不影响「群信息」只读（纯 OpenAPI）。

### 入服开关（模块配置 `configs/qq_link.json`）

属 **qq-link 插件**，不是 SDK / `qq_config`。缺省文件会在首次读写时生成：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `allowlist_enabled` | `true` | 入服白名单总开关；关则不可新申请，也不下发 apply-queue |
| `require_approval` | `true` | 是否需管理员审批；关则申请直接 `approved` |
| `treat_group_admins_as_admins` | `false` | 是否将 QQ 群主/群管视作 SFMC 管理员；**仅改本文件**，群聊/API 只读 |

机器人（`qq_admin_openids`，或开启上一项后的群主/群管）：

- `配置` — 打开面板（含群管开关只读状态；official 点按钮切换，llbot 回数字）
- 亦可文本：`配置 白名单 开|关` / `配置 审批 开|关`

平台 API：`GET/POST /api/sfmc/qq/join/settings`（POST 校验管理员；`treat_group_admins_as_admins` 不可经 POST 改写）。

### 群 OpenAPI 白名单（错误码 11253）

`GET /v2/groups/{group_openid}/info` 与 `bot_state` 可能需在 [QQ 开放平台](https://q.qq.com/) 申请接口白名单。未开通时 `status` / `群信息` 会提示「群信息接口未开通白名单」，不影响互通与审批流。

游戏侧由同一模块 **`qq-link`**（`@sfmc-bds/module-qq-link`）实现：`!bind` + allowList 生效 + kick + 上下线/死亡上报。

安装示例：`sfmc mod install qq-link --from dir:<作者仓> --link`，再 `behavior-pack build/deploy` 并重启 BDS。

只读运维：`GET /api/sfmc/status`（公开）供 `status` / `online` 使用。响应含 `host`（主机运行时长/内存/CPU）与 `processes.bds` / `processes.db`（进程运行时长；BDS 来自 `.sfmc/bds.pid` 或 `bedrock_server` 探活）。

## 事件推送（节流）

上下线 / 死亡 / BDS 启停推到 QQ 群，**不依赖** `bridge_channel_id`（与游戏聊天互通无关）。

| 事件 | 来源 | 推送时机 |
| --- | --- | --- |
| 上线 / 下线 / 死亡 | 游戏模块 `qq-link`（`playerSpawn` initial / `playerLeave` / `entityDie`） | 约 `window_sec`（默认 60s）聚合成一条 |
| BDS 意外退出 | `bds-manager`（非手动 stop） | **立即** |
| BDS 启动成功 | `bds-manager` spawn 成功 | **立即** |

出站仍走 db-server → official OpenAPI / LLBot HTTP（与 MC→QQ 相同；llbot 需 3004）。官方主动推群受频控（约 20 条/分钟、1000 条/群/天），故游戏事件必须聚合。

配置（`qq_config.json` → `qq_events`，改后重启 db-server）：

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

`enabled: false` 关闭全部。平台 API：`POST /api/sfmc/qq/events`（loopback；单条或 `{ "events": [...] }`，≤100）。

示例聚合文案：

```text
[MC事件]
上线：Steve、Alex
下线：Bob
死亡：Steve（坠落）
```

立即条：`[MC事件] BDS 意外退出 (code=1)` / `[MC事件] BDS 已启动 (pid=…)`。手动 `stop` 不报 crash；崩溃自动重启会先 crash 再 start。

**不做**：成就推送、每条死亡即时推、聊天镜像进事件通道。

## 启动

```bash
sfmc> start db
sfmc> start qq
# 或
sfmc> start -all
```

建议顺序：先 db，再 qq（llbot 后端且启用时才会拉起 llbot），最后 bds。见 [服务管理](./services.md)。

## 防循环

- 跳过机器人自己发的消息
- 约 5 秒内相同消息 id 去重

排障见 [排障](./troubleshooting.md)。
