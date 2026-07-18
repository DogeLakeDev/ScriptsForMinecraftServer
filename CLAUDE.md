# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ScriptsForMinecraftServer is a Minecraft Bedrock Script API (SAPI) plugin with five runtime components sharing one git repo:

| Path | Role | Runtime |
|------|------|---------|
| `scriptsforminecraftserver/` | Behavior pack — game logic, commands, GUIs | Minecraft Bedrock (SAPI) |
| `db-server/` | SQLite HTTP REST API (port 3001) | Node.js 22.5+ |
| `qq-bridge/` | QQ bridge via LLBot OneBot 11 (WS 3002 only) | Node.js |
| `panel/` | TUI management dashboard | Node.js (Ink) |
| `BDSTools/` | BDS auto-updater | Node.js |

## Common Commands

### SAPI behavior pack (scriptsforminecraftserver/)

```powershell
cd scriptsforminecraftserver
npm install                    # install deps (required before first run)
npm run build                  # tsc + esbuild bundle → dist/scripts/main.js
npm run local-deploy           # build + copy to BDS path from .env
npm run lint                   # ESLint
```

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
node tools/check-ootb.js       # self-check: validates environment readiness
node tools/check-catalog.js    # validates catalog.json (unique IDs, dependency closure, entry paths)
node tools/smoke-modules.js    # module system regression test (requires live db-server)
node tools/lock.js rebuild    # rebuild modules/lock.json file fingerprints
node tools/lock.js drift       # detect drifted files
node tools/install-module.js install <id>   # install module
node tools/install-module.js uninstall <id> # uninstall module
```

### Build prerequisites

- Node.js 18+ for SAPI; Node.js 22.5+ for db-server
- Create `scriptsforminecraftserver/.env` from `.env.example` with `PROJECT_NAME` and `CUSTOM_DEPLOYMENT_PATH`

## Architecture

### Init Order (entry.ts)

`system.beforeEvents.startup` → `ConfigManager.init()` → `ModuleRegistry.bootAll()` → `ModuleRegistry.snapshotEnabled()`
`world.afterEvents.worldLoad` → `ModuleRegistry.bootAfterWorldLoad()` + `syncWorldData()`

Modules with `afterWorldLoad=false` boot immediately. Those with `afterWorldLoad=true` wait for world load.

### Module System

Truth source: `modules/catalog.json` (metadata) + `modules/module-lock.json` (install state).

`ModuleRegistry` (`scripts/libs/ModuleRegistry.ts`) handles all wiring. Each module registers a lifecycle object with `registerPermissions`, `registerCommands`, `registerEvents`, `init`, `cleanup` hooks. To add a module:

1. Add entry to `modules/catalog.json`
2. Call `ModuleRegistry.register({ id, afterWorldLoad, lifecycle: { ... } })` in `scripts/entry.ts`
3. Build with `npm run build`

Module enable/disable at runtime goes through Panel → `POST /api/sfmc/modules/:id/{enable|disable}` → db-server writes `module-lock.json` → SAPI calls `ConfigManager.refreshModules()`. **No hot-reload: restart BDS for changes to take effect.**

### Configuration Model

Plain JSON files under `configs/`. No SQLite, no hot-reload. SAPI calls `GET /api/sfmc/configs/all` once at startup via `ConfigManager.init()` and caches everything in memory. After any `configs/*.json` edit, restart BDS.

Key config endpoints:

- `GET /api/sfmc/settings/{key}` — `land:*` keys fall back to `configs/land.json`; `bridge_channel_id` falls back to `qq_config.json`
- `GET /api/sfmc/configs/all` — one-shot snapshot for SAPI startup

### Message Display

Use `Msg.info/success/error/warning/tips()` from `libs/Tools.ts` for all system notifications. **Never use `player.sendMessage()` directly.** These methods handle formatting prefixes (`§f[*]`/`§a[√]`/etc.), sound effects, and system channel forwarding.

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
