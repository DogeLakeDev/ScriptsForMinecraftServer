# Configuration

On first start, each service creates missing config files with built-in defaults and a `$schema` field for IDE hover docs.

The workspace [`.vscode/settings.json`](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.vscode/settings.json) maps schemas by filename; you can also rely on in-file `$schema` pointing at `@sfmc-bds/sdk/schemas/*.schema.json`.

## Platform configs

| File | Purpose |
| ------ | ------ |
| `db_config.json` | db-server port, data paths, modules directory, etc. |
| `qq_config.json` | QQ bridge (official bot / LLBot) |
| `bds_updater.json` | BDS updates and backups |
| `pack-update.json` | CurseForge add-on updates (see [Add-ons](./addons.md)) |
| `log-filter.json` | Log filtering |
| `permissions.json` | Permission table |
| `remote.json` | Remote control agent (see [Remote control](./remote.md)) |
| `packs/pack-sources.json` | Add-on update source bindings |

## Module configs

Each module declares `configKey` in `sapi/manifest.json`, mapped to `configs/<configKey>.json`. Defaults are supplied by the module on first write. Read/write goes through `@sfmc-bds/sdk/sapi/config` (HTTP: `/api/sfmc/configs/:configKey`), separate from platform `ConfigName`.

At SAPI startup, `GET /api/sfmc/configs/all` **once** loads and caches the platform domain: `modules`, `settings`, `permissions` (and `module_tokens`). Module-private JSON is **not** in that cache; use `config.get` / `config.set` on demand. Runtime `set` writes back immediately.

:::warning Important
After editing platform `configs/*.json` (or module config files without `config.set`), restart BDS. After module enable/disable writes `module-lock.json`, you usually need `mod reload` or a BDS restart for the behavior pack to catch up.

:::

## Module state files

| File | Description |
| ------ | ------ |
| `modules/catalog.json` | Installed module catalog (local mirror) |
| `modules/module-lock.json` | Per-module `enabled` state |
