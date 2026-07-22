# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

npm workspaces monorepo (root `package.json` has `workspaces`):

| Path | What | Runtime |
|------|------|---------|
| `db-server/` | SQLite HTTP REST backend (plain `node:http` + `node:sqlite`) | Node.js >=22.13 |
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

Source of truth: `modules/catalog.json` (local mirror projected from installed packages) + `modules/module-lock.json` (enable state). Business modules live in `Tanya7z/sfmc-modules` and are installed via `tools/fetch-module.mjs`.

- `tools/fetch-module.mjs install|uninstall|search` — registry install; syncs catalog + lock
- `tools/catalog-sync.mjs` — scan `packages/*/sapi/manifest.json` → rewrite catalog
- `tools/check-modules.mjs` — validate catalog + v2 manifests (empty catalog OK)
- `tools/smoke-modules.mjs` — module API smoke (needs live db-server)
- `tools/check-ootb.mjs` — platform readiness self-check

Runtime wiring: `modules/sdk/@sfmc-sdk/src/module-loader/`. To add a module:

1. Publish in `Tanya7z/sfmc-modules` (or install with `fetch-module`)
2. `ModuleRegistry.register({ id, lifecycle: { ... } })` in `sapi/src/index.ts`
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
node tools/check-ootb.mjs       # validate environment readiness
node tools/catalog-sync.mjs     # project installed packages → catalog.json
node tools/check-modules.mjs    # validate catalog + v2 manifests
node tools/smoke-modules.mjs    # module regression (needs live db-server)
node tools/sim-new-user.mjs     # isolated SFMC_ROOT smoke
node tools/fetch-module.mjs install <id>
```

## CI

`.github/workflows/ootb.yml` — on push/PR to `main`/`refactor/**`:

1. `npm install` at repo root
2. `node tools/check-ootb.mjs`
3. Spin up db-server, wait for `/api/health` 200, run `tools/smoke-modules.mjs`

`.github/workflows/release.yml` — on `v*` tags: builds SEA exe for win/linux/macos + publishes npm.

## Prettier

```json
{ "trailingComma": "es5", "tabWidth": 2, "semi": true, "singleQuote": false,
  "bracketSpacing": true, "arrowParens": "always", "printWidth": 120,
  "endOfLine": "crlf", "plugins": ["prettier-plugin-organize-imports"] }
```

## Gotchas

- **configs/** and **data/** are gitignored. See `configs-default/` for defaults.
- **`SFMC_ROOT`** env var: db-server reads `configs/` from this root. Used by `sim-new-user.mjs` for isolation testing.
- **`process.stdin.isTTY=false`** makes Ink-based TUI crash — `panel/` is gone, but sfmc CLI with `--no-tui` or `--cli` avoids stdin issues.
- **`endOfLine: "crlf"`** in prettier — Windows repo convention.
- **No test framework** in SAPI or db-server proper. db-server has `node --test` for `src/runtime.test.js` only.

## Cursor Cloud specific instructions

The Cloud VM is Linux; the repo primarily targets Windows, but the Node services run fine on Linux (Node ≥22.13 provides unflagged `node:sqlite`; 22.5–22.12 require the `--experimental-sqlite` CLI flag or db-server crashes on startup with `ERR_UNKNOWN_BUILTIN_MODULE`). The update script only runs `npm install`. Everything below is required each session before running/verifying services.

- **Build before running.** `dist/` is gitignored for `@sfmc/sdk`, `db-server`, `bds-tools`, etc., and services run from `dist/`. Run `npm run build --workspaces --if-present` (builds the SDK first, then the services) after `npm install`. Without it, imports like `@sfmc/sdk/node/config` fail.
- **`configs/` is gitignored** — populate it once from `configs-default/` (`mkdir -p configs && cp -n configs-default/*.json configs/`). db-server also runs with defaults if `configs/` is absent.
- **Fixed — `modulesDir` in `configs-default/db_config.json`.** Used to ship as `"../modules"`, which resolved *relative to `PROJECT_ROOT` (= `SFMC_ROOT`, the repo root)* → `/modules` (outside the repo) → the module API returned an empty catalog. It now ships as `"modules"` so `configs/db_config.json` copied from the default is correct out of the box. When `configs/` is absent entirely, the fallback (`<root>/modules`) was already correct.
- **Run db-server (main service, port 3001):** `SFMC_ROOT=$PWD node db-server/dist/index.js`. Health: `GET http://127.0.0.1:3001/api/health`. The module/config REST surface is JSON-backed and is the CI-tested core path (`GET /api/sfmc/modules/catalog`, `POST /api/sfmc/modules/:id/{enable|disable}`).
- **`node:sqlite` needs Node ≥22.13, not just ≥22.5.** `db-server` imports `node:sqlite` at module scope. On 22.5.0–22.12.x the module is still gated behind `--experimental-sqlite`; importing it unflagged throws `ERR_UNKNOWN_BUILTIN_MODULE` and db-server exits immediately on startup. This is exactly what caused the `ootb` GitHub Actions workflow to fail repeatedly (`setup-node` was pinned to `node-version: '22.5'`, which resolves to `22.5.1`) — `check-ootb`'s "db-server 启动 + 模块接口" step timed out waiting for `/api/health`, and `sim-new-user`/`smoke-modules` cascaded into the same timeout. Fixed by pinning CI to `22.13`+.
- **Pre-existing bugs (not environment issues), fixed as of this note — kept here for history:**
  - `tools/check-catalog.js` used top-level ESM `import` syntax while the repo root `package.json` has no `"type": "module"` → `SyntaxError: Cannot use import statement outside a module` under plain `node`. Converted to CommonJS `require()` to match every other `tools/*.js` script.
  - `tools/check-ootb.js`, `tools/sim-new-user.js`, and `tools/test-db-api.js` spawned `db-server/index.js`, which does not exist — the real entry is `db-server/dist/index.js`. This made the `db-server 启动` and `sim-new-user` checks in `tools/check-ootb.js` time out, so a healthy env used to show **check-ootb 5/6 pass**; both are now fixed and should pass 6/6 given a built workspace + `--experimental-sqlite`-capable Node.
  - The SQLite-backed gameplay routes (`economy`, `lands`, `coops`, `scoreboards`, …) return `near "?": syntax error` because table names are interpolated through `sql-template-strings` (`FROM ${TABLE}` → `FROM ?`). The JSON-backed module/config API and `/api/health` work. This one is still open.
- **`npm run lint` is broken out-of-the-box** — ESLint v10 needs a flat `eslint.config.js` and none exists in the repo. Use per-workspace `npm run typecheck` for static checking instead.
