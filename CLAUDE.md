# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ScriptsForMinecraftServer is a Minecraft Bedrock Script API (SAPI) plugin with five runtime components sharing one git repo:

| Path | Role | Runtime |
|------|------|---------|
| `db-server/` | SQLite HTTP REST API (port 3001) | Node.js 22.13+ |
| `qq-bridge/` | QQ bridge via LLBot OneBot 11 (WS 3002 only) | Node.js |
| `panel/` | TUI management dashboard | Node.js (Ink) |
| `BDSTools/` | BDS auto-updater + behavior-pack assembler | Node.js |
| `sfmc/` | REPL / SEA supervisor / BP build pipeline | Node.js / SEA |
| `modules/packages/<id>/` | Per-module packages; each one a first-class citizen | Node.js + SAPI |
| `modules/sdk/@sfmc-sdk/` | Shared SDK (SAPI/Node umbrella) | consumed by modules |

The behavior pack itself is **assembled live** at deploy time by
`sfmc behavior-pack build` → `bds-tools/pack-manager#assembleBehaviorPack` →
`<BDS>/worlds/<level>/behavior_packs/sfmc-modules/`. There is no
checked-in BP shell — modules are the truth.

## Common Commands

### SAPI behavior pack (assembled from modules)

```bash
sfmc behavior-pack build      # esbuild bundles modules/packages/<id>/sapi/src/index.ts → <ROOT>/build/sfmc-modules/
sfmc behavior-pack deploy     # copies build/sfmc-modules/ into <BDS>/worlds/<level>/behavior_packs/sfmc-modules/
```

Per-module `sapi/src/index.ts` exports a `ModuleRegistry.register({ id, lifecycle })`
call. The build pipeline walks every enabled module's `sapi/src/index.ts`
and bundles them in one go — there is no manual entry.ts to edit.

### db-server

```bash
cd db-server
node inedx.js                  # starts on 127.0.0.1:3001
DB_PORT=4000 node inedx.js     # override port
```

### Management panel

```bash
node panel/index.js            # TUI mode (requires interactive terminal)
node panel/index.js --cli      # print status and exit (pipe-friendly)
node panel/index.js --no-tui   # keep services running, no TUI
```

### Dev tools (run from repo root)

```bash
node tools/check-ootb.mjs          # 平台开箱自检(空 catalog 合法)
node tools/catalog-sync.mjs        # 扫描 packages → 重写 catalog.json
node tools/check-modules.mjs       # 校验 catalog + 已装包 v2 manifest
node tools/fetch-module.mjs search # 查 registry
node tools/fetch-module.mjs install <id>   # 安装并同步 catalog/lock
node tools/fetch-module.mjs uninstall <id>
node tools/smoke-modules.mjs       # 模块 API 冒烟(需 live db-server)
node tools/sim-new-user.mjs        # 隔离 SFMC_ROOT 冒烟
node tools/test-db-api.mjs         # 平台 API 烟测
```

### Build prerequisites

- Node.js 22.13+ for everything (db-server requires `node:sqlite`, which needs the `--experimental-sqlite` CLI flag on 22.5–22.12; unflagged from 22.13)
- Run `sfmc` (or `node sfmc/dist/main.js`) to fill `configs/*.json` via wizard

## Architecture

### Init Order (built into the bundled BP's main.js)

`system.beforeEvents.startup` → `ConfigManager.init()` → `ModuleRegistry.bootAll()` → `ModuleRegistry.snapshotEnabled()`
`world.afterEvents.worldLoad` → `ModuleRegistry.bootAfterWorldLoad()` + `syncWorldData()`

Modules with `afterWorldLoad=false` boot immediately. Those with `afterWorldLoad=true` wait for world load.

### Module System

Truth source: `modules/catalog.json`(本地 mirror,由已装包投影) + `modules/module-lock.json`(启停)。
业务模块源在 `Tanya7z/sfmc-modules`,经 `tools/fetch-module.mjs` 安装。

`ModuleRegistry` (`modules/sdk/@sfmc-sdk/src/module-loader/`) handles all wiring. Each module exports a lifecycle object from `sapi/src/index.ts` with `registerPermissions`, `registerCommands`, `registerEvents`, `init`, `cleanup` hooks. To add a module:

1. 在 `Tanya7z/sfmc-modules` 发布模块,或 `fetch-module install <folder>`
2. `catalog-sync` / install 会把 manifest 投影进 `modules/catalog.json`
3. Run `sfmc behavior-pack build && sfmc behavior-pack deploy`, restart BDS

Module enable/disable at runtime goes through Panel → `POST /api/sfmc/modules/:id/{enable|disable}` → db-server writes `module-lock.json` → SAPI calls `ConfigManager.refreshModules()`. **No hot-reload: restart BDS for changes to take effect.**

### Configuration Model

Plain JSON files under `configs/`. No SQLite, no hot-reload. SAPI calls `GET /api/sfmc/configs/all` once at startup via `ConfigManager.init()` and caches everything in memory. After any `configs/*.json` edit, restart BDS.

Key config endpoints:

- `GET /api/sfmc/settings/{key}` — `land:*` keys fall back to `configs/land.json`; `bridge_channel_id` falls back to `qq_config.json`
- `GET /api/sfmc/configs/all` — one-shot snapshot for SAPI startup

### Message Display

Use `Msg.info/success/error/warning/tips()` from `@sfmc/sdk/sapi/runtime` for all system notifications. **Never use `player.sendMessage()` directly.** These methods handle formatting prefixes (`§f[*]`/`§a[√]`/etc.), sound effects, and system channel forwarding.

### Permissions

`Permission.register(name, level)` during startup. Levels: `Any=0`, `Member=1`, `OP=2`, `Admin=3`. Guard commands with `Command.trigger` (which calls `moduleGuard`) — disabled modules are automatically blocked.

### QQ Bridge Message Flow

```
QQ → MC: LLBot ─WS:3002──→ qq-bridge ─POST──→ db-server:3001/api/sfmc/messages
MC → QQ: db-server POST /api/sfmc/messages ─HTTP──→ LLBot:3004/send_group_msg
```

> qq-bridge 进程**只起 WS 3002**;MC→QQ 由 db-server 直连 LLBot,不再有 3003 中转端口。
> 循环防护:跳过 `sender.user_id === self_id` 的回声 + 5 秒 message_id 去重。

## Prettier

`trailingComma: es5`, `tabWidth: 2`, `semicolons`, `double quotes`, `bracketSpacing`, `arrowParens: always`, `printWidth: 120`, `endOfLine: auto`.
