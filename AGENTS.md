# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

Four components in one repo:

| Path | What | Runtime |
|------|------|---------|
| `scriptsforminecraftserver/` | Minecraft Bedrock behavior pack (SAPI scripts) | Minecraft Bedrock (Script API) |
| `db-server/` | SQLite HTTP REST backend | Node.js |
| `qq-bridge/` | QQ bridge (LLBot OneBot 11) independent process | Node.js |
| `BDSTools/` | BDS auto updater + tools | Node.js |
| `panel/` | TUI management panel | Node.js (Ink, semi-deprecated) |
| `rust-panel/` | TUI management panel (rewrite) | Rust + Ratatui |

## Plugin entry & init order

`scripts/main.ts` → `scripts/entry.ts` (`AddOnInit.init()`)

Init phases in `entry.ts`:
1. `system.beforeEvents.startup` — register permissions & commands
2. `world.afterEvents.worldLoad` — init modules (AFK, Coop, Chat, Clean, TPS, OnlineTime, CreativeArea, SurvivalArea, InventorySwitcher, LandSystem, ActivityLog, Money, ScoreboardSync, WorldData, HoloEntity)
3. `world.afterEvents.playerSpawn` (initialSpawn) — Peace, Fly, AFK reset
4. `world.afterEvents.playerSpawn` — SpawnProtect
5. `world.beforeEvents.chatSend` — intercept `!` / `！` commands

## Build & deploy

Run everything from `scriptsforminecraftserver/`:

```powershell
npm install        # install dependencies
npm run build      # tsc + esbuild bundle → dist/scripts/main.js
npm run local-deploy  # build + copy to Minecraft dev folder
npm run local-deploy -- --watch  # watch mode
npm run lint       # ESLint (minecraft-linting/avoid-unnecessary-command)
```

`.env` controls deploy target:
- `PROJECT_NAME="ScriptsForMinecraftServer"`
- `MINECRAFT_PRODUCT="Custom"`
- `CUSTOM_DEPLOYMENT_PATH="D:\Minecraft\BEServer\worlds\sptest2(ed)"`

Manual copy script at `copy.bat` (uses a different hardcoded path).

To deploy to production: `just-scripts package` (copies dev→prod, deletes dev copy).

db-server: `cd db-server && node index.js` (default port 3001, override via `DB_PORT`).

## Dependency quirks

- `@minecraft/server` uses `2.10.0-beta.1.26.40-preview.29` — beta SAPI version
- `@minecraft/server-net` needed for HTTP calls to db-server
- `better-sqlite3` in db-server requires native build toolchain
- No test framework in either component

## Key module locations (updated from README tree)

| Module | Actual path |
|--------|-------------|
| Scoreboard sync | `data/Scoreboards.ts` (not `backup/ScoreboardSync.ts`) |
| Activity log | `data/ActivityLog.ts` |
| World data sync | `data/World.ts` |
| Holographic display | `holo/HoloEntity.ts` + `holo/HoloGUI.ts` |
| API wrappers | `api/ActivityLogsApi.ts`, `ChatApi.ts`, `HoloprintApi.ts`, `KVApi.ts`, `PlayersDataApi.ts`, `ScoreboardsSyncApi.ts`, `WorldDataApi.ts` |

## Code conventions

- **Message display**: Use `Msg.info/success/error/warning/tips()` from `libs/Tools.ts` (adds `§f[*]`/`§a[√]`/`§c[x]`/`§e[!]`/`§7[!]` prefix). **Never use `player.sendMessage()` directly for system notifications** — always use Msg methods. They handle: sound effects, system channel forwarding via `_systemMsgHandler`, and consistent formatting.
- **Form body**: Use `ListFormInfo(string[])` from `gui/` — first line gets `[*]` prefix, indented lines are plain
- **Buttons**: No formatting codes except `§l返回` for back buttons
- **Form titles**: No formatting codes
- **Money**: Scoreboard-based, unit from `Money.UNIT` (`节操`)
- **Commands**: `!<command>` syntax intercepted in `beforeEvents.chatSend`
- **Permissions**: `Permission.register(name, level)` in startup, levels: Any=0, Member=1, OP=2, Admin=3
- **Storage**: `world.setDynamicProperty` for shop, coop, land, invswitcher (being deprecated to db-server SQLite)
- **db-server HTTP**: Via `HttpDB` class in `libs/HttpDB.ts`, targets `Config.dbHost:Config.dbPort`

## QQ Bridge (LLBot / OneBot 11) — 独立进程

File: `qq-bridge/index.js`

独立的 Node.js 进程，不依赖 db-server。通过 WebSocket 接收 LLBot 推送，通过 HTTP 与 db-server 通信。

### 端口

| 端口 | 用途 | 协议 |
|------|------|------|
| 3002 | LLBot WebSocket 接入 | WebSocket (reverse) |
| 3003 | HTTP API（db-server 调用 /forward，外部工具调用 /send） | HTTP |

### 消息流

```
QQ → MC:
  LLBot ──WS:3002──→ qq-bridge
                      └─ POST → db-server:3001/api/sfmc/messages

MC → QQ:
  db-server POST /api/sfmc/messages
    └─ POST → qq-bridge:3003/forward → LLBot HTTP
```

### 配置

`configs/qq_config.json` 统一管理：

```json
{
  "qq_enabled": true,
  "qq_group_id": 688524595,
  "bridge_channel_id": "CH_9g2n3erc",
  "qq_ws_port": 3002,
  "qq_bridge_port": 3003,
  "llbot_http": "http://127.0.0.1:6322",
  "mctoqq_prefix": "[OW]",
  "db_host": "127.0.0.1",
  "db_port": 3001
}
```

### 启动顺序

```
1. db-server    (node db-server/index.js)
2. qq-bridge    (node qq-bridge/index.js)
3. BDS          (自动或手动启动)
```

### API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/forward` | POST | db-server 转发 MC 消息到 QQ（含循环保护） |
| `/send` | POST | 外部工具直接发送群消息（`{text}` 或 `{segments}`） |
| `/health` | GET | 健康检查 |

## BDSTools — BDS 更新器

`BDSTools/check-update.js` — 自动检查 BDS 官网更新，下载、备份、更新、重启。

### 配置

`configs/bds_updater.json`：

```json
{
  "bds_path": "D:\\Minecraft\\BEServer",
  "channel": "release",
  "backup_dir": "D:\\Minecraft\\BEServer_backups",
  "auto_restart": true,
  "preserve": [
    "server.properties", "whitelist.json", "permissions.json",
    "allowlist.json", "worlds",
    "config\\\\68d6d7eb-a68e-40f6-b57d-7f0d200a35cf"
  ],
  "qq_notify": true
}
```

### 用法

```bash
node BDSTools/check-update.js                    # 默认 release
node BDSTools/check-update.js --channel=preview   # 预览版
node BDSTools/check-update.js --check-only        # 仅检查
node BDSTools/check-update.js --force             # 强制重装
```

### 流程

1. 版本比对（当前 vs 官方最新）
2. [QQ] 更新预告 + 更新日志（含图片）
3. 备份 preserve 文件 + worlds/
4. [QQ] 备份成功通知
5. taskkill BDS
6. 下载 + 解压覆盖
7. 恢复配置/worlds
8. 启动 BDS
9. [QQ] 完成/失败通知

## Prettier
trailingComma es5, tabWidth 2, semicolons, double quotes, bracketSpacing, arrowParens always, printWidth 120, endOfLine auto.

## Docs&Links
- https://sapi.dogelake.cn/index.html
- https://zh.minecraft.wiki/
- https://mcbeui.pages.dev/
- https://wiki.bedrock.dev/
- https://learn.microsoft.com/zh-cn/minecraft/creator/
- https://holoprint-mc.github.io/

## rust-panel — Rust+Ratatui 管理面板 (WIP)

`rust-panel/` — 正在用 Rust+Ratatui 重写面板。服务管理、性能监控、日志浏览。

### 构建

```powershell
cd rust-panel
.\build.ps1          # build with MSVC onecore CRT workaround
```

`build.ps1` 设置 `LIB` 环境变量（VS onecore CRT lib 路径）后调用 `cargo build`。直接 `cargo build` 会报 `LNK1104: msvcrt.lib`。

### Toolchain

- Rust `stable-x86_64-pc-windows-msvc` (default)
- VS 2025 Community `18\VC\Tools\MSVC\14.51.36231` (only onecore CRT available)
- 需要 `LIB` 指向 `lib\onecore\x64`

### 标签页

| Tab | 功能 |
|-----|------|
| 总览 | 日志列表 + 命令输入 (占位) |
| 监控 | CPU/内存/进程信息 (sysinfo) |
| 服务 | 管理 BDS/DB/QQ/LLBot 启动停止重启 |

### 快捷键

| 按键 | 功能 |
|------|------|
| `Tab` | 切换标签页 |
| `q` | 退出 |
| `↑↓` | 选择服务 |
| `s` | 启动选中服务 |
| `x` | 停止选中服务 |
| `r` | 重启选中服务 |

### 依赖

ratatui, crossterm, ureq (native-tls), serde, sysinfo, anyhow.

## Panel — TUI 管理面板 (旧的 JS 版)

`panel/index.js` — 旧版 Ink 面板，已半废弃，功能将被 rust-panel 替代。
