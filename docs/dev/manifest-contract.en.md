# manifest v2 Contract

> v2 is the current protocol version, superseding the old `routes / migrations / handlers` path. Modules are untrusted third-party packages that declare to the platform **what capabilities they need, what they expose, and which database/config permissions they hold** via `manifest.json`. The platform **never executes module code**; it reads the manifest to decide whether to boot. Modules talk to the platform through `@sfmc/sdk/sapi/db|config|service`.

## 1. File location

**Single source of truth**: `packages/<id>/sapi/manifest.json` in the `Tanya7z/sfmc-modules` repo. After fetch-module, it lands in `modules/packages/<id>/sapi/manifest.json` in the main repo; both db-server and SAPI read it directly.

```jsonc
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "Lands",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [...],
  "services": {
    "provides": [...],
    "requires": [...]
  },
  "notes": "Free text (optional)"
}
```

## 2. Field cheat sheet

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `schemaVersion` | `2` | ✓ | v1 is deprecated, throws at startup; other values throw |
| `id` | string | ✓ | Globally unique, recommended prefixes: `feature-*` / `core-*` |
| `name` | string | ✓ | Display name |
| `type` | `"core"` \| `"feature"` | ✓ | `core` = cannot be disabled, `feature` = enable/disable-able |
| `configKey` | string | ✓ | Maps to `configs/<key>.json`, read via `config.get("land.x")` |
| `requires` | `string[]` | ✓ | Module ids this depends on (topological validation at startup) |
| `permissions` | `string[]` | ✓ | Platform permission declarations (see §4) |
| `services.provides` | `ServiceEntry[]` | ✓ | Services this module exposes |
| `services.requires` | `ServiceEntry[]` | ✓ | Services this module depends on |
| `notes` | string | – | Free text |

**Forbidden fields** (v1 leftovers, startup throws if present): `routes` / `tables` / `migrations` / `seeds` / `handlers` / `events`.

## 3. ServiceEntry

```jsonc
{
  "name": "land.byId",
  "input":  { "type": "object", "properties": { "landId": { "type": "string" } }, "required": ["landId"] },
  "output": { "type": "object" }
}
```

- `name` globally unique; db-server throws on cross-module duplicate
- A `requires` name must be matched by some enabled module's `provides`; startup throws otherwise
- `input/output` are documentation-only (JSON Schema style for future SDK type-gen); platform does not strictly validate them at the protocol layer

## 4. permissions

Permission string prefix table:

| Pattern | Meaning |
|---------|---------|
| `db:read:<table>` | Read a module-declared table |
| `db:write:<table>` | Write a module-declared table |
| `db:read:*` / `db:write:*` | Wildcard (use sparingly, requires startup whitelist) |
| `config:read:<config_key>` | Read entries under `configs/<config_key>.json` |
| `config:write:<config_key>` | Write entries under `configs/<config_key>.json` |
| `service:<service_name>` | Declare an intent to invoke this service (optional but recommended; startup validates) |

**Validation timing**: at startup, when db-server has loaded all enabled modules:
- Whether the table name is declared via `db.defineTable(...)` (otherwise `db:write:*` without declared table → startup warn)
- Whether `db:write:*` / `db:read:*` is on the `configs/db_config.json` `modulePermissionPolicy.allowWildcard` whitelist
- Whether each `service:*` has a matching entry in `services.requires`

**Runtime validation**: when `db.query("lands", ...)` runs, db-server verifies the calling module's permissions include `db:read:lands`; otherwise 403.

## 5. Startup validation picture

```
db-server startup:
  1. Open SQLite
  2. Scan modules/packages/*/sapi/manifest.json
     · schemaVersion != 2 → warn-skip (v1 no longer loaded)
     · Duplicate id → throw
  3. Topological sort of requires; cyclic → throw
  4. For every enabled module:
     · permissions vs. services.requires cross-check → missing declaration throws
     · services.requires.name must hit some provides.name → not found throws
     · Same services.provides.name declared by two modules → throw
  5. Register service handlers (modules call service.provide during SAPI init)
  6. Start HTTP, listen on 127.0.0.1:3001
  7. SAPI init phase: modules call db.defineTable() → schema-registry collects → unified CREATE TABLE
```

## 6. End-to-end example

`packages/feature-land/sapi/manifest.json`:

```jsonc
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "Lands",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [
    "db:read:lands",
    "db:write:lands",
    "db:read:land_members",
    "db:write:land_members",
    "db:write:land_audit_logs",
    "db:read:land_audit_logs",
    "config:read:land",
    "config:write:land",
    "service:economy.account",
    "service:economy.debit",
    "service:economy.credit"
  ],
  "services": {
    "provides": [
      { "name": "land.byId",        "input": {...}, "output": {...} },
      { "name": "land.byOwner",     "input": {...}, "output": {...} },
      { "name": "land.transfer",    "input": {...}, "output": {...} },
      { "name": "land.listMembers", "input": {...}, "output": {...} },
      { "name": "land.auditLog",    "input": {...}, "output": {...} }
    ],
    "requires": [
      { "name": "economy.debit" },
      { "name": "economy.credit" }
    ]
  },
  "notes": "Land system, depends on feature-economy services"
}
```

## 7. Validation tool

The module repo ships `tools/check-modules.js`:

```bash
cd sfmc-modules
node tools/check-modules.js
# Inspect every packages/*/sapi/manifest.json:
#   - schemaVersion === 2
#   - no forbidden fields (routes / tables / migrations / seeds / handlers / events)
#   - id globally unique
#   - every db:read:*/db:write:* in permissions has a matching defineTable
#   - every service:* in permissions also appears in services.requires
```

CI runs this on every push; failure blocks merge.

---

Next: see the [module author guide](./module-author.en.md) to write a new module, or the [SDK API reference](./sdk-reference.en.md) for the db / config / service drawers.