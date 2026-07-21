# SDK API Reference

> `@sfmc/sdk` is the platform's official npm package, exposing the full v2 protocol as a single umbrella. Module authors only need four subpaths: `sapi/runtime`, `sapi/db`, `sapi/config`, `sapi/service`. The other drawers (`host`, `module-loader`, `node/*`, `behavior-pack-build`) are for platform and build tooling.

## Drawer cheat sheet

| Drawer | Subpath | Who should use |
|--------|---------|----------------|
| runtime | `@sfmc/sdk/sapi/runtime` | 90% of business code |
| **db** | `@sfmc/sdk/sapi/db` | All database read/write |
| **config** | `@sfmc/sdk/sapi/config` | All config read/write |
| **service** | `@sfmc/sdk/sapi/service` | All cross-module calls |
| contracts | `@sfmc/sdk/contracts` | Shared types between SAPI and db-server |
| module-loader | `@sfmc/sdk/module-loader` | BP entry: `ModuleRegistry.register` / `installHostBootstrap` |
| host | `@sfmc/sdk/sapi/host` | Platform layer adapter (modules don't import directly) |
| logs | `@sfmc/sdk/logs` | Node service logging |
| node/config | `@sfmc/sdk/node/config` | Node service locating configs/data |
| node/sdk | `@sfmc/sdk/node/sdk` | Node service unified capability surface |
| behavior-pack-build | `@sfmc/sdk/behavior-pack-build` | Build BP release artifact |

---

## runtime — Business code mainstays

```ts
import { debug, Msg, Command, Permission, MenuNavigator, Money, FormStatus, ListFormInfo } from "@sfmc/sdk/sapi/runtime";
```

### `debug` — Unified log facade

```ts
debug.i("LAND", "load");          // info
debug.w("LAND", "stale cache");   // warn
debug.e("LAND", "db unreachable");// error
```

### `Msg` — Player messages (use this, not `player.sendMessage`)

```ts
Msg.info("hint", player);
Msg.success("ok", player);
Msg.error("fail", player);
Msg.warning("warn", player);
Msg.tips("tip", player);
```

Handles prefix formatting (§f[*] / §a[√] / etc.), sound effects, and system channel forwarding.

### `Command` / `Permission`

```ts
Permission.register("land.use", Permission.Any);
Permission.register("land.admin", Permission.OP);
Permission.register("land.op", Permission.Member);

Command.register("mylcmd", "land.use", (player) => { /* ... */ }, "My command");
```

Permission levels: `Any=0` / `Member=1` / `OP=2` / `Admin=3`.

### `MenuNavigator` / `FormStatus` / `ListFormInfo` — UI

```ts
const nav = new MenuNavigator(player);
nav.section("home", "Home", (page) => { page.label("..."); page.button("Go", () => nav.rebuild("next")); });
nav.start("home");
```

### `Money` — Economy abstraction

```ts
const balance = await Money.load(player);
if (balance < price) { /* ... */ }
Money.setCached(player, newBalance, version);
```

---

## db — Database-friendly API ⭐

```ts
import { db, DbError, type TxContext, type WhereExpr } from "@sfmc/sdk/sapi/db";
```

### Table definition

```ts
await db.defineTable("my_table", {
  id: { type: "text", primary: true },
  owner_player_id: { type: "text", notNull: true, index: true },
  created_at: { type: "integer", notNull: true },
  expires_at: { type: "integer" },
  version: { type: "integer", default: 1 },
}, { softDelete: true });
// softDelete=true auto-adds _deleted_at / _version columns
```

`ColumnDef.type` ∈ `"text" | "integer" | "real" | "blob"`, optional `primary?` / `notNull?` / `default?` / `index?` / `unique?`.

### Single read/write (only outside transactions)

```ts
const rows = await db.query<MyRow>("my_table", {
  where: { eq: ["status", "active"] },
  orderBy: { field: "created_at", dir: "desc" },
  limit: 50,
});
const one = await db.get<MyRow>("my_table", "row-1");
await db.insert("my_table", { id: "row-1", ... });
await db.update("my_table", "row-1", { status: "active" });
await db.delete("my_table", "row-1");         // soft delete
await db.delete("my_table", "row-1", { hard: true });  // hard delete
```

### Transactions (all writes go here)

```ts
await db.tx(async (tx: TxContext) => {
  await tx.insert("lands", { id: "L1", ... });
  await tx.update("land_members", "lm-1", { role: "admin" });
  await tx.audit("lands", "L1", "transfer", { from: "A", to: "B" });
  // Cross-module call, runs inside the transaction, rolls back on failure
  await tx.call("economy.debit", { playerId: "A", amount: 100 });
  return { ok: true };
});
```

Throw inside `tx.fn` = auto ROLLBACK; return = COMMIT. Step order is the code order.

### WhereExpr

```ts
type WhereExpr =
  | { eq: [field, value] }
  | { ne: [field, value] }
  | { gt: [field, value] } | { gte: [field, value] }
  | { lt: [field, value] } | { lte: [field, value] }
  | { like: [field, pattern] }
  | { in: [field, values[]] }
  | { isNull: [field] }   | { isNotNull: [field] }
  | { and: WhereExpr[] }  | { or: WhereExpr[] }  | { not: WhereExpr };
```

No raw SQL. All expressions compile to prepared statements.

### Platform primitives

```ts
await db.audit("lands", "L1", "transfer", { from, to });
const result = await db.idempotent("land.transfer", requestId, async () => {
  // Same requestId will not run twice
  return await doTransfer();
});
```

### DbError

```ts
catch (e) {
  if (e instanceof DbError) {
    console.log(e.code, e.status, e.message);
  }
}
```

---

## config — Module config ⭐

```ts
import { config } from "@sfmc/sdk/sapi/config";
```

```ts
const cfg = await config.get<{ minSquare: number; maxSquare: number }>("land.config");
cfg.minSquare;  // typed
await config.set("land.config", "maxSquare", 200);
config.onChange("land.config", (key, value) => {
  // in-process notification (all modules in same SAPI process receive)
});
```

**Note**: `config.get` uses an in-memory cache; the first call pulls the full `configs/<key>.json` for the configKey, subsequent reads hit memory. `config.set` updates memory immediately + async-persists to db-server.

---

## service — Cross-module calls ⭐

```ts
import { service } from "@sfmc/sdk/sapi/service";
```

```ts
// Call a service
const land = await service.get<{ id: string; name: string } | null>("land.byId", { landId: "L1" });

// List all registered services
const all = await service.list();  // [{ name, moduleId }, ...]
```

**Inside transactions**: use `tx.call("service.name", input)`, not `service.get`. `tx.call` runs atomically with the current transaction.

**Authorization**: `manifest.services.requires` must declare every called service, otherwise db-server throws at startup.

---

## contracts — Shared types

```ts
import type { LandData, CoopData, Channel } from "@sfmc/sdk/contracts";
```

Types shared between SAPI and db-server. **Don't** reinvent. If you need a new type, add it to `contracts/` first.

---

## module-loader — BP entry

```ts
import { ModuleRegistry, installHostBootstrap } from "@sfmc/sdk/module-loader";
```

```ts
// main.ts top
installHostBootstrap({ dbServerUrl: "http://127.0.0.1:3001" });

// each module sapi/src/index.ts
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
ModuleRegistry.register({
  id: "feature-mine",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() { Permission.register("mine.use", Permission.Any); },
    async init() { /* db.defineTable, etc. */ },
    cleanup() {},
  },
});
```

---

## node/* — Platform process internals

`@sfmc/sdk/node/*` is for db-server / qq-bridge / bds-tools / sfmc themselves. Module authors **must not** import these subpaths (they don't resolve in the SAPI process).

---

## Protocol version

```ts
import { SFMC_SAPI_DB_VERSION } from "@sfmc/sdk/sapi/db";
// → "0.1.0"
```

Current version of the `db` subpath. Bump on incompatible protocol changes; db-server throws at startup if mismatched.

---

Next: see [manifest contract](./manifest-contract.en.md) or [module author guide](./module-author.en.md).