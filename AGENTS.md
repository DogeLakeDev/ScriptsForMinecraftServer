# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

Five components in one repo:

| Path | What | Runtime |
|------|------|---------|
| `scriptsforminecraftserver/` | Minecraft Bedrock behavior pack (SAPI scripts) | Minecraft Bedrock (Script API) |
| `db-server/` | SQLite HTTP REST backend | Node.js |
| `qq-bridge/` | QQ bridge (LLBot OneBot 11) independent process | Node.js |
| `BDSTools/` | BDS auto updater + tools | Node.js |
| `panel/` | TUI management panel | Node.js (Ink) |


## Plugin entry & init order

`scripts/main.ts` → `scripts/entry.ts` (`AddOnInit.init()`)

Init phases in `entry.ts`:
1. `system.beforeEvents.startup` — `await ConfigManager.init()` → register permissions & commands via `ModuleRegistry`
2. `world.afterEvents.worldLoad` — `ModuleRegistry.bootAfterWorldLoad()` + `MonitorReporter` + `syncWorldData()`
3. `world.afterEvents.playerSpawn` (initialSpawn) — Peace, Fly, AFK reset
4. `world.afterEvents.playerSpawn` — SpawnProtect
5. `world.beforeEvents.chatSend` — intercept `!` / `！` commands

## Module system

The project uses a single source of truth for module metadata: `modules/catalog.json` (catalog) + `modules/module-lock.json` (install state). `configs/modules.json` is kept only as a legacy import seed.

- `tools/check-catalog.js` runs at build time, validates unique IDs, dependency closure, and entry-path existence.
- `tools/install-module.js install|uninstall <id>` updates logical install state in `module-lock.json`.
- `tools/lock.js rebuild|drift` rebuilds `modules/lock.json` file fingerprint snapshots.
- `tools/smoke-modules.js` runs regression against a live `db-server`.

Runtime wiring goes through `scripts/libs/ModuleRegistry.ts`. To add a module:

1. Add an entry to `modules/catalog.json` (id, configKey, type, requires, entry).
2. In `scripts/entry.ts`, call `ModuleRegistry.register({ id, afterWorldLoad, lifecycle: { registerPermissions, registerCommands, registerEvents, init, cleanup } })`.
3. Build with `npm run build` (runs `check-catalog` first).
4. Restart BDS or Panel to take effect.

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

## Panel — TUI 管理面板

`panel/index.js` 入口：
- 默认 TUI 模式（要求 stdin/stdout TTY）
- `--cli`：只打印状态后退出（管道友好）
- `--no-tui`：启动服务后保持进程存活
- `--setup` / `--reset`：强制重开初始化向导
- `--help`：打印帮助

启动顺序（`panel/index.js`）：
1. 启动 db-server + qq-bridge 子进程（通过 SFMC_ROOT 环境变量隔离工作根）
2. 等待 `/api/health` 200
3. 调 `/api/sfmc/setup/state` 检测 `_initialized`
4. 若未初始化，进入主 TUI 第一屏渲染 `SetupWizard`（5 步表单）
5. 用户提交后写入 `panel-state.json` + `configs/*.json` + `modules/module-lock.json`
6. 进入主 TUI（模块管理 / 服务控制 / 数据查看）

主 App 状态机（`panel/app.js`）：
- `view`：`'dashboard' | 'monitor' | 'modules' | 'chat' | 'data' | 'svc' | 'cfg_list' | 'cfg_edit' | 'setup'`
- `activeTab`：当前 Tab
- `setupRequired`：从 `/api/sfmc/setup/state` 周期拉取（5s），true 时强制 `view='setup'`

### Setup Wizard

文件：`panel/setup/wizard.js`（注意：不是 `.jsx`，Node 23+ 不支持 `.jsx` 直接 import）。
- `panel/setup/state.js`：读写 `panel-state.json`
- `panel/setup/orchestrator.js`：封装 `detect / runChecks / submit / reset / importState`
- `panel/setup/service-install.js`：路径依赖检测

## 常见坑

1. **`wizard.jsx` 不能直接被 Node import** → 已统一用 `.js` 后缀 + `React.createElement`。
2. **`mount().then(process.exit(0))` 会把 SIGINT 清理流程吃掉** → 已删。
3. **两套 Ink 进程抢 stdout** → 改用主 TUI 内 `view='setup'` 单进程。
4. **disable 模块后命令仍能触发** → `Command.trigger` 内置 `moduleGuard`。
5. **`process.stdin.isTTY=false` 会让 Ink 报错** → 入口已加 TTY 检测并 fallback 到 `--cli` / `--no-tui`。
6. **db-server 端口被占用** → 启动时 `checkPortConflict()` 直接退出码 2 并给出提示。
7. **`SFMC_ROOT` 环境变量** → 让 db-server 从指定根读 configs/modules；`sim-new-user.js` 用它实现隔离。

## CI

`.github/workflows/ootb.yml` 在每次 push / PR 时跑 `tools/check-ootb.js` + `tools/smoke-modules.js`。
