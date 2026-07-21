# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

npm workspaces monorepo (root `package.json` has `workspaces`):

| Path | What | Runtime |
|------|------|---------|
| `db-server/` | SQLite HTTP REST backend (plain `node:http` + `node:sqlite`) | Node.js >=22.5 |
| `qq-bridge/` | QQ bridge (LLBot OneBot 11, WS 3002) | Node.js |
| `bds-tools/` | BDS auto-updater + behavior-pack assembler | Node.js |
| `sfmc/` | CLI management tool (REPL + supervisor), assembles SAPI BP at deploy time | Node.js, can SEA-bundle |
| `modules/packages/<id>/` | Per-module packages; each one a first-class citizen | Node.js + SAPI |
| `modules/sdk/@sfmc-sdk/` | Shared SDK consumed by modules | mixed |
| `shared/sfmc-logs/` | Shared logging library `@sfmc/logs` | Node.js |

**`panel/` no longer exists** — replaced by `sfmc/` CLI (the old AGENTS.md was stale).

## Plugin entry & init order

The behavior pack is **assembled at deploy time** by `sfmc behavior-pack build` →
`bds-tools/pack-manager#assembleBehaviorPack`. The bundle entry walks every
enabled module's `sapi/src/index.ts` and emits a single `scripts/main.js`.

Init phases (inside the bundled `main.js`):

1. `system.beforeEvents.startup` — `ConfigManager.init()` → register permissions & commands via `ModuleRegistry`
2. `world.afterEvents.worldLoad` — `ModuleRegistry.bootAfterWorldLoad()` + `MonitorReporter` + `syncWorldData()`
3. `world.afterEvents.playerSpawn` (initialSpawn) — Peace, Fly, AFK reset
4. `world.afterEvents.playerSpawn` — SpawnProtect
5. `world.beforeEvents.chatSend` — intercept `!`/`！` commands

## Build & deploy

### SAPI behavior pack (assembled from modules)

The BP has no checked-in shell. Everything lives in modules and SDK:

```bash
sfmc behavior-pack build     # esbuild bundles modules/packages/<id>/sapi/src/index.ts → <ROOT>/build/sfmc-modules/
sfmc behavior-pack deploy    # copies build/sfmc-modules/ into <BDS>/worlds/<level>/behavior_packs/sfmc-modules/
```

Each module exports a `ModuleRegistry.register({ id, lifecycle })` call from its
`sapi/src/index.ts`. The build pipeline walks every enabled module's entry and
bundles them in one go. To make changes load, run `build && deploy` and restart BDS.

### Root monorepo commands (run from repo root)

```powershell
npm run start       # node index.js → sfmc CLI
npm run build       # npm run build --workspaces
npm run lint        # eslint . --ext .ts,.tsx
npm run bundle      # node build-sea.mjs (esbuild SEA bundle)
npm run sea         # node --build-sea sea-config.json (inject SEA blob)
```

To build all workspaces: `npm run build`.

### db-server

```bash
cd db-server
npm run dev          # tsx src/index.ts
npm run start        # node dist/index.js
npm run build        # tsc -p tsconfig.json
npm run test         # node --test src/*.test.js
DB_PORT=4000 npm run dev   # override port
```

Port defaults to 3001. Config: `configs/db_config.json` (`db_port` key). Auth via `http_auth` in same file or `HTTP_AUTH` env var.

### bds-tools (TypeScript)

```bash
cd bds-tools
npm run build              # tsc → dist/
npm run update             # node dist/check-update.js
npm run update:check       # --check-only
npm run update:force       # --force (+ download + overwrite)
npm run rollback           # node recovery.js
npm run start|stop|status|watch  # bds-manager commands
```

### sfmc CLI

```bash
node index.js               # REPL (interactive)
node index.js status        # print status and exit
node index.js start <svc>   # start a service
node index.js stop <svc>    # stop a service
node index.js restart <svc> # restart a service
node index.js init          # setup wizard
node index.js update        # BDS update
```

Services managed by `SFMC_SERVICE` env: `db`, `qq`, `update`, `manager`.

### SEA single-exe build

```bash
npm run bundle   # esbuild bundle sfmc/src/dispatcher.ts → dist/sea/dispatcher.mjs
npm run sea      # inject into node binary → dist/sea/sfmc.exe
```

CI builds for win/linux/macos on `v*` tags.

## Module system

Source of truth: `modules/catalog.json` (metadata) + `modules/module-lock.json` (install state).

- `tools/check-catalog.js` — validates unique IDs, dependency closure, entry-path existence
- `tools/install-module.js install|uninstall <id>` — update logical install state
- `tools/lock.js rebuild|drift` — rebuild/detect file fingerprint drift
- `tools/smoke-modules.js` — regression test (requires live db-server)
- `tools/check-ootb.js` — self-check: validates environment readiness

Runtime wiring: `modules/sdk/@sfmc-sdk/src/module-loader/`. To add a module:

1. Entry in `modules/catalog.json` (id, configKey, type, requires, entry)
2. `ModuleRegistry.register({ id, lifecycle: { registerPermissions, registerCommands, registerEvents, init, cleanup } })` in `modules/packages/<id>/sapi/src/index.ts`
3. `sfmc behavior-pack build && sfmc behavior-pack deploy` → restart BDS

## Configuration model (no hot-reload)

Plain JSON under `configs/` (defaults in `configs-default/` for SEA bundling). No SQLite for configs.

- db-server reads `configs/db_config.json` + `configs/qq_config.json` directly at startup
- SAPI calls `GET /api/sfmc/configs/all` once via `ConfigManager.init()`, caches in memory for process lifetime
- **Edit config → restart BDS.** No polling, no reload command, no hot-reload.
- Module toggle via Panel→`POST /api/sfmc/modules/:id/{enable|disable}` → db-server writes `module-lock.json` → SAPI calls `ConfigManager.refreshModules()`

Key config endpoints:

| Route | Fallback |
|-------|----------|
| `GET /api/sfmc/settings/{key}` | `bridge_channel_id` → `qq_config.json`, `land:*` → `land.json` |
| `GET /api/sfmc/{areas,permissions,banned_items,clean,grids,peace_filters,qa}` | matching JSON file |

`POST /api/sfmc/modules/:id/{enable|disable}` is the only runtime config write.

## Code conventions

- **Message display**: `Msg.info/success/error/warning/tips()` from `@sfmc/sdk/sapi/runtime` (adds `§f[*]`/`§a[√]`/`§c[x]`/`§e[!]`/`§7[!]` prefixes). **Never use `player.sendMessage()` directly.**
- **Form body**: `ListFormInfo(string[])` from `gui/` — first line gets `[*]` prefix, indented lines are plain
- **Button/Form titles**: No formatting codes (except `返回` for back buttons)
- **Money**: Scoreboard-based, unit from `Money.UNIT` (`节操`)
- **Commands**: `!<command>` syntax intercepted in `beforeEvents.chatSend`
- **Permissions**: `Permission.register(name, level)` at startup. Levels: Any=0, Member=1, OP=2, Admin=3
- **Module guard**: `Command.trigger` calls `moduleGuard` internally — disabled modules block their commands
- **db-server HTTP**: Via `HttpDB` class in `libs/HttpDB.ts`, targets `127.0.0.1:3001` (hardcoded, not configurable from SAPI)
- **db-server auth**: `http_auth` in `configs/db_config.json` → Bearer token on all non-GET/POST-module endpoints

## QQ Bridge (LLBot / OneBot 11)

File: `qq-bridge/index.js` (shim → `dist/index.js`). Source in `src/`, compile with `npm run build`.

- Only exposes WS on port 3002 (LLBot reverse-ws). No HTTP port.
- MC→QQ goes directly from db-server to LLBot HTTP (port 3004 by default).
- Config: `configs/qq_config.json` (keys: `qq_ws_port`, `qq_group_id`, `bridge_channel_id`, `llbot_host`/`port`/`token`, `mctoqq_prefix`)

### Message flow

```
QQ → MC: LLBot ─WS:3002──→ qq-bridge ─POST──→ db-server:3001/api/sfmc/messages
MC → QQ: db-server ─HTTP──→ LLBot:3004/send_group_msg
```

### Loop protection
1. **self_id filter**: drops messages where `sender.user_id === self_id`
2. **5 second dedup**: message_id short-term cache

### Start order
```list
1. db-server    (node db-server/index.js or db-server/dist/index.js)
2. qq-bridge    (node qq-bridge/index.js)
3. BDS
```

## Development tools

```bash
node tools/check-ootb.js        # validate environment readiness
node tools/smoke-modules.js     # module regression (needs live db-server)
node tools/sim-new-user.js      # test isolation (uses SFMC_ROOT)
node tools/lock.js rebuild      # rebuild modules/lock.json fingerprints
node tools/lock.js drift         # detect drifted files
```

## CI

`.github/workflows/ootb.yml` — on push/PR to `main`/`refactor/**`:

1. `npm install` at repo root
2. `node tools/check-ootb.js`
3. Spin up db-server, wait for `/api/health` 200, run `tools/smoke-modules.js`

`.github/workflows/release.yml` — on `v*` tags: builds SEA exe for win/linux/macos + publishes npm.

## Prettier

```json
{ "trailingComma": "es5", "tabWidth": 2, "semi": true, "singleQuote": false,
  "bracketSpacing": true, "arrowParens": "always", "printWidth": 120,
  "endOfLine": "crlf", "plugins": ["prettier-plugin-organize-imports"] }
```

## Gotchas

- **configs/** and **data/** are gitignored. See `configs-default/` for defaults.
- **`SFMC_ROOT`** env var: db-server reads `configs/` from this root. Used by `sim-new-user.js` for isolation testing.
- **`process.stdin.isTTY=false`** makes Ink-based TUI crash — `panel/` is gone, but sfmc CLI with `--no-tui` or `--cli` avoids stdin issues.
- **`endOfLine: "crlf"`** in prettier — Windows repo convention.
- **No test framework** in SAPI or db-server proper. db-server has `node --test` for `src/runtime.test.js` only.
