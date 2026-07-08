# ScriptsForMinecraftServer

![Minecraft](https://img.shields.io/badge/Minecraft-1.21.60-blue?logo=minecraft)
![SAPI](https://img.shields.io/badge/SAPI-2.10.0--beta-orange)
![Node](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

A Minecraft Bedrock behavior pack plugin built on **Script API (SAPI)**, with an external **SQLite-backed HTTP backend** for persistent data storage. Features include a channel-based chat system, land management, co-op teams, shop, activity logging, and more.

基于 SAPI 的 Minecraft Bedrock 行为包插件，配合独立 SQLite HTTP 后端实现持久化存储。包含频道聊天、领土管理、合作社、商店、行为日志等功能。

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Features](#features)
- [db-server (External Database)](#db-server-external-database)
- [Module Details](#module-details)
- [Initialization Flow](#initialization-flow)
- [Environment Variables](#environment-variables)
- [UI Conventions](#ui-conventions)
- [TODO](#todo)
- [Contributing](#contributing)

---

## System Architecture

```
┌─────────────────────────┐      HTTP REST API       ┌──────────────────────────┐
│  Minecraft BDS / Client │ ◄──────────────────────► │    db-server (Node.js)    │
│                         │    POST / GET / PATCH    │                          │
│  ┌───────────────────┐  │                          │  ┌────────────────────┐  │
│  │  SAPI Runtime     │  │                          │  │  HTTP Server       │  │
│  │  @minecraft/server│  │                          │  │  port 3001         │  │
│  │  v2.10.0-beta     │  │                          │  └────────┬───────────┘  │
│  │                   │  │                          │           │               │
│  │  entry.ts init    │  │                          │  ┌────────▼───────────┐  │
│  │  all modules      │  │                          │  │  better-sqlite3    │  │
│  └───────────────────┘  │                          │  │  sfmc_data.db      │  │
│                         │                          │  └────────────────────┘  │
└─────────────────────────┘                          │                          │
                                                     │  ┌────────────────────┐  │
                                                     │  │  Holoprint Engine  │  │
                                                     │  └────────────────────┘  │
                                                     └──────────────────────────┘
```

**Two disjoint components, one repo:** the behavior pack (TypeScript, SAPI) and the database server (Node.js, better-sqlite3). They communicate exclusively via HTTP.

两个独立组件在同一个仓库：行为包（TypeScript / SAPI）和数据库服务（Node.js / better-sqlite3），通过 HTTP 通信。

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (for building the behavior pack and running db-server)
- **Minecraft Bedrock** 1.21.60+ (Preview or Release with Beta APIs enabled)

### Install & Build

```powershell
# Install dependencies for the behavior pack
cd scriptsforminecraftserver
npm install

# Build (TypeScript + esbuild bundle → dist/scripts/main.js)
npm run build

# Lint
npm run lint

# Local deploy to Minecraft dev folder
npm run local-deploy

# Watch mode (auto rebuild & deploy on changes)
npm run local-deploy -- --watch
```

### Start the Database Server

```powershell
# In a separate terminal
cd db-server
node index.js
# Default: http://127.0.0.1:3001
# Override port: $env:DB_PORT=4000; node index.js
```

### Configure Deployment

Edit `scriptsforminecraftserver/.env`:

```
PROJECT_NAME="ScriptsForMinecraftServer"
MINECRAFT_PRODUCT="Custom"
CUSTOM_DEPLOYMENT_PATH="D:\Minecraft\BEServer\worlds\sptest2(ed)"
```

---

## Project Structure

```
ScriptsForMinecraftServer/
├── db-server/                          # SQLite HTTP backend (Node.js)
│   ├── index.js                        #   REST API server (all routes)
│   ├── holoprint/                      #   Holoprint engine integration
│   └── sfmc_data.db                    #   SQLite database (auto-created)
│
├── scriptsforminecraftserver/          # Behavior pack (SAPI / TypeScript)
│   ├── scripts/
│   │   ├── api/                        # REST API wrappers
│   │   │   ├── ActivityLogsApi.ts
│   │   │   ├── ChatApi.ts              #   Channels / Messages / RedPackets
│   │   │   ├── HoloprintApi.ts
│   │   │   ├── KVApi.ts
│   │   │   ├── PlayersDataApi.ts
│   │   │   ├── ScoreboardsSyncApi.ts
│   │   │   └── WorldDataApi.ts
│   │   ├── area/                       # Area-based gameplay control
│   │   │   ├── CreativeArea.ts
│   │   │   ├── Fly.ts
│   │   │   ├── InventorySwitcher.ts
│   │   │   ├── Peace.ts
│   │   │   └── SurvivalArea.ts
│   │   ├── chat/                       # Channel chat system (DogeChat)
│   │   │   ├── ChatSystem.ts           #   Init, events, commands
│   │   │   ├── DogeChat.ts             #   Core logic (pure DB, no cache)
│   │   │   └── DogeTypes.ts            #   Type definitions
│   │   ├── coop/                       # Co-op / team system
│   │   │   ├── CoopCore.ts
│   │   │   ├── CoopSystem.ts
│   │   │   └── Database.ts
│   │   ├── data/                       # Data / configuration
│   │   │   ├── ActivityLog.ts
│   │   │   ├── Config.ts
│   │   │   ├── PermissionData.ts
│   │   │   ├── Player.ts
│   │   │   ├── Questions.ts
│   │   │   ├── Scoreboards.ts
│   │   │   ├── Shop.ts
│   │   │   ├── World.ts
│   │   │   └── menu/                   # Menu configuration
│   │   ├── doge/                       # General utilities
│   │   │   ├── AFK.ts
│   │   │   ├── Clean.ts
│   │   │   ├── EntityControl.ts
│   │   │   ├── Menu.ts
│   │   │   ├── OnlineTime.ts
│   │   │   ├── QA.ts
│   │   │   ├── SpawnProtect.ts
│   │   │   └── TPS.ts
│   │   ├── gui/                        # UI forms (modal / action)
│   │   │   ├── ChatGUI.ts
│   │   │   ├── CoopGUI.ts
│   │   │   ├── DpEditor.ts
│   │   │   ├── FormShop.ts
│   │   │   ├── LandGUI.ts
│   │   │   ├── MainMenu.ts
│   │   │   ├── MoneyGUI.ts
│   │   │   └── ShopGUI.ts
│   │   ├── holo/                       # Holographic display
│   │   │   ├── HoloCore.ts
│   │   │   ├── HoloEntity.ts
│   │   │   └── HoloGUI.ts
│   │   ├── land/                       # Land / territory system
│   │   │   ├── LandAPI.ts
│   │   │   ├── LandCore.ts
│   │   │   ├── LandDatabase.ts
│   │   │   ├── LandEvents.ts
│   │   │   └── LandSystem.ts
│   │   ├── libs/                       # Core libraries
│   │   │   ├── Command.ts              #   Command registration & dispatch
│   │   │   ├── Gui.ts                  #   UI form helpers
│   │   │   ├── HttpDB.ts               #   HTTP client for db-server
│   │   │   ├── Money.ts                #   Scoreboard-based currency
│   │   │   ├── Permission.ts           #   Permission system
│   │   │   └── Tools.ts                #   Utilities (Msg, format, ID gen)
│   │   ├── shop/                       # Chest shop
│   │   │   └── ShopSystem.ts
│   │   ├── shit/                       # Fun / entertainment
│   │   │   └── ShitMountain.ts
│   │   ├── temp/                       # Temporary / experimental
│   │   │   └── ChatSoundsHelper.ts
│   │   ├── entry.ts                    # Module initialization entry
│   │   └── main.ts                     # Bootstrap
│   ├── behavior_packs/                 # Pack manifest & resources
│   ├── resource_packs/
│   ├── just.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── .prettierrc.json
│   ├── .env
│   └── package.json
└── README.md
```

---

## Features

### Core

| Module | Description |
|--------|-------------|
| **Command System** | `!<command>` prefix in chat, with string-based permission nodes |
| **Scoreboard Money** | `Money.UNIT` currency backed by a scoreboard objective |
| **Permission System** | Granular `Permission.register(name, level)`, levels: Any / Member / OP / Admin |
| **Configuration** | Centralized `Config.ts` for areas, chest layouts, cleanup params |

### DogeChat — Channel Chat System

A channel-based messaging system. All channels are visible to everyone; players switch their active channel to send/receive messages.

| Type | Auto-created | Description |
|------|-------------|-------------|
| Public | ✓ | Default server-wide channel, 7-day retention |
| Broadcast | ✓ | Announcement board, admin-only posting, permanent retention |
| System | On player join | Per-player system message channel, 1-day retention, read-only |
| Private | On first DM | Two-party direct message, 30-day retention |
| Custom | By player/admin | Configurable broadcast / slow-mode, 7-day retention |

Channel properties: `allowChat`, `slowMode` (seconds), `isBroadcast` (admin-only posting).

**Data flow (pure DB, no in-memory cache):**

```
Player types !ch
       │
       ▼
world.beforeEvents.chatSend
       │
       ▼
Command.trigger("ch")
       │
       ▼
DogeChat.cycleChannel(player) ──► GET /api/sfmc/channels?type=public (raw data from SQLite)
       │
       ▼
DogeChat.setActiveChannel(player, newId) ──► PATCH /api/sfmc/players/{id}
       │
       ▼
DogeChat.loadChannelHistory(player, newId) ──► GET /api/sfmc/messages?channelId=...
       │
       ▼
player.sendMessage() — display history
```

The only runtime state kept in memory is `activeChannelMap: Map<playerId, channelId>` for real-time message broadcast — this is session state, not a data cache.

### Chat Commands

| Command | Function |
|---------|----------|
| `!channel` | Open channel management panel |
| `!ch` | Quick-cycle active channel (skip private) |
| `!msg` | Quick DM panel |
| `!lo` | Send current location to active channel |
| `!tp` | Send teleport invite (DM directly, multi-player shows picker) |
| `!hongbao` | Red packet panel (send + claim) |
| `!hb` | Quick red packet send |

### Red Packets

All operations go directly to the database — no in-memory cache.

```
Send: HTTP POST /api/sfmc/redpacket → deduct money → done
Claim: PATCH /api/sfmc/redpacket/{id} → add money → done
List:  GET /api/sfmc/redpacket → filter by receiver & expiry
```

### Shop (Chest Shop)

Double-chest based shop using `Config.shopChest` layout configuration.

- `!shop` opens shop GUI
- Buy & sell items (prices stored via Dynamic Properties)
- `Money.UNIT` unified currency

### Land / Territory

Full land management:

- Create / delete claims
- Permission management (break, place, interact, container, etc.)
- Member management
- Land teleport
- Toggle protection

### Co-op / Team System

- Create, join, leave teams
- Member & permission management

### Area Control

| Module | Description |
|--------|-------------|
| **Area Flight** | Allow flight in survival within defined zones |
| **Area Peace** | Prevent mob spawning in defined zones |
| **Creative Area** | Auto-switch to creative on entry |
| **Survival Area** | Auto-switch to survival on entry |
| **Creative Block List** | Configurable block blacklist for creative zones |

### Utilities

| Module | Description |
|--------|-------------|
| **AFK Detection** | Auto-mark AFK after timeout, kick configurable |
| **Item Cleaner** | Auto-clean excess ground items with whitelist |
| **Entity Control** | Manual kill / clear nearby entities |
| **Inventory Switcher** | Save & restore independent inventories per game mode |
| **Spawn Protection** | Brief invulnerability on join |
| **QA Quiz** | Timed random quiz questions with rewards |
| **Online Time** | Per-second tracking, persisted to DB every tick |
| **TPS Monitor** | Server ticks-per-second monitoring |
| **Scoreboard Sync** | Backup scoreboard to SQLite on startup & shutdown |
| **Activity Log** | Log player actions to SQLite with 2s batch flush |
| **World Data Sync** | Sync world metadata to SQLite on startup & shutdown |

### Money Commands

| Command | Function |
|---------|----------|
| `!money` | Check balance |
| `!pay <player> <amount>` | Transfer |
| `!setmoney <player> <amount>` | Set balance (admin) |
| `!addmoney <player> <amount>` | Add balance (admin) |
| `!reduce <player> <amount>` | Reduce balance (admin) |

---

## db-server (External Database)

A standalone **Node.js HTTP service** using **better-sqlite3** (WAL mode) that provides a REST API for all persistent data.

### Start

```bash
cd db-server
node index.js
# Default: http://127.0.0.1:3001
# Override: DB_PORT=4000 node index.js
```

### Database Tables

| Table | Stores | Source Module |
|-------|--------|---------------|
| `sfmc_world` | World metadata (seed, gamerules, difficulty, time, etc.) | World Sync |
| `sfmc_players` | Player data, online time, active channel, permissions | Player / OnlineTime / Chat |
| `sfmc_chat_channels` | Channel definitions & config | DogeChat |
| `sfmc_chat_messages` | Chat message history | DogeChat |
| `sfmc_chat_redpackets` | Red packet data | DogeChat |
| `sfmc_scoreboards` | Scoreboard objective snapshots | Scoreboard Sync |
| `sfmc_activities` | Player activity event log | Activity Log |
| `sfmc_coop_data` | Key-value store for co-op data | Co-op System |
| (Holoprint tables) | Holographic display data | Holoprint |

### REST API

All endpoints under `/api/sfmc/*`. The server uses path-based routing (grouped by resource).

#### Channels

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/channels` | List channels (filters: `search`, `type`, `ownerId`, `minCreatedAt`, `maxCreatedAt`) |
| `POST` | `/api/sfmc/channels` | Create/replace channels (batch) |
| `GET` | `/api/sfmc/channels/:id` | Get single channel |
| `PATCH` | `/api/sfmc/channels/:id` | Update channel fields |
| `DELETE` | `/api/sfmc/channels/:id` | Delete channel |

#### Messages

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/messages` | List messages (filters: `channelId`, `from`, `type`, `minSentAt`, `maxSentAt`) |
| `POST` | `/api/sfmc/messages` | Save messages (batch, max 100) |

#### Red Packets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/redpacket` | List all red packets |
| `POST` | `/api/sfmc/redpacket` | Create red packet |
| `GET` | `/api/sfmc/redpacket/:id` | Get single red packet |
| `PATCH` | `/api/sfmc/redpacket/:id` | Update red packet (remaining amount/count, receivers) |
| `DELETE` | `/api/sfmc/redpacket/:id` | Delete red packet |

#### Players

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/players` | List players (filters: `search`, `name`, `id`, `active_channel`) |
| `POST` | `/api/sfmc/players` | Create/replace players (batch) |
| `GET` | `/api/sfmc/players/:id` | Get single player |
| `PATCH` | `/api/sfmc/players/:id` | Update player fields |

#### Scoreboards

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/scoreboards` | List scoreboard entries |
| `POST` | `/api/sfmc/scoreboards` | Backup scoreboard entries |

#### World

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/world` | Get world metadata |
| `POST` | `/api/sfmc/world` | Save world metadata |

#### Activity Logs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sfmc/activities/batch` | Batch insert activity entries |
| `GET` | `/api/sfmc/activities` | Query logs (filters: `id`, `event`, `from`, `to`, `name`, `limit`, `offset`) |
| `GET` | `/api/sfmc/activities/stats` | Activity statistics (`id`, `from`, `to`) |
| `POST` | `/api/sfmc/activities/cleanup` | Purge old entries (params: `keepDays`, `keepAdmin`) |

#### Co-op

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sfmc/coop/:key` | Read co-op data by key |

#### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check (returns uptime) |

---

## Module Details

### Initialization Flow

```
entry.ts
  │
  ├─ system.beforeEvents.startup
  │     ├─ Permission.register() — declare all permission nodes
  │     ├─ Command.register() — register all !commands
  │     ├─ Fly.init(), Menu.init()
  │     ├─ OnlineTime, CreativeArea, etc. registerCommands()
  │     └─ ...
  │
  ├─ world.afterEvents.worldLoad
  │     ├─ AFK.init()
  │     ├─ CoopSystem.init()
  │     ├─ ChatSystem.init() → DogeChat.ensureDefaultChannels()
  │     ├─ OnlineTime.getInstance().init() → start per-second tick
  │     ├─ ScoreboardSync.init() → backup scoreboard to DB
  │     ├─ syncWorldData() → save world metadata to DB
  │     ├─ ActivityLog.init()
  │     └─ ...
  │
  ├─ world.afterEvents.playerSpawn (initialSpawn)
  │     ├─ Peace.getInstance().init()
  │     ├─ Fly.playerJoinEvent()
  │     ├─ AFK.reset()
  │     └─ savePlayers() — persist player data on join
  │
  ├─ world.afterEvents.playerLeave
  │     ├─ savePlayers() — persist player data on leave
  │     └─ OnlineTime.onPlayerLeave() — persist final online time
  │
  ├─ world.beforeEvents.chatSend
  │     └─ intercept "!" / "！" → Command.trigger()
  │
  └─ system.beforeEvents.shutdown
        ├─ syncWorldData()
        └─ ScoreboardsBackup()
```

### Command Processing

```
Player sends "!help"
       │
       ▼
world.beforeEvents.chatSend
  ┌─ firstChar === "!" → cancel original message
  │
  ├─ Command.trigger(player, "help")
  │     ├─ Command.canExecute(player, permission)
  │     │     └─ Permission.check(player, "help.see")
  │     ├─ system.run(async () => {
  │     │     const result = await callback(player);
  │     │     if (result !== undefined) Msg.success(result, player);
  │     │   })
  │     └─ return
  │
  └─ (if not "!") → DogeChat.sendChannelMessage() — redirect to active channel
```

### DogeChat Message Delivery

```
Player sends message in active channel
       │
       ▼
world.beforeEvents.chatSend (message doesn't start with "!")
       │
       ▼
ChatSystem → DogeChat.sendChannelMessage(player, channelId, content)
       │
       ├─ 1. ChatApi.getChannel(channelId) — GET /api/sfmc/channels/:id
       │     └─ check config.allowChat, config.slowMode, config.isBroadcast
       │
       ├─ 2. ChatApi.saveMessages([msg]) — POST /api/sfmc/messages
       │
       ├─ 3. Broadcast to activeChannelMap:
       │     for each online player:
       │       if activeChannelMap[player.id] === channelId:
       │         player.sendMessage(display)
       │
       └─ 4. Update slowModeTracker
```

### Online Time

Per-second tick, pure DB persistence:

```
system.runInterval(every 20 ticks = 1 second)
       │
       ▼
OnlineTime.tickSecond()
       │
       ├─ for each online player:
       │     ├─ load data from Map (loaded from DB on join)
       │     ├─ check date/month reset
       │     ├─ increment session/today/month/total
       │     └─ PATCH /api/sfmc/players/{id} — persist to DB
       │
       └─ onPlayerLeave → final persist → delete from Map
```

### Activity Log

```
Event triggers (block break, chat, death, etc.)
       │
       ▼
Enqueue to in-memory batch queue
       │
       ▼
Every 2 seconds: flush
       │
       ▼
POST /api/sfmc/activities/batch
       │
       ▼
SQLite transaction batch INSERT
```

**Retention:** 30 days for regular events, permanent for `admin.*` events. Auto-cleanup every 6 hours.

### Scoreboard Sync

| Event | Action |
|-------|--------|
| Server start | `ScoreboardsBackup()` → POST `/api/sfmc/scoreboards` |
| Server stop | `ScoreboardsBackup()` via `system.beforeEvents.shutdown` |
| Manual | `!sbs` (backup), `!sbs_load` (restore from DB) |

### World Data Sync

| Event | Action |
|-------|--------|
| Server start | `syncWorldData()` → POST `/api/sfmc/world` |
| Server stop | `syncWorldData()` via `system.beforeEvents.shutdown` |

### Player Data Sync

| Event | Action |
|-------|--------|
| Player join | `getPlayerData()` → POST `/api/sfmc/players` |
| Player leave | `getPlayerData()` → POST `/api/sfmc/players` |

---

## Environment Variables

### Behavior Pack (`scriptsforminecraftserver/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PROJECT_NAME` | Behavior pack folder name | `ScriptsForMinecraftServer` |
| `MINECRAFT_PRODUCT` | Deploy target (`BedrockGDK`, `PreviewGDK`, `Custom`) | `Custom` |
| `CUSTOM_DEPLOYMENT_PATH` | Custom deploy path (when `MINECRAFT_PRODUCT=Custom`) | — |

### db-server

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PORT` | HTTP server port | `3001` |

### Runtime (SAPI)

| Config | Description | Source |
|--------|-------------|--------|
| `Config.dbHost` | db-server hostname | `Config.ts` |
| `Config.dbPort` | db-server port | `Config.ts` |

---

## UI Conventions

### Message Display (Msg)

All chat messages use `libs/Tools.ts` `Msg` helpers:

| Function | Prefix | Usage |
|----------|--------|-------|
| `Msg.info(text, player)` | `§f[*]` | General info |
| `Msg.success(text, player)` | `§a[√]` | Success |
| `Msg.error(text, player)` | `§c[x]` | Error |
| `Msg.warning(text, player)` | `§e[!]` | Warning |
| `Msg.tips(text, player)` | `§7[!]` | Tip |

### Form Body (ListFormInfo)

```typescript
ListFormInfo([
  `First line (gets [*] prefix)`,
  `  Indented line (plain)`,
])
```

### Button Format

- No formatting codes except `§l返回` for back buttons
- No formatting codes in form titles

---

## TODO

- [ ] Sit / crawl mechanics
- [ ] Addon removal helper
- [ ] Auto chunk loading
- [ ] Ender chest interaction override
- [ ] Player permission management via script
- [ ] Web dashboard for log viewing
- [ ] Discord bot integration (server status, chat bridge)

---

## Contributing

PRs are welcome! Please follow the existing code conventions:

- **TypeScript**: `trailingComma: es5`, `tabWidth: 2`, double quotes, semicolons
- **Message display**: Always use `Msg.*()` helpers
- **Form body**: Always use `ListFormInfo()`
- **Commands**: Register via `Command.register()` in `startup` phase
- **Permissions**: Register via `Permission.register()` in `startup` phase
- **Storage**: New features should use db-server HTTP API, not `world.setDynamicProperty`
