# SAPI Module Author Guide

> For developers writing new modules under `modules/packages/<id>/sapi/`. This guide uses `feature-economy` as a reference, but every convention applies to new modules and refactors alike.

## 1. Module location

```
modules/
  catalog.json                       ← registry (must add one row)
  module-lock.json                   ← runtime enabled/disabled state, written by db-server
  packages/
    <id>/
      package.json                   ← npm workspace
      sapi/
        manifest.json                ← module contract — see docs/dev/manifest-contract.en.md
        src/
          index.ts                   ← entry point, exports lifecycle classes / functions
          ...other source files
      resource_pack/                 ← (optional) resource pack contents, merged at build time
```

**Hard constraints:**
- `id` must be unique inside `modules/catalog.json`, lowercase kebab-case
- `entry.path` is fixed: `modules/packages/<id>/sapi/src/index.ts`
- The module is only invoked by `scriptsforminecraftserver/scripts/entry.ts` via `ModuleRegistry.register(...)` during BP startup. Never put side effects at module top-level — everything goes inside lifecycle callbacks.

## 2. Module contract — what you need to export

`ModuleRegistry` from `@sfmc/sdk/module-loader` expects a lifecycle object. **Every field is optional:**

```ts
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { Player } from "@minecraft/server";

export class MyModule {
  // Command registration. Called once during startup.
  static registerCommands(): void {
    Permission.register("mymodule.use", Permission.Member);
    Command.register(
      "mycommand",        // command literal
      "mymodule.use",     // permission node
      (player?: Player) => { /* ... */ },
      "My command",       // help text
      "category"          // optional category (groups entries in main menu)
    );
  }

  // Event subscriptions. Called once during worldLoad.
  static registerEvents(): void {
    // Subscribe to world.afterEvents.* / world.beforeEvents.*
  }

  // Last call in startup. Synchronous.
  static init(): void {
    debug.i("MYMOD", "init");
  }

  // Called during worldLoad (for modules with afterWorldLoad=true).
  static initAfterWorldLoad(): void {
    debug.i("MYMOD", "initAfterWorldLoad");
  }

  // Called on shutdown. Unsubscribe + release timers.
  static cleanup(): void {
    // ...
  }
}
```

> entry.ts template:
> ```ts
> ModuleRegistry.register({
>   id: "mymodule",
>   afterWorldLoad: true,
>   lifecycle: {
>     registerCommands: () => MyModule.registerCommands(),
>     registerEvents: () => MyModule.registerEvents(),
>     init: () => MyModule.init(),
>     initAfterWorldLoad: () => MyModule.initAfterWorldLoad(),
>     cleanup: () => MyModule.cleanup(),
>   },
> });
> ```
>
> `registerCommands` runs during the startup phase (inside `system.beforeEvents.startup`). `init` also runs at startup, but after commands. `registerEvents` and `initAfterWorldLoad` both fire during `world.afterEvents.worldLoad`.

## 3. Three SDK drawers

| Drawer | Subpath | Use for |
|--------|---------|---------|
| **runtime** | `@sfmc/sdk/sapi/runtime` | Utilities: `Command`, `Permission`, `Msg`, `debug`, `MenuNavigator`, `Money`, `HttpDB`, `FormStatus`, `Observable*` etc. |
| **host** | `@sfmc/sdk/sapi/host` | Platform-layer adapters. Regular modules rarely import directly |
| **sdk** | `@sfmc/sdk/sapi/sdk` | Module contract types (`SapiHostApis`, `defineSapiModule`, placeholders). Currently a stub — populated in future commits |
| **contracts** | `@sfmc/sdk/contracts` | Shared types across SAPI and db-server (`LandData`, `CoopData`, `Channel`, etc.) |
| **module-loader** | `@sfmc/sdk/module-loader` | BP entry only (`ConfigManager`, `ModuleRegistry`, `announceLoaded`, `guardEvent`). **Only `scripts/entry.ts` imports this** — business modules must not |

**Practical advice:**
- 90% of module code only imports `@sfmc/sdk/sapi/runtime`
- Shared types come from `@sfmc/sdk/contracts`
- For HTTP calls to db-server, use `HttpDB.get / post / requestJSON` — never raw `fetch`

## 4. manifest.json fields

```json
{
  "handlers": [],
  "routes": [
    { "method": "GET", "path": "/api/sfmc/lands", "handler": "lands:list" }
  ],
  "migrations": []
}
```

| Field | Meaning |
|-------|---------|
| `handlers` | Empty at Stage I. db-server's handler-registry will consult this in later stages |
| `routes` | Every route your module calls into db-server. `method` + `path` + `handler` name |
| `migrations` | db-server migrations your module needs (ordered by version). Empty means no schema change |
| `notes` (optional) | Free-form commentary |

> **Required even if empty.** Even modules that never call db-server must ship a manifest with `{ "handlers": [], "routes": [], "migrations": [] }`, otherwise emit-manifest won't list the module.
> Full reference: [manifest-contract.en.md](./manifest-contract.en.md)

## 5. Adding a row to catalog.json

```json
{
  "id": "feature-mymodule",
  "configKey": "mymodule",
  "name": "My Module",
  "type": "feature",
  "description": "One-line description",
  "enabledByDefault": false,
  "canDisable": true,
  "requires": [],
  "entry": { "kind": "sapi", "path": "modules/packages/mymodule/sapi/src/index.ts" }
}
```

Field reference:
- `id` — unique across the repo. Prefix with `core-` (always-on core) or `feature-` (opt-in)
- `configKey` — the key inside `configs/<key>.json`, looked up via `ConfigManager.getConfigs("<key>")`
- `enabledByDefault` — whether to enable on first launch
- `requires` — `id`s this module depends on (topological order)
- `entry.path` — fixed prefix `modules/packages/...`

> `node tools/check-catalog.js` validates uniqueness, entry path existence, and that entry.ts has the matching `ModuleRegistry.register` call. If it complains `expected id "mymodule" 未在 entry.ts 注册 ModuleRegistry 生命周期`, you forgot to add the `ModuleRegistry.register(...)` call in entry.ts.

## 6. package.json

```json
{
  "name": "@sfmc/module-mymodule",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "sapi/src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  },
  "dependencies": {
    "@sfmc/sdk": "*"
  }
}
```

`name` **must** be `@sfmc/module-<id>` (matching the catalog id), otherwise `entry.ts`'s `import { ... } from "@sfmc/module-<id>"` will fail to resolve.

## 7. tsconfig.json

Reuse a sibling module's:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./sapi/src",
    "outDir": "./dist",
    "types": ["@minecraft/server"]
  },
  "include": ["sapi/src/**/*"]
}
```

## 8. Debug loop

```bash
# 1) Type-check just this module
cd modules/packages/mymodule
npm run typecheck

# 2) Full BP build
cd ../../scriptsforminecraftserver
npm run build:full    # clean → bundle → copy → emit-manifest

# 3) Start db-server (verify manifest loads)
cd ../../db-server
npm run dev

# 4) Check startup log
# [manifest] loaded schemaVersion=1 modules=22 routes=34
# If your manifest declares a route db-server doesn't cover, you'll see:
# [manifest] WARN feature-mymodule: route POST /api/sfmc/foo is not covered by db-server
```

## 9. Commit conventions

```
<type>(scope): <subject>

<body — explain why, not what>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

`<type>` values:
- `feat(<id>):` — new module or new feature
- `fix(<id>):` — bug fix
- `refactor(<id>):` — behavior-preserving refactor
- `docs(<id>):` — docs only
- `chore(<id>):` — tooling / build / formatting

## 10. Common errors

| Symptom | Cause |
|---------|-------|
| `npm run bundle` fails with `Could not resolve "@sfmc/module-mymodule"` | Catalog `entry.path` and `package.json#name` mismatch, or `npm install` was skipped |
| Module doesn't activate after boot | `ModuleRegistry.register` missing, or `id` typo |
| Module missing from startup log | manifest.json absent, or field names wrong (must be `handlers` / `routes` / `migrations`) |
| `Cannot find name 'ConfigManager'` in TS | Wrong drawer. `ConfigManager` lives in `@sfmc/sdk/module-loader`, not runtime |
| Commands don't respond | Likely blocked by `moduleGuard` — check `modules/module-lock.json`'s `enabled` field |

## 11. End-to-end skeleton

Minimal working new-module layout:

```
modules/packages/hello/
├── package.json
├── tsconfig.json
└── sapi/
    ├── manifest.json
    └── src/
        └── index.ts
```

`modules/packages/hello/package.json`:
```json
{
  "name": "@sfmc/module-hello",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "sapi/src/index.ts",
  "peerDependencies": { "@minecraft/server": "2.10.0-beta.1.26.40-preview.30" },
  "dependencies": { "@sfmc/sdk": "*" }
}
```

`modules/packages/hello/sapi/manifest.json`:
```json
{ "handlers": [], "routes": [], "migrations": [] }
```

`modules/packages/hello/sapi/src/index.ts`:
```ts
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { Player } from "@minecraft/server";

export class Hello {
  static registerCommands(): void {
    Permission.register("hello.use", Permission.Member);
    Command.register(
      "hello",
      "hello.use",
      (player?: Player) => { if (player) Msg.info(`Hello, ${player.name}!`, player); },
      "Greet a player"
    );
  }

  static init(): void { debug.i("HELLO", "init"); }
}
```

Then: add a row to `modules/catalog.json`, add `ModuleRegistry.register({ id: "hello", ... })` in `scriptsforminecraftserver/scripts/entry.ts`, run `npm install` + `npm run build:full`.

---

Next: see [SDK reference](./sdk-reference.en.md) or [manifest contract](./manifest-contract.en.md).