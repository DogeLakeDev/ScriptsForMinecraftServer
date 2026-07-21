# Manifest Contract

> `manifest.json` is the per-module source for the BP build artifact `build/sfmc-modules/manifest.json`. Every module ships its own `modules/packages/<id>/sapi/manifest.json`, hand-written; `sfmc behavior-pack build` merges them during the BP assemble step.

## 1. Full schema

```ts
// Mirrored from db-server/src/manifest.ts (read-only contract)
interface ModuleManifestRoute {
  method: string;          // "GET" | "POST" | "PUT" | "DELETE"
  path: string;            // "/api/sfmc/lands" or "/api/sfmc/lands/:id/members"
  handler: string;         // "<moduleId>:<handlerName>"
}

interface ModuleManifestMigration {
  name: string;            // "create_lands_table"
  version: number;         // ascending, 1, 2, 3, ...
}

interface ModuleManifestEntry {
  name: string;            // display name, Chinese or English
  type: string;            // "core" | "feature"
  configKey: string;       // maps to configs/<key>.json
  requires: string[];      // module ids this depends on (topological order)
  handlers: string[];      // db-server-side handler names; empty at Stage I
  routes: ModuleManifestRoute[];
  migrations: ModuleManifestMigration[];
}

interface ModuleManifest {
  schemaVersion: number;   // currently 1
  generatedAt: string;     // ISO 8601 timestamp
  modules: Record<string, ModuleManifestEntry>;  // keyed by module id
}
```

## 2. Field semantics

### `routes[].method`

Only `GET` / `POST` / `PUT` / `DELETE` are accepted. `PATCH` has no equivalent `app.patch` in the current db-server; if you need PATCH semantics, use `POST + _method=PATCH` body instead.

### `routes[].path`

May be an exact path (`/api/sfmc/lands`) or a templated path with placeholders (`/api/sfmc/lands/:id/members`).
> **Placeholders must use the `:name` form** (colon-prefixed). Don't use Express 5 `{name}` or wildcards.

db-server startup matches on the first 4 path segments against `KNOWN_PREFIXES`. The exact prefix must appear in the path.

### `routes[].handler`

`<moduleId>:<handlerName>` form. E.g. `lands:list`, `lands:create`, `economy:transfer`.

`moduleId` must match the catalog.json `id`. `handlerName` is the registered name in db-server's handler-registry (Stage I leaves `handlers: []` empty; populated when Stage J+ lands).

### `migrations[]`

If your module changes db-server schema, list migration names + version numbers here. db-server applies them in ascending order at startup, writing to the `_migrations` table.

```json
{
  "migrations": [
    { "name": "create_lands_table", "version": 1 },
    { "name": "add_land_tax_config", "version": 2 }
  ]
}
```

> Empty array = no schema change required (e.g. read-only HTTP client).

### `notes` (optional, not in schema)

`emit-manifest.mjs` doesn't read `notes`, but **passes them through** to `module-manifests.json`. Useful as self-documentation:

```json
{
  "handlers": [],
  "routes": [],
  "migrations": [],
  "notes": "feature-foo: pure game-side logic, no db-server calls"
}
```

## 3. How db-server consumes the manifest

`db-server/src/index.ts` at startup:

```ts
const m = loadManifest();
log.info(`[manifest] loaded schemaVersion=${m.schemaVersion} modules=${...} routes=${...}`);
const warnings = reconcile(m, KNOWN_PREFIXES);
if (warnings.length > 0) for (const w of warnings) console.warn(`[manifest] WARN ${w}`);
```

`reconcile` checks whether each route's first 4 segments match `KNOWN_PREFIXES`. Mismatches → WARN, but startup continues.

Current `KNOWN_PREFIXES` (derived from `db-server/src/routes/*.ts`):

```
/api/sfmc/activities     /api/sfmc/channels
/api/sfmc/configs        /api/sfmc/coop /api/sfmc/coops
/api/sfmc/economy        /api/sfmc/health
/api/sfmc/lands          /api/sfmc/messages
/api/sfmc/modules        /api/sfmc/monitor
/api/sfmc/players        /api/sfmc/redpacket
/api/sfmc/scoreboards    /api/sfmc/world
/api/sfmc/settings
```

> If your route isn't in the prefix table — first add a file in `db-server/src/routes/`, then make sure `KNOWN_PREFIXES` covers it.

## 4. Evolution path

| Stage | Form |
|-------|------|
| **Stage I (current)** | `handlers: []` placeholder. Routes trigger WARN only |
| **Stage J** (planned) | `db-server/src/handler-registry.ts` exports a single `HANDLERS = Record<"<id>:<name>", RouteHandler>`. At startup, manifest is **strict-validated** — every handler name must exist in `HANDLERS`; missing entries throw |
| **Stage K+** | The SAPI bundle no longer references db-server route names by string. db-server boots, reads manifest + handler-registry, and assembles Express routes itself. SAPI side only sees `HttpDB.post(path, body)` — no implicit "I know db-server has this route" contract |

## 5. End-to-end example

`modules/packages/feature-foo/sapi/manifest.json`:

```json
{
  "handlers": [],
  "routes": [
    { "method": "GET",  "path": "/api/sfmc/foo/:id",      "handler": "foo:get"    },
    { "method": "POST", "path": "/api/sfmc/foo",           "handler": "foo:create" },
    { "method": "PUT",  "path": "/api/sfmc/foo/:id",      "handler": "foo:update" }
  ],
  "migrations": [
    { "name": "create_foo_table", "version": 1 }
  ],
  "notes": "feature-foo: demo module"
}
```

Build and verify:

```bash
sfmc behavior-pack build    # runs emit-manifest.mjs to merge all manifests
cat build/sfmc-modules/manifest.json | jq '.modules["feature-foo"]'
# prints the manifest above
```

Boot db-server:

```bash
cd db-server
npm run dev
# [manifest] loaded schemaVersion=1 modules=22 routes=34
# (if feature-foo's routes aren't in the prefix table, you'll see a WARN)
```

## 6. Validation tooling

`node tools/check-catalog.js` runs in CI. It checks catalog.json integrity but **does not** verify manifest.json field names — a typo'd field name passes through `emit-manifest.mjs` and only surfaces when db-server boots.

To avoid that delayed feedback, Stage K plans `node tools/check-manifest.js` — static validation of every manifest.json before the BP build. Today, an ad-hoc check:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const root = 'modules/packages';
const expected = ['handlers','routes','migrations'];
let bad = 0;
for (const id of fs.readdirSync(root)) {
  const mf = path.join(root, id, 'sapi', 'manifest.json');
  if (!fs.existsSync(mf)) { console.log('MISSING', id); bad++; continue; }
  const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
  for (const k of expected) if (!(k in j)) { console.log('NO FIELD', id, k); bad++; }
  if (j.routes) for (const r of j.routes) {
    if (!r.method || !r.path || !r.handler) { console.log('BAD ROUTE', id, r); bad++; }
  }
}
process.exit(bad ? 1 : 0);
"
```