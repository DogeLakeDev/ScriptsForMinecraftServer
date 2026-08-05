# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

npm workspaces monorepo (root `package.json` has `workspaces`):

| Path | What | Runtime |
|------|------|---------|
| `packages/db-server/` | SQLite HTTP REST backend (plain `node:http` + `node:sqlite`) | Node.js >=22.13 |
| `packages/qq-bridge/` | QQ bridge (LLBot OneBot 11, WS 3002) | Node.js |
| `packages/bds-tools/` | BDS auto-updater + behavior-pack assembler | Node.js |
| `packages/cli/` | CLI management tool (REPL + supervisor), npm `@sfmc-bds/cli`; assembles SAPI BP at deploy time | Node.js |
| `packages/meta/` | `@sfmc-bds/sfmc` aggregate package | Node.js |
| `packages/remote-controller/` | Remote agent | Node.js |
| `packages/tools/` | Platform self-check / fetch / catalog scripts | Node.js |
| `packages/devkit/` | Author Watch / scaffold (`@sfmc-bds/devkit`) | Node.js |
| `packages/sfmc-extension/` | VS Code/Cursor extension「SFMC Module」 | — |
| `modules/packages/<id>/` | Business modules (unchanged); each one a first-class citizen | Node.js + SAPI |
| `modules/sdk/@sfmc-sdk/` | Shared SDK（含 `@sfmc-bds/sdk/logs`） | mixed |

**Layout note:** `packages/*` = platform packages; `modules/packages/*` = business modules. Do not confuse the two.

## Plugin entry & init order

The behavior pack is **assembled at deploy time** by `sfmc behavior-pack build` →
`packages/bds-tools` pack-manager `#assembleBehaviorPack`. The bundle entry walks every
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
sfmc behavior-pack build     # esbuild bundles modules/packages/<id>/sapi/src/index.ts → <ROOT>/packs/_build/sfmc-modules/
sfmc behavior-pack deploy    # copies packs/_build/sfmc-modules/ into <BDS>/worlds/<level>/behavior_packs/sfmc-modules/
```

Each module exports a `ModuleRegistry.register({ id, lifecycle })` call from its
`sapi/src/index.ts`. The build pipeline walks every enabled module's entry and
bundles them in one go. To make changes load, run `build && deploy` and restart BDS.

### Root monorepo commands (run from repo root)

```powershell
npm run start       # → packages/cli/dist/main.js (sfmc CLI)
npm run build       # npm run build --workspaces
npm run lint        # eslint . --ext .ts,.tsx
```

To build all workspaces: `npm run build`.

### db-server

```bash
cd packages/db-server
npm run dev          # tsx src/index.ts
npm run start        # node dist/index.js
npm run build        # tsc -p tsconfig.json
npm run test         # node --test src/*.test.js
DB_PORT=4000 npm run dev   # override port
```

Port defaults to 3001. Config: `configs/db_config.json` (`db_port` key). Auth via `http_auth` in same file or `HTTP_AUTH` env var.

### bds-tools (TypeScript)

```bash
cd packages/bds-tools
npm run build              # tsc → dist/
npm run update             # node dist/check-update.js
npm run update:check       # --check-only
npm run update:force       # --force (+ download + overwrite)
npm run rollback           # node recovery.js
npm run start|stop|status|watch  # bds-manager commands
```

### sfmc CLI

```bash
npm start                   # REPL (interactive) → packages/cli/dist/main.js
npm start -- status         # print status and exit
npm start -- start <svc>    # start a service
npm start -- stop <svc>     # stop a service
npm start -- restart <svc>  # restart a service
npm start -- init           # setup wizard
npm start -- update         # BDS update
# or: node packages/cli/dist/main.js <args>
```

Services managed by `SFMC_SERVICE` env: `db`, `qq`, `update`, `manager`.

## Module system

Source of truth: `modules/catalog.json` (local mirror projected from installed packages) + `modules/module-lock.json` (enable state). Business modules live in `Tanya7z/sfmc-modules` and are installed via `packages/tools/fetch-module.mjs`.

- `packages/tools/fetch-module.mjs install|uninstall|search` — registry install; syncs catalog + lock
- `packages/tools/catalog-sync.mjs` — scan `modules/packages/*/sapi/manifest.json` → rewrite catalog
- `packages/tools/check-modules.mjs` — validate catalog + v2 manifests (empty catalog OK)
- `packages/tools/smoke-modules.mjs` — module API smoke (needs live db-server)
- `packages/tools/check-ootb.mjs` — platform readiness self-check

Runtime wiring: `modules/sdk/@sfmc-sdk/src/module-loader/`. To add a module:

1. Publish in `Tanya7z/sfmc-modules` (or install with `fetch-module`)
2. `ModuleRegistry.register({ id, lifecycle: { ... } })` in `sapi/src/index.ts`
3. `sfmc behavior-pack build && sfmc behavior-pack deploy` → restart BDS

## Configuration model (no hot-reload)

Plain JSON under `configs/` (generated by each service on first ensure; JSON Schema under `@sfmc-bds/sdk/schemas`). No SQLite for configs.

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

- **Message display**: `Msg.info/success/error/warning/tips()` from `@sfmc-bds/sdk/sapi/runtime` (adds `§f[*]`/`§a[√]`/`§c[x]`/`§e[!]`/`§7[!]` prefixes). **Never use `player.sendMessage()` directly.**
- **Form body**: `ListFormInfo(string[])` from `gui/` — first line gets `[*]` prefix, indented lines are plain
- **Button/Form titles**: No formatting codes (except `返回` for back buttons)
- **Money**: Scoreboard-based, unit from `Money.UNIT` (`节操`)
- **Commands**: `!<command>` syntax intercepted in `beforeEvents.chatSend`
- **Permissions**: `Permission.register(name, level)` at startup. Levels: Any=0, Member=1, OP=2, Admin=3
- **Module guard**: `Command.trigger` calls `moduleGuard` internally — disabled modules block their commands
- **db-server HTTP**: Via `HttpDB` class in `libs/HttpDB.ts`, targets `127.0.0.1:3001` (hardcoded, not configurable from SAPI)
- **db-server auth**: `http_auth` in `configs/db_config.json` → Bearer token on all non-GET/POST-module endpoints

## QQ Bridge (LLBot / OneBot 11)

File: `packages/qq-bridge/index.js` (shim → `dist/index.js`). Source in `src/`, compile with `npm run build`.

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
1. db-server    (node packages/db-server/dist/index.js)
2. qq-bridge    (node packages/qq-bridge/index.js)
3. BDS
```

## Development tools

```bash
node packages/tools/check-ootb.mjs       # validate environment readiness
node packages/tools/catalog-sync.mjs     # project modules/packages → catalog.json
node packages/tools/check-modules.mjs    # validate catalog + v2 manifests
node packages/tools/smoke-modules.mjs    # module regression (needs live db-server)
node packages/tools/sim-new-user.mjs     # isolated SFMC_ROOT smoke
node packages/tools/fetch-module.mjs install <id>
```

## CI

`.github/workflows/ootb.yml` — on push/PR to `main`/`refactor/**`:

1. `npm install` at repo root
2. `node packages/tools/check-ootb.mjs`
3. Spin up db-server, wait for `/api/health` 200, run `packages/tools/smoke-modules.mjs`

`.github/workflows/changeset-release.yml` — on push to `main`: opens/updates Version Packages PR; merging it runs `npm run ci-release-packages` (publish + tag + GitHub Release; currently **beta** via pre mode).

Local: `npm run prerelease-packages` (pre/beta) or `npm run release-packages` (after `changeset pre exit`).

`.github/workflows/npm-publish.yml` — emergency `workflow_dispatch` single-package publish (default `--tag beta`). Do not publish `latest` while `.changeset/pre.json` is in pre mode.

**Shipping rule:** any PR that changes a publishable package's public API/behavior must include a changeset (`npx changeset`), or the Version PR will not bump that package.

## Prettier

```json
{ "trailingComma": "es5", "tabWidth": 2, "semi": true, "singleQuote": false,
  "bracketSpacing": true, "arrowParens": "always", "printWidth": 120,
  "endOfLine": "crlf", "plugins": ["prettier-plugin-organize-imports"] }
```

## Gotchas

- **configs/** and **data/** are gitignored. Missing config files are created by the owning service with built-in defaults (+ `$schema` for IDE).
- **`SFMC_ROOT`** env var: db-server reads `configs/` from this root. Used by `sim-new-user.mjs` for isolation testing.
- **JSON Schema**: see `modules/sdk/@sfmc-sdk/schemas/` and committed `.vscode/settings.json` `json.schemas` mappings.
- **`endOfLine: "crlf"`** in prettier — Windows repo convention。
- db-server 用 `node --test`；模块侧用 `@sfmc-bds/sdk/testing` + `node --test`。

## Cursor Cloud specific instructions

The Cloud VM is Linux; the repo primarily targets Windows, but the Node services run fine on Linux (Node ≥22.13 provides unflagged `node:sqlite`; 22.5–22.12 require the `--experimental-sqlite` CLI flag or db-server crashes on startup with `ERR_UNKNOWN_BUILTIN_MODULE`). The update script only runs `npm install`. Everything below is required each session before running/verifying services.

- **Build before running.** `dist/` is gitignored for `@sfmc-bds/sdk`, `packages/db-server`, `packages/bds-tools`, etc., and services run from `dist/`. Run `npm run build --workspaces --if-present` (builds the SDK first, then the services) after `npm install`. Without it, imports like `@sfmc-bds/sdk/node/config` fail.
- **`configs/` is gitignored** — first start of db-server / sfmc CLI / bds-tools writes missing JSON with built-in defaults. No `configs-default/` tree.
- **`modulesDir` default is `"modules"`** (relative to `SFMC_ROOT`).
- **Run db-server (main service, port 3001):** `SFMC_ROOT=$PWD node packages/db-server/dist/index.js`. Health: `GET http://127.0.0.1:3001/api/health`. The module/config REST surface is JSON-backed and is the CI-tested core path (`GET /api/sfmc/modules/catalog`, `POST /api/sfmc/modules/:id/{enable|disable}`).
- **`node:sqlite` needs Node ≥22.13, not just ≥22.5.** `db-server` imports `node:sqlite` at module scope. On 22.5.0–22.12.x the module is still gated behind `--experimental-sqlite`; importing it unflagged throws `ERR_UNKNOWN_BUILTIN_MODULE` and db-server exits immediately on startup. This is exactly what caused the `ootb` GitHub Actions workflow to fail repeatedly (`setup-node` was pinned to `node-version: '22.5'`, which resolves to `22.5.1`) — `check-ootb`'s "db-server 启动 + 模块接口" step timed out waiting for `/api/health`, and `sim-new-user`/`smoke-modules` cascaded into the same timeout. Fixed by pinning CI to `22.13`+.
- **SQLite 标识符**：表名等可信标识用 `sql()` / `.append(raw(...))` 嵌入，勿 `SQL\`…${table}…\``。
- **lint**：根目录有 `eslint.config.js`；先 `npm run build --workspace @sfmc-bds/eslint-plugin`，再 `npm run lint`。静态检查也可用各 workspace 的 `npm run typecheck`。
