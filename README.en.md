# ScriptsForMinecraftServer

> A monorepo for a Minecraft Bedrock Script API (SAPI) behavior pack plus a set of Node.js sidecar services. 22+ business modules collaborate as BP code + Node services; a single SEA executable ships the whole supervisor.
> Bilingual: [中文版本 →](./README.md)

[![version](https://img.shields.io/github/v/tag/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square&label=version)](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tags)
[![license](https://img.shields.io/github/license/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-22.5%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![sea](https://img.shields.io/badge/SEA-single--executable-FF6B6B?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/api/single-executable-applications.html)
[![modules](https://img.shields.io/badge/modules-25-7B68EE?style=flat-square&logo=cube&logoColor=white)](./modules/catalog.json)
[![bd](https://img.shields.io/badge/BDS-1.26.x-00BC8C?style=flat-square&logo=minecraft)](https://www.minecraft.net/en-us/download/server/bedrock)
[![discord](https://img.shields.io/badge/QQ-QQ--bridge-1E90FF?style=flat-square&logo=tencent-qq)](./qq-bridge)

---

## Project overview

ScriptsForMinecraftServer turns Bedrock Dedicated Server's scripting surface into a complete server-side system:

- **Module-by-package model** — every entry under `modules/packages/<id>/` is a first-class module; modules are registered through `modules/catalog.json` and loaded by `ModuleRegistry`. `type` in the catalog distinguishes `core` (infrastructure) from `feature` (add-on functionality).
- **4 top-level services** — `db-server` (SQLite REST API) / `qq-bridge` (QQ ⇄ MC bridge) / `bds-tools` (BDS process manager) / `sfmc` (SEA CLI).
- **Single SEA executable** — `dist/sea/sfmc.exe` runs every dispatch mode from one binary.
- **SDK toolkit** `@sfmc/sdk` — lives at `modules/sdk/@sfmc-sdk/` and shares low-level contracts across the SAPI / Node split. **It is a toolkit, not a module.**
- **Build-time module fetch** — one-shot CLI `tools/fetch-module.mjs` populates modules from GitHub Releases (or `cp -r` from a local checkout). The SEA itself never connects to the network.

## Architecture diagram

```mermaid
flowchart TB
    %% ============== BDS side ==============
    subgraph BDS["Minecraft BDS 1.26.x (host)"]
      direction TB
      BP["behavior_packs/ScriptsForMinecraftServer<br/>scripts/entry.ts → esbuild → main.js"]
      REG["ModuleRegistry<br/>register / bootAll / bootAfterWorldLoad"]
      MODS_SAPI["SAPI modules (in-process)<br/>registered via catalog.json"]
      CONF["ConfigManager<br/>GET /api/sfmc/configs/all once"]
      BP --> REG --> MODS_SAPI
      REG -. "snapshot at startup" .-> CONF
    end

    %% ============== Local services ==============
    subgraph HOST["Local host (127.0.0.1)"]
      direction TB

      subgraph SEA["sfmc.exe (Node SEA single binary)"]
        direction LR
        DISP["dispatcher<br/>SFMC_SERVICE switch"]
        CLI["sfmc REPL<br/>interactive + start -all"]
        DISP --> CLI
      end

      subgraph SVC["Top-level services"]
        direction TB
        DB["db-server<br/>SQLite + REST API<br/>:3001 HTTP"]
        QQ["qq-bridge<br/>OneBot 11 reverse WS<br/>:3002"]
        BDS_T["bds-tools<br/>check-update · process manager"]
      end

      subgraph MODS["modules/packages/&lt;id&gt;/  (every package is a first-class module)"]
        direction LR
        M1["core-*<br/>(infrastructure)<br/>data-backup · gui · ..."]
        M2["feature-*<br/>(add-on)<br/>land · economy · chat · ..."]

        SDK["modules/sdk/@sfmc-sdk<br/>toolkit, NOT a module<br/>shared by SAPI / Node"]
      end

      CAT["modules/catalog.json<br/>module catalog + type field<br/>(core / feature)"]
      LOCK["modules/module-lock.json<br/>enable / disable state"]
    end

    %% ============== External ==============
    subgraph EXT["External"]
      LLBOT["LLBot (OneBot 11)<br/>QQ protocol side"]
      QQUSERS["QQ chat users"]
      BDS_USER["MC players"]
    end

    %% ============== Data flows ==============
    DISP -. "spawn / supervise" .-> DB
    DISP -. "spawn / supervise" .-> QQ
    DISP -. "spawn / supervise" .-> BDS_T

    %% SAPI ↔ db-server
    MODS_SAPI -- "HTTP :3001<br/>GET/POST /api/sfmc/*" --> DB
    CONF -- "HTTP :3001<br/>GET /api/sfmc/configs/all" --> DB

    %% CLI ↔ db-server (module toggle)
    CLI -- "PATCH /api/sfmc/modules/:id<br/>→ write module-lock.json" --> DB
    DB -. "ConfigManager.refreshModules()<br/>(after BDS restart)" .-> REG

    %% SDK shared (compile-time, not a module)
    SDK -. "compile-time deps" .-> MODS_SAPI
    SDK -. "compile-time deps" .-> DB

    %% catalog / module-lock
    CAT -. "registers metadata" .-> REG
    LOCK -. "read at startup" .-> REG

    %% QQ bridge message flow
    QQUSERS <-->|QQ msgs| LLBOT
    LLBOT -- "WS :3002 (QQ→MC)" --> QQ
    QQ -- "POST :3001 /api/sfmc/messages" --> DB
    DB -- "HTTP :3004 /send_group_msg (MC→QQ)" --> LLBOT

    %% Players
    BDS_USER <-->|SAPI events| BP

    %% Build-time module fetch
    FETCH["tools/fetch-module.mjs<br/>(build-time, offline in SEA)"]
    FETCH -. "populate from GitHub Releases<br/>(or cp -r local checkout)" .-> MODS_SAPI

    classDef seaBox fill:#FFE5E5,stroke:#FF6B6B,stroke-width:2px
    classDef svcBox fill:#E8F5E9,stroke:#43A047
    classDef modBox fill:#EDE7F6,stroke:#7B68EE
    classDef sdkBox fill:#FFF8E1,stroke:#F9A825
    classDef bdsBox fill:#E3F2FD,stroke:#1976D2
    classDef extBox fill:#FFF3E0,stroke:#FB8C00
    class DISP,CLI seaBox
    class DB,QQ,BDS_T svcBox
    class M1,M2 modBox
    class SDK sdkBox
    class BP,REG,MODS_SAPI,CONF bdsBox
    class LLBOT,QQUSERS,BDS_USER extBox
```

## Module lifecycle

```mermaid
flowchart LR
    A["Author<br/>writes module"] -->|manifest.json| B["modules/packages/&lt;id&gt;/"]
    B -->|npm run build:full| C["esbuild bundle<br/>+ manifest aggregation"]
    C -->|copy to| D["BDS behavior_packs"]
    D -->|reload BP| E["SAPI boots modules<br/>enabled in catalog"]
    B -->|db-server scan| F["db-server route registration"]
    E <-->|HttpDB| F
```

## Quick start

SFMC ships two equivalent on-ramps. Pick whichever feels right.

### ⚡ SEA single-exe (recommended — skip Node entirely)

```bash
# 1. Grab sfmc.exe for your platform from GitHub Releases, drop it in an empty dir
# 2. Self-check
node tools/check-ootb.js            # or just run ./sfmc.exe wizard from the same folder

# 3. First launch runs the wizard: pick BDS path / LLBot path / backup dir,
#    then pick 1+ modules — it auto-installs → builds → deploys to BDS.
./sfmc.exe                          # alias for sfmc

# 4. Once REPL is up, install more modules without restarting BDS:
sfmc> module install <id>
sfmc> behavior-pack build && behavior-pack deploy

# 5. Bring up everything
sfmc> start -all
```

### ⚙️ npm monorepo (developers — edit BP scripts / write custom modules)

```bash
# 1. clone + install
git clone https://github.com/DogeLakeDev/ScriptsForMinecraftServer
cd ScriptsForMinecraftServer
npm install

# 2. Self-check + wizard (fill in BDS / LLBot / backup paths)
node tools/check-ootb.js
node sfmc/dist/main.js              # same as sfmc

# 3. Install modules (default: first-party sfmc-modules registry)
node tools/fetch-module.mjs install peace
node tools/fetch-module.mjs search                     # see what's available

# 4. After editing BP / writing a custom module:
npm run build --workspaces         # rebuild SDK + assembly tooling
sfmc> behavior-pack build && behavior-pack deploy

# 5. Start
sfmc> start -all
```

Both paths share the same:
- First-party module registry `Shiroha7z/sfmc-modules` (GitHub Releases).
- `tools/fetch-module.mjs` to pull modules.
- `sfmc behavior-pack build/deploy` driven by `bds-tools/pack-manager`.
- `modules/module-lock.json` for enable/disable state.

The SEA does **not** ship a fixed behavior pack — the BP is assembled live from your enabled modules. Modules not in the first-party registry trigger a yellow "unknown source" warning at boot; verify before trusting.

## Directory layout

```
ScriptsForMinecraftServer/
├── bds-tools/             BDS auto-update + process manager
├── db-server/             SQLite HTTP REST API (port 3001)
├── qq-bridge/             QQ bridge (LLBot OneBot 11)
├── sfmc/                  REPL management CLI (runs through the SEA)
├── remote-controller/     Remote agent
├── modules/
│   ├── catalog.json       22 business module rows
│   ├── module-lock.json   enable/disable state
│   ├── sdk/@sfmc-sdk/     single umbrella
│   └── packages/          25 business modules
├── tools/                 self-check + build + fetch-module.mjs
├── configs-default/       default config JSON
├── build-sea.mjs          SEA build entry
└── docs/                  bilingual docs
    ├── user-guide.en.md
    ├── marketplace.en.md
    └── dev/{module-author,sdk-reference,manifest-contract}.en.md
```

## Documentation index

| 中文 | English | Audience |
|------|---------|----------|
| [使用文档](./docs/user-guide.zh.md) | [User Guide](./docs/user-guide.en.md) | Operators / end users |
| [模块管理指南](./docs/marketplace.zh.md) | [Module Management](./docs/marketplace.en.md) | Operators (SEA module install) |
| [模块作者指南](./docs/dev/module-author.zh.md) | [Module Author Guide](./docs/dev/module-author.en.md) | SAPI module authors |
| [SDK 三抽屉 API](./docs/dev/sdk-reference.zh.md) | [SDK Reference](./docs/dev/sdk-reference.en.md) | Module authors (API lookup) |
| [manifest 契约](./docs/dev/manifest-contract.zh.md) | [Manifest Contract](./docs/dev/manifest-contract.en.md) | Module authors (writing contracts) |
| [CLAUDE.md](./CLAUDE.md) | same | Project notes for Claude Code |

## Requirements

| Component | Required |
|-----------|----------|
| Node.js | 22.5+ (db-server uses native `node:sqlite`) + 18+ (SAPI bundle) |
| OS | Windows 10/11 (primary), Linux/macOS supported |
| BDS | Bedrock Dedicated Server 1.26.x |
| Disk | ~500 MB (BP + services + node_modules) |

Windows: BDS needs Loopback Exemption (now bundled into the wizard):

```powershell
CheckNetIsolation LoopbackExempt -is -n=Microsoft.MinecraftUWP_8wekyb3d8bbwe
```

## Ports

| Port | Purpose |
|------|---------|
| `3001` | db-server REST API (BP / sfmc / qq-bridge all hit this) |
| `3002` | qq-bridge inbound reverse WebSocket from LLBot OneBot 11 |
| `3004` | db-server → LLBot (MC→QQ direct; **3003 is unused**) |

## Roadmap

- ✅ **Stage I**: per-module manifest + emit-manifest + db-server reader
- ✅ **Stage J**: `shared/*` migrated into `@sfmc/sdk`; 22 modules migrated out
- ✅ **Stage K**: SEA slim — modules stripped from the SEA, populated by `tools/fetch-module.mjs`
- 🚧 **Stage L**: auto-extract remote zips; `sfmc module install --enable-and-deploy` one-shot
- 🚧 **Stage M**: module signing / public-key verification (replace plain SHA-256)
- 🚧 **Stage N+**: service mesh (multi-BDS / cross-node)

## License

[MIT](./LICENSE)

---

[中文版本 →](./README.md)