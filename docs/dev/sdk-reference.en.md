# SDK Three-Drawer API Reference

> `@sfmc/sdk` is the single umbrella package for the repo, exposing stable APIs through subpath exports. SAPI module authors should only look at `@sfmc/sdk/sapi/runtime` and `@sfmc/sdk/contracts`. The other drawers (`host` / `sdk` / `module-loader`) are currently used only by entry.ts and SDK internals.

## Drawer cheat sheet

| Drawer | Subpath | Audience |
|--------|---------|----------|
| runtime | `@sfmc/sdk/sapi/runtime` | 90% of business code |
| host | `@sfmc/sdk/sapi/host` | Platform adapters (rarely imported by modules) |
| sdk | `@sfmc/sdk/sapi/sdk` | Contract types (stub for now) |
| contracts | `@sfmc/sdk/contracts` | Shared types across SAPI and db-server |
| module-loader | `@sfmc/sdk/module-loader` | **`scripts/entry.ts` ONLY** |
| logs | `@sfmc/sdk/logs` | Node-side logging |
| node/config | `@sfmc/sdk/node/config` | Node-side configs/data path resolution |
| behavior-pack-build | `@sfmc/sdk/behavior-pack-build` | BP publish artifact builder |

---

## runtime — the workhorse

### `debug` — unified log facade

```ts
import { debug } from "@sfmc/sdk/sapi/runtime";
debug.i("LAND", "load");          // info
debug.w("LAND", "stale cache");   // warn
debug.e("LAND", "db unreachable");// error
```

`debug.i/w/e` output is gated by `setDebugLevel("INFO" | "WARN" | "ERROR")`. Production defaults to ERROR.

### `Command` — command registration

```ts
import { Command } from "@sfmc/sdk/sapi/runtime";

Command.register(
  "transfer",                       // command literal
  "economy.transfer",               // permission node
  (player) => { /* ... */ },        // handler (may be async)
  "Transfer to another player",     // help text
  "economy"                         // optional category
);
```

Called once during BP startup. Registered commands route through `moduleGuard`, so commands from disabled modules are auto-rejected.

### `Permission` — permission nodes

```ts
import { Permission } from "@sfmc/sdk/sapi/runtime";

Permission.register("land.create", Permission.Admin);  // 0=Any 1=Member 2=OP 3=Admin
Permission.check(player, "land.create");              // boolean
```

### `Msg` — player messaging + system channel

```ts
import { Msg } from "@sfmc/sdk/sapi/runtime";

Msg.info("Loaded.", player);       // §f[*]
Msg.success("Saved.", player);     // §a[√]
Msg.warning("Inventory full.", player); // §e[!]
Msg.error("Command failed.", player);   // §c[×]
Msg.tips("Tip: /menu opens the panel.", player);
```

> **Always** use `Msg.*` instead of `player.sendMessage()` — these methods auto-apply prefix color codes, play sound effects, and forward messages to the system channel.

### `HttpDB` — db-server HTTP client

```ts
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

await HttpDB.get("/api/sfmc/lands");                    // string | null
await HttpDB.post("/api/sfmc/scoreboards", { entries });
await HttpDB.put(`/api/sfmc/players/${playerId}`, body);
await HttpDB.delete(`/api/sfmc/lands/${id}`, { actorId });

// Fine-grained control (method enum + status code)
import { HttpRequestMethod } from "@minecraft/server-net";
const r = await HttpDB.requestJSON(
  HttpRequestMethod.POST, "/api/sfmc/economy/transaction", payload
);
if (r.status === 0) throw new Error("db-server unreachable");
const json = JSON.parse(r.body);
```

`HttpDB` defaults to `127.0.0.1:3001`. Failures return `null` or `status=0`.

### `Money` — local ledger cache + remote ledger coordination

```ts
import { Money } from "@sfmc/sdk/sapi/runtime";

const balance = Money.get(player);                      // sync, cache hit
const fresh = await Money.load(player);                 // async, refreshes cache
Money.setCached(player, 100, version);                  // write local cache
await Money.commit(player, -50, reason);                 // commit to db-server
```

`Money.UNIT` is the currency unit string; all display text auto-append it.

### `MenuNavigator` / `FormStatus` — form state machine

```ts
import { MenuNavigator, FormStatus, obsStr } from "@sfmc/sdk/sapi/runtime";

const nav = new MenuNavigator(player);
nav.section("main", "Main menu", (page) => {
  page.label("Choose an action");
  page.button("Open inventory", () => nav.go("inventory"));
});
nav.section("inventory", "Inventory", (page) => {
  page.label(obsStr(""));
  const qty = obsStr("");
  page.textField("Quantity", qty);
  const status = new FormStatus(page);
  page.button("Confirm", () => {
    if (!qty.getData().trim()) { status.fail("Invalid quantity"); return; }
    status.ok("Submitted");
  });
});
nav.start("main");
```

`MenuNavigator` auto-renders the "back" button. `obsStr/Num/Bool` are reactive data sources. `FormStatus` auto-renders success/failure toasts.

### Utility functions

```ts
import {
  pointInArea_2D,      // (x, z, ax, az, bx, bz) => boolean
  getRandomInteger,    // (min, max) => number
  getShanghaiTime,     // () => { date, time }
  formatTimestamp,     // (ms) => "2026-07-21 14:30:25"
  generateId,          // ("CH"|"M"|"RP"|"L"|"CP") => string
  dimensionId,         // Dimension => 0|1|2
  toQueryString,       // ({k:v}) => "?k=v&k2=v2"
  ListFormInfo,        // (string[]) => "§r§7..." (gray info row)
  ensureDoubleChest,   // block-snapshot helper for paired chests
  placeSign,           // sign placement helper
  getLayout,           // block-permutation snapshot helper
  getBase, getChestCardinal, getSignFacing, // facing math
} from "@sfmc/sdk/sapi/runtime";
```

---

## contracts — shared types

```ts
import type {
  LandData, LandRole, LandMember, LandPermissions, LandTaxConfig,
  CreateLandRequest, DeleteLandResult, TransferLandResult,
} from "@sfmc/sdk/contracts";

import type {
  Channel, ChannelConfig, ChatMessage, MessageType,
  PlayerChannelSettings, RedPacket,
} from "@sfmc/sdk/contracts";

import type {
  CoopData, CoopMember, CoopBankLog, CoopShopGroup, CoopShopItem,
} from "@sfmc/sdk/contracts";

import type {
  EconomyAccountRow, EconomyTransactionRow, EconomyIdempotencyRow,
} from "@sfmc/sdk/contracts";

import type { PlayerData } from "@sfmc/sdk/contracts";
import type { ScoreboardEntry, Participant, ScoreboardIdentityTypeNumber } from "@sfmc/sdk/contracts";
import type { WorldData } from "@sfmc/sdk/contracts";
import type { ModuleCatalog, ModuleCatalogEntry, ModuleLock, ModuleRuntimeState } from "@sfmc/sdk/contracts";
```

> Per-file subpath also works (`@sfmc/sdk/contracts/land`), but for daily use just import from `@sfmc/sdk/contracts`.

---

## host — platform adapter (advanced)

`@sfmc/sdk/sapi/host` exposes host-singleton adapters. Regular modules don't import directly, but if you're writing a "host module" (like `feature-chat` adapting the entire host channel system), you can use:

```ts
import { apis } from "@sfmc/sdk/sapi/host";
apis.config.get("land:permissions");
apis.config.refresh();
apis.data.request("POST", "/api/sfmc/lands", body);
apis.events.subscribe("world.afterEvents.playerSpawn", handler);
```

> **Stage I**: `apis.data` delegates to `HttpDB`. A later stage will swap to a direct module-loader in-memory channel.

---

## sdk — contract types (stub)

```ts
import type { SapiHostApis, SapiModuleSurface, defineSapiModule } from "@sfmc/sdk/sapi/sdk";
```

> Currently only `SFMC_SAPI_SDK_VERSION` is exported. `defineSapiModule` and friends will land in a later commit.

---

## module-loader — BP entry (scripts/main.js) only

```ts
// BP entry (top of scripts/main.js) ONLY
import {
  ConfigManager,                // reads configs/*.json, areas/bannedItems
  Modules,                      // module enabled-state snapshot
  ModuleRegistry,               // bootAll / bootAfterWorldLoad / register / reconcile
  announceLoaded,               // report loaded modules to db-server at startup
  guardEvent,                   // wrap event subscriptions with moduleGuard
  setModuleGuard,               // inject moduleGuard into Command/Permission
} from "@sfmc/sdk/module-loader";
```

> Business modules must NOT import this drawer. `moduleGuard` is injected once by entry.ts; modules benefit indirectly through `Command.register` / `Permission.register`.

---

## Others (Node-side)

- `@sfmc/sdk/logs` — `createLogger({ source, sinks })`, shared by db-server / bds-tools / qq-bridge
- `@sfmc/sdk/node/config` — `resolveRuntimeRoot(fallbackRoot)`, `configDir(root)`, `configPath(root, name)`
- `@sfmc/sdk/behavior-pack-build` — esbuild entry scan + resource pack copy + manifest emit; consumed indirectly by `tools/emit-manifest.mjs`

---

Next: see [module-author.en.md](./module-author.en.md) for an end-to-end example, or [manifest-contract.en.md](./manifest-contract.en.md) for the manifest field semantics.