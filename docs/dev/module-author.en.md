# SAPI Module Author Guide

> For developers writing new modules in the [Shiroha7z/sfmc-modules](https://github.com/Shiroha7z/sfmc-modules) repo. This guide uses `feature-land` and `feature-land-gui` as references to demonstrate the full v2-protocol module lifecycle. All new modules follow the same conventions.

## 1. Module location

Modules **no longer live in the main repo** under `modules/packages/`. They live in a separate repo:

```
sfmc-modules/
├── packages/
│   ├── <id>/
│   │   ├── package.json              ← @sfmc/module-<id>, depends on @sfmc/sdk
│   │   ├── sapi/
│   │   │   ├── manifest.json         ← v2 protocol contract
│   │   │   ├── tsconfig.json
│   │   │   └── src/
│   │   │       ├── index.ts          ← ModuleRegistry.register entry
│   │   │       └── ...business source files
│   │   ├── configs-default/          ← (optional) default config
│   │   └── resource_pack/            ← (optional) resource pack contents
│   └── ...
├── index.json                        ← first-party registry (read by fetch-module)
├── tools/
│   ├── check-modules.js              ← v2 manifest sanity
│   ├── sync-index.js                 ← auto-sync index.json
│   └── new.sh                        ← new-module scaffold
```

**Hard constraints:**

- `id` must be unique inside sfmc-modules. Recommended prefixes: `core-` / `feature-`
- `package.json#name` MUST be `@sfmc/module-<id>` and match the manifest `id`
- The module is invoked **only** at BP startup time, by the esbuild-bundled `scripts/main.js`, via `ModuleRegistry.register(...)`
- Modules MUST only depend on `@sfmc/sdk` and `@minecraft/server`. **No cross-module source imports.**

## 2. Creating a new module

The fastest path is the scaffold:

```bash
cd sfmc-modules
./tools/new.sh feature-my-thing "My new module"
# Produces:
#   packages/feature-my-thing/package.json
#   packages/feature-my-thing/sapi/manifest.json
#   packages/feature-my-thing/sapi/src/index.ts
#   packages/feature-my-thing/sapi/tsconfig.json
#   packages/feature-my-thing/configs-default/config.json
#   index.json (auto-synced)
```

The scaffold fills in the v2 manifest skeleton; you complete `permissions` and `services` in `manifest.json`, then write the actual business in `src/index.ts`.

### Manual

If you already have a template, the minimum skeleton is:

```jsonc
// packages/<id>/package.json
{
  "name": "@sfmc/module-<id>",
  "version": "0.1.0",
  "type": "module",
  "main": "sapi/src/index.ts",
  "private": true,
  "dependencies": { "@sfmc/sdk": "^0.1.0" },
  "peerDependencies": { "@minecraft/server": "2.10.0-beta.1.26.40-preview.30" }
}
```

```json
// packages/<id>/sapi/manifest.json
{
  "schemaVersion": 2,
  "id": "<id>",
  "name": "My module",
  "type": "feature",
  "configKey": "<config_key>",
  "requires": [],
  "permissions": [
    "db:read:<table>",
    "db:write:<table>",
    "config:read:<config_key>",
    "config:write:<config_key>"
  ],
  "services": { "provides": [], "requires": [] },
  "notes": ""
}
```

```ts
// packages/<id>/sapi/src/index.ts
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "<id>",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("<config_key>.use", Permission.Any);
    },
    async init() {
      // db.defineTable / db.tx / service.get ...
    },
    cleanup() {},
  },
});
```

## 3. manifest v2 fields

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `schemaVersion` | `2` | ✓ | Protocol version. Other values cause startup throw or warn-skip |
| `id` | string | ✓ | Unique module id |
| `name` | string | ✓ | Display name |
| `type` | `"core"` \| `"feature"` | ✓ | `core` = canDisable=false, `feature` = canDisable=true |
| `configKey` | string | ✓ | Maps to `configs/<config_key>.json` |
| `requires` | string[] | ✓ | Dependency module ids (topological sort) |
| `permissions` | string[] | ✓ | Platform permission declarations (see below) |
| `services.provides` | ServiceEntry[] | ✓ | Capabilities this module exposes |
| `services.requires` | ServiceEntry[] | ✓ | Capabilities this module depends on |
| `notes` | string | – | Free text |

**Permission strings:**

| Pattern | Meaning |
|---------|---------|
| `db:read:<table>` | Read module-declared table |
| `db:write:<table>` | Write module-declared table |
| `db:read:*` / `db:write:*` | Wildcard (use sparingly; startup whitelist required) |
| `config:read:<key>` | Read config under `configKey` namespace |
| `config:write:<key>` | Write config under `configKey` namespace |
| `service:<service_name>` | Declare you invoke this service (optional but recommended; startup validates) |

**ServiceEntry:**

```jsonc
{
  "name": "land.byOwner",
  "input":  { "type": "object", "properties": { "ownerId": { "type": "string" } }, "required": ["ownerId"] },
  "output": { "type": "array" }
}
```

`provides` names are globally unique; `requires` must resolve to some module's `provides` (validated at startup).

**Forbidden fields**: `routes`, `tables`, `migrations`, `seeds`, `handlers`, `events`. v1 leftovers — startup throws if present.

## 4. SDK four drawers

90% of module code only imports these four subpaths:

| Subpath | Use |
|---------|-----|
| `@sfmc/sdk/sapi/runtime` | `Msg`, `Command`, `Permission`, `MenuNavigator`, `Money`, `debug`, `HttpDB` (legacy; new code should not use), `FormStatus` |
| `@sfmc/sdk/sapi/db` | `db.defineTable`, `db.tx`, `db.query`, `db.get`, `db.insert`, `db.update`, `db.delete`, `db.audit`, `db.idempotent` |
| `@sfmc/sdk/sapi/config` | `config.get`, `config.set`, `config.onChange` |
| `@sfmc/sdk/sapi/service` | `service.get`, `service.list` (cross-module) |
| `@sfmc/sdk/module-loader` | `ModuleRegistry.register` (only this one symbol for business modules) |
| `@sfmc/sdk/contracts` | Cross-module shared types (use platform contracts; don't reinvent) |

**Rules:**
- **No** `require("fs")`, raw `fetch()`, direct db-server port access. SDK only.
- **No** raw SQL strings. Only `WhereExpr` expression trees.
- **No** source imports across modules. Cross-module calls go through `service.get(...)`.

## 5. End-to-end example (using land)

`land` provides 13 services; `land-gui` is one consumer:

```ts
// modules/packages/land/sapi/src/land-transfer.ts
import { db, type TxContext, DbError } from "@sfmc/sdk/sapi/db";

export async function transferLand(input: { landId: string; currentOwnerId: string; newOwnerId: string }) {
  return db.tx(async (tx: TxContext) => {
    await tx.update("lands", input.landId, { owner_player_id: input.newOwnerId, version: 2 });
    await tx.audit("lands", input.landId, "transfer", { from: input.currentOwnerId, to: input.newOwnerId });
    await tx.call("economy.debit", { playerId: input.currentOwnerId, amount: 100 });
    await tx.call("economy.credit", { playerId: input.newOwnerId, amount: 100 });
    return { ok: true };
  });
}
```

```ts
// modules/packages/land-gui/sapi/src/index.ts
import { service } from "@sfmc/sdk/sapi/service";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

ModuleRegistry.register({
  id: "feature-land-gui",
  afterWorldLoad: false,
  lifecycle: {
    async init() {
      const land = await service.get<{ id: string; name: string } | null>("land.byId", { landId: "abc" });
      // render GUI
    },
  },
});
```

`land-gui/sapi/manifest.json` MUST declare `requires: ["feature-land"]` and `services.requires: [{ name: "land.byId" }]` — startup validates, missing declarations cause throw.

## 6. Local development

```bash
# 1) Clone both repos side by side
# D:/#WorkPlace/
# ├── ScriptsForMinecraftServer/   (main repo)
# └── sfmc-modules/                 (modules repo)

cd sfmc-modules
cd packages/land
npm link ../../ScriptsForMinecraftServer/modules/sdk/@sfmc-sdk
# Now `import "@sfmc/sdk/sapi/db"` resolves to the local SDK source.

# 2) Typecheck
cd packages/land
npm run typecheck

# 3) Symlink the module into main repo so esbuild picks it up
cd ../../ScriptsForMinecraftServer
mkdir -p modules/packages
ln -s ../../sfmc-modules/packages/land modules/packages/land

# 4) BP build + db-server
sfmc behavior-pack build
sfmc behavior-pack deploy
```

## 7. Releasing

sfmc-modules uses GitHub Releases for module tarballs:

```bash
# Inside sfmc-modules
git tag -a v1.2.3   # tag the whole repo (one tag for all modules)
git push origin v1.2.3
# CI runs tools/check-modules.js + packs each packages/* → uploads to GitHub Release
```

After release, users install via:

```bash
node tools/fetch-module.mjs install <id>   # resolves GitHub Release URL + downloads tarball
```

## 8. Debugging tips

- Startup log `[manifest v2] loaded N modules; provides M services`: N = your v2 manifests, M = total provides
- If your module is warn-skipped: `[manifest] <id>: moduleId=... schemaVersion=... (需要 2),跳过`
- `service.get` 403: missing `services.requires` declaration or `permissions` lacks `service:xxx`
- `db-server` startup fails with `table X already registered by another module`: two modules declared the same table name — coordinate with platform
- esbuild `Could not resolve "@sfmc/module-X"`: `package.json#name` doesn't match directory name or id
- BP build succeeds but BDS startup reports `module X not found in catalog`: main-repo `modules/catalog.json` is missing your module entry, or `entry.path` is wrong

## 9. Commit convention

```
<type>(<scope>): <subject>

<body — explain why, not what>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

`<type>`:
- `feat(<id>):` — new feature
- `fix(<id>):` — bug fix
- `refactor(<id>):` — refactor (no behavior change)
- `docs(<id>):` — docs only
- `chore(<id>):` — tooling / build / CI

## 10. Common errors

| Symptom | Cause |
|---------|-------|
| `moduleId=... schemaVersion=... (需要 2),跳过` | Manifest has `schemaVersion: 1` or missing |
| `service.get("xxx")` returns 403 | Missing `services.requires` declaration or `permissions` lacks `service:xxx` |
| `db.defineTable` then startup fails with `table X already registered by another module` | Two modules declared the same table name |
| esbuild `Could not resolve "@sfmc/module-X"` | `package.json#name` doesn't match directory / id |
| BP build OK but BDS says `module X not found in catalog` | Main-repo `modules/catalog.json` missing your entry, or `entry.path` is wrong |

---

Next: see [SDK API reference](./sdk-reference.en.md) or [manifest contract details](./manifest-contract.en.md).