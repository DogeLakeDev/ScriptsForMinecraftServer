# Contributing

Welcome to **sfmc-modules**.

This repository holds first-party SFMC v2 modules. Each module is a small
self-contained SAPI-side package that depends **only** on `@sfmc/sdk` and
the Minecraft Bedrock Script API.

## Module contract

See [README.md](./README.md#module-contract-v2). Every module MUST:

1. Ship `sapi/manifest.json` with `schemaVersion: 2`.
2. Ship `sapi/src/index.ts` calling `ModuleRegistry.register({...})`.
3. Declare **all** permissions it needs (db:read:*, db:write:*, config:*, service:*).
4. Declare **all** cross-module calls via `services.requires`.
5. Not import other modules' source code (use `service.get(...)` instead).

## Adding a new module

```bash
./tools/new.sh my-module-id
```

(Or copy `packages/land/` as a template.)

## Testing locally

Without publishing, you can `npm link` the SDK into each module:

```bash
cd ../ScriptsForMinecraftServer/modules/sdk/@sfmc-sdk
npm link
cd ../sfmc-modules/packages/land
npm link @sfmc/sdk
```

Then in main repo:

```bash
sfmc behavior-pack build
sfmc behavior-pack deploy
```

## Releases

Tag the module with semver. CI publishes:

```
sfmc-module-<id>-<X.Y.Z>.zip
```

to GitHub Releases + writes the entry into `index.json` on `main`.

## Style

- TypeScript strict mode (`exactOptionalPropertyTypes: true`)
- No raw SQL — only `db.tx()` / `db.query()` with `WhereExpr`
- No direct `fetch()` / `require("fs")` — only `@sfmc/sdk` capability surface

## License

By contributing, you agree your code is licensed under ISC (matching this repo).