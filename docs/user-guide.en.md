# ScriptsForMinecraftServer User Guide

> End-to-end walkthrough from a fresh BDS install to daily ops. After reading this you can:
> 1. Set up the environment (Node 18+ / Node 22.5+ / Windows Loopback Exemption)
> 2. Initialize configs (`db_config.json` / `qq_config.json` / BP `.env`)
> 3. Start all five top-level services (db-server / qq-bridge / bds-tools / sfmc / BP)
> 4. Enable / disable modules in BDS
> 5. Back up, upgrade, and recover

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Minecraft Bedrock Dedicated Server (BDS)               │
│  └─ behavior_packs/ScriptsForMinecraftServer/scripts    │
│     main.js (esbuild artifact, 341KB)                   │
└──────────┬───────────────────────────────────────────────┘
           │ HTTP @ 127.0.0.1:3001
           ▼
┌─────────────────────────────────────────────────────────┐
│  db-server (Node 22.5+)                                 │
│  └─ SQLite @ ./data/sfmc_data.db                        │
│     REST API /api/sfmc/*                                │
│     manifest loader @ modules/_manifests/...json        │
└──────────┬─────────────────────────┬────────────────────┘
           │ WS @ 127.0.0.1:3002     │
           ▼                         │
┌────────────────────┐                │
│  qq-bridge         │                │
│  └─ LLBot OneBot 11│                │
│     inbound WS:3002│                │
└────────────────────┘                │
                                      │
┌──────────────────────────────────────┴──────────────────┐
│  sfmc-cil (REPL)                                        │
│  └─ db / qq / llbot / bds service lifecycle             │
│     manifest reader / module toggles / remote agent     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  bds-tools (BDS auto-update + process manager)           │
│  └─ check-update.js / bds-manager.js                    │
└─────────────────────────────────────────────────────────┘
```

**Port reference:**
- `3001` — db-server REST API (BP / sfmc / qq-bridge all hit this)
- `3002` — qq-bridge inbound WebSocket from LLBot OneBot 11
- `3003` — (legacy reserved, currently **unused**; MC→QQ goes directly from db-server to LLBot:3004)

## 2. Requirements

| Component | Required |
|-----------|----------|
| Node.js | 18.x (SAPI bundle) + 22.5+ (db-server) |
| OS | Windows 10/11 (primary), Linux/macOS also supported |
| BDS | Bedrock Dedicated Server 1.26.x (tested with preview.30) |
| Disk | ~500MB (BP + services + node_modules) |

**Install Node**: grab 22.5+ LTS from [nodejs.org](https://nodejs.org/). Then verify:

```bash
node -v    # should print v22.x.x
npm -v
```

**Windows Loopback Exemption** (required for BDS ↔ local Node communication):

```powershell
# PowerShell as Administrator
cd scriptsforminecraftserver
npm run enablemcloopback
npm run enablemcpreviewloopback
```

## 3. Initialize the repo

```bash
git clone <repo-url> ScriptsForMinecraftServer
cd ScriptsForMinecraftServer
npm install
```

`npm install` triggers workspace linking and installs all top-level services + the SDK. Verify:

```bash
node tools/check-ootb.js
```

Expected output:
```
[check-ootb] OK: <N> checks passed
```

Missing Node version will fail immediately.

## 4. First-time configuration

### 4.1 Run the sfmc wizard (recommended)

```bash
node sfmc/dist/main.js
```

sfmc detects missing `configs/db_config.json` and runs the wizard, prompting for:
- db-server port (default 3001)
- db-server data directory (default `./data`)
- modules directory (default `./modules`)
- LLBot controller URL (optional, if you need the QQ bridge)

The wizard writes `configs/db_config.json` with content like:

```json
{
  "db_port": 3001,
  "http_auth": "",
  "dbDir": "./data/sfmc_data.db",
  "modulesDir": "./modules"
}
```

> After exiting the wizard, sfmc enters REPL mode — type `help` for available commands.

### 4.2 BP .env setup

```bash
cd scriptsforminecraftserver
cp .env.example .env   # if a template exists
```

`.env` must contain:

```
PROJECT_NAME=ScriptsForMinecraftServer
CUSTOM_DEPLOYMENT_PATH=C:/path/to/BDS/behavior_packs
```

`CUSTOM_DEPLOYMENT_PATH` points to BDS's `behavior_packs/` directory. **Forward or back slashes both work**; the script normalizes them.

### 4.3 Default configs

`configs-default/` ships 7 JSON templates:
- `db_config.json` — db-server port
- `banned_items.json` — items banned in creative areas
- `areas.json` — fly/creative/peace area definitions
- `land.json` — land system defaults
- `permissions.json` — permission node default mappings
- `daily_task.json` — daily task whitelist
- `tps.json` — TPS monitoring thresholds

At startup, db-server reads `configs/<name>.json`, falling back to `configs-default/<name>.json`. **For first use, copy them over:**

```bash
cp -r configs-default/* configs/
```

## 5. Start the five services

### 5.1 db-server

```bash
cd db-server
npm run dev    # tsx live-reload; or `npm run build && npm start` for production
```

Expected log:
```
[manifest] loaded schemaVersion=1 modules=22 routes=34
[initSchema] created 12 tables
HTTP server up on port 3001 (loopback only)
Health check: http://127.0.0.1:3001/api/health
```

Health check:
```bash
curl http://127.0.0.1:3001/api/health
# {"ok": true}
```

### 5.2 qq-bridge (optional, only if you need QQ)

```bash
cd qq-bridge
npm run dev
```

Expected log:
```
[qq-bridge] WS server listening on 127.0.0.1:3002
[qq-bridge] waiting for LLBot connection...
```

In LLBot, configure the reverse-WS target as `ws://127.0.0.1:3002`. qq-bridge then receives QQ group messages.

### 5.3 sfmc REPL

```bash
node sfmc/dist/main.js
```

REPL commands:

| Command | Action |
|---------|--------|
| `status` | Show all service statuses |
| `start db` / `stop db` | Start/stop db-server |
| `start qq` / `stop qq` | Start/stop qq-bridge |
| `start llbot` / `stop llbot` | Start/stop LLBot |
| `start -all` / `stop -all` | Start/stop everything |
| `restart <svc>` | Restart a single service |
| `logs [N]` | Show last N log lines |
| `update` | Check BDS updates via bds-tools |
| `init` | Re-run the init wizard |
| `remote enroll <url> <token> [name]` | Enroll a remote control agent |
| `help` | Full command list |
| `Ctrl+C` | Exit REPL (child services keep running) |

### 5.4 Deploy the behavior pack

```bash
cd scriptsforminecraftserver
npm run build:full    # clean → bundle → copy → emit-manifest
npm run build:deploy  # build + auto-copy to .env-configured BDS path
```

`build:deploy` is `build + deploy`. BDS picks up behavior_pack changes on next world reload.

### 5.5 Start BDS

Start your BDS server normally. On first boot you should see in console:

```
[manifest] loaded schemaVersion=1 modules=22 routes=34
[SYS] 22 modules loaded
```

In-game, `/menu` opens the main menu; `/admin` opens the admin panel.

## 6. Daily operations

### 6.1 Enable / disable modules

Two ways:

**Way 1 — sfmc REPL** (no BDS restart):
```
sfmc> modules list              # all modules + enabled state
sfmc> modules enable feature-economy
sfmc> modules disable feature-chat-sounds
sfmc> modules refresh           # push to db-server and SAPI
```

**Way 2 — Edit `modules/module-lock.json`**:
```json
{
  "modules": {
    "feature-economy":    { "enabled": true,  "updatedAt": 1721548800000 },
    "feature-chat-sounds":{ "enabled": false, "updatedAt": 1721548800000 }
  }
}
```
Save and **restart BDS** to take effect (no hot reload).

### 6.2 Edit configs

`configs/*.json` changes **require BDS restart**. Common configs:

| File | Effect |
|------|--------|
| `configs/db_config.json` | db-server restart required |
| `configs/areas.json` | Area modules re-read on next BDS start (fly/creative/peace) |
| `configs/land.json` | Land defaults apply to new lands |
| `configs/permissions.json` | Permission node bindings |
| `configs/banned_items.json` | Creative area placement restrictions |

Validate after changes:
```bash
node tools/check-catalog.js   # catalog + modules self-check
```

### 6.3 Logs

**BDS console**: `debug.i/w/e` outputs there, prefixed with `[MODULE_TAG]`.

**db-server**: `./data/sfmc.db-server.log` (path configurable) + stdout.

**sfmc REPL**: `logs 100` shows last 100 lines.

**qq-bridge**: same channel via sfmc `logs`.

### 6.4 Module status query

```bash
curl http://127.0.0.1:3001/api/sfmc/modules
# returns 22 rows: {id, enabled, canDisable, ...}
```

## 7. Backup and restore

### 7.1 Data backup

```bash
# Stop db-server (ensures SQLite consistency)
node sfmc/dist/main.js
sfmc> stop db

# Archive the entire data/ directory
tar -czf backup-$(date +%Y%m%d).tar.gz data/ configs/

sfmc> start db
```

> Don't copy SQLite files while db-server is running — under WAL mode the file may be inconsistent.

### 7.2 Module-state backup

`modules/catalog.json` and `modules/module-lock.json` are the source of truth. Recommended:

```bash
cp modules/catalog.json modules/catalog.json.bak
cp modules/module-lock.json modules/module-lock.json.bak
```

Also back up `configs/*.json`.

### 7.3 BP redeploy

After source changes:
```bash
cd scriptsforminecraftserver
npm run build:deploy    # build + copy to .env-configured path
# Then reload the BP in BDS console, or `restart bds` in sfmc
```

## 8. Upgrade

### 8.1 BP upgrade

```bash
cd scriptsforminecraftserver
git pull   # or `npm update`
npm run build:deploy
# Restart BDS
```

### 8.2 db-server upgrade

```bash
cd db-server
git pull
npm install
npm run build
# Stop old instance → start new
node sfmc/dist/main.js
sfmc> stop db
sfmc> start db
```

db-server runs `initSchema` incremental migration automatically; old SQLite files are preserved.

### 8.3 bds-tools — upgrade BDS

```bash
node bds-tools/dist/check-update.js          # check + install
node bds-tools/dist/check-update.js --check-only   # check only, no install
node bds-tools/dist/check-update.js --force        # force install
```

sfmc's `update` command wraps the above.

## 9. Recovery

### 9.1 BP errors after BDS start

1. Read BDS log, locate the first `[E]` line
2. `cd scriptsforminecraftserver && npm run tsc` for type errors
3. `node tools/check-catalog.js` for catalog consistency
4. `node tools/emit-manifest.mjs` to regenerate manifest
5. `npm run build:deploy` to redeploy

### 9.2 db-server won't start

```bash
cd db-server
cat .sfmc.db-server.log | tail -50
```

Common causes:
- Port 3001 in use → change `db_port` in `configs/db_config.json`
- SQLite corruption → try `sqlite3 data/sfmc_data.db ".recover"` to rescue
- Manifest missing → `cd scriptsforminecraftserver && npm run build:full`

### 9.3 qq-bridge can't connect to LLBot

1. Is LLBot's reverse-WS target `ws://127.0.0.1:3002`?
2. Does qq-bridge stdout show `[qq-bridge] LLBot connected`?
3. Is firewall blocking port 3002?

### 9.4 Module enabled but SAPI doesn't respond

1. `curl http://127.0.0.1:3001/api/sfmc/modules/<id>` — check `enabled`
2. Search BDS log for `[MODULE_ID]` for init errors
3. Quick recovery: set `enabled: false` in `modules/module-lock.json` and restart BDS

## 10. Common utility scripts

| Command | Purpose |
|---------|---------|
| `node tools/check-catalog.js` | Validate catalog + module path integrity |
| `node tools/check-ootb.js` | Self-check Node version / required files |
| `node tools/emit-manifest.mjs` | Regenerate `modules/_manifests/module-manifests.json` |
| `node tools/smoke-modules.js` | Module system end-to-end smoke test (requires live db-server) |
| `node tools/test-db-api.js` | Hit db-server API directly for testing |
| `node tools/sim-new-user.js` | Simulate a first-time user flow |

---

**Path reference:**
- BP deploy path: `<CUSTOM_DEPLOYMENT_PATH>/ScriptsForMinecraftServer`
- Behavior pack entry: `scriptsforminecraftserver/dist/scripts/main.js`
- db-server config: `configs/db_config.json`
- db-server data: `data/sfmc_data.db`
- Module source of truth: `modules/catalog.json` + `modules/module-lock.json`
- Module contract: `modules/_manifests/module-manifests.json`

Next: to write or modify a module, see [module-author.en.md](./module-author.en.md); to look up SDK APIs, see [sdk-reference.en.md](./sdk-reference.en.md).