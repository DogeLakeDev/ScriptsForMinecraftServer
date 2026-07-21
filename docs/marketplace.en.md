# Module Management Guide

> Module acquisition flow after the SEA slim-down. The SEA embeds the `@sfmc/sdk` umbrella and reads modules directly from `modules/packages/<id>/` at runtime. There is no automatic "marketplace" download.

## 1. Design overview

```
dist/sea/sfmc.exe          ← contains dispatcher + @sfmc/sdk, 1.9MB
modules/packages/<id>/     ← business modules; SAPI + db-server read this at runtime
tools/fetch-module.mjs     ← one-shot CLI, populates modules/packages/<id>/
sfmc module <verb>         ← runtime read-only CLI (works inside the SEA)
```

**Hard constraints**:
- The SEA process **never connects to the network**. `sfmc module install` in SEA mode simply spawns `tools/fetch-module.mjs` as a child process.
- `modules/packages/<id>/sapi/manifest.json` is the single source of truth — SAPI, db-server, and sfmc CLI all read it directly.
- There is no longer a `modules/_manifests/module-manifests.json` aggregate product.

## 2. sfmc module CLI (runtime, works inside the SEA)

```
sfmc module list                       # scan modules/packages/<id>/ and list each module
sfmc module info <id>                  # show one module's manifest + fingerprint
sfmc module verify [id]                # recompute fingerprint(s); no id = all
sfmc module install <id> [--from <source>]
                                       # spawn tools/fetch-module.mjs
sfmc module uninstall <id>             # rm -rf modules/packages/<id>/
```

REPL path is identical: `sfmc> module install feature-land --from github:DogeLakeDev/ScriptsForMinecraftServer@latest`

All commands anchor at `./` and resolve `modules/packages/<id>/`. In SEA mode `ROOT = path.dirname(process.execPath)`, so the SEA exe must live next to a `modules/packages/` directory.

## 3. tools/fetch-module.mjs (build-time / one-shot)

Three sources for populating `modules/packages/<id>/`:

```bash
# from a GitHub Release
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2

# from a local zip
node tools/fetch-module.mjs install feature-foo \
  --from local:/abs/path/foo.zip

# directly copy a directory
node tools/fetch-module.mjs install feature-foo \
  --from dir:/abs/path/foo/

# list what's in a GitHub release
node tools/fetch-module.mjs list --from github:DogeLakeDev/ScriptsForMinecraftServer@latest

# optional SHA-256 verification
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2 \
  --sha256 a3f5b2...
```

### GitHub Release asset convention

On a GitHub release tag `vX.Y.Z`:
```
sfmc-module-<id>-<version>.zip
sfmc-module-<id>-<version>.zip.sha256   ← optional but recommended
```

Sidecar format (64-char lowercase hex + double-space + filename):
```
a3f5b2c1d4...  sfmc-module-feature-land-1.4.2.zip
```

Zip contents are arbitrary — `fetch-module.mjs` extracts them straight into `modules/packages/<id>/`. db-server, SAPI, and sfmc CLI will read the manifest from that directory.

### SHA-256 verification

- GitHub source: automatically fetches `.zip.sha256` sidecar if present; refuses install on mismatch.
- Local zip: must pass `--sha256 <hex>` or skip verification.
- Directory source: never verified (the directory already exists on disk, so you already trust it).

## 4. Module directory convention

```
modules/packages/<id>/
├── sapi/
│   ├── manifest.json          ← required, module contract
│   └── src/                   ← SAPI entry points
├── resource_pack/             ← optional, resource pack contents
└── package.json               ← optional, workspace metadata
```

Each `<id>` must match the `feature-* / core-*` ids in `modules/catalog.json`. db-server scans every `<id>/sapi/manifest.json` at startup.

## 5. End-to-end examples

### 5.1 First-time deployment with an empty SEA

```bash
# 1. Launch SEA (empty modules/, db-server reports modules=0)
./sfmc.exe
# 2. In another shell (regular Node), fetch modules from outside the SEA
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
node tools/fetch-module.mjs install feature-economy \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
# 3. Restart SEA → db-server reports modules=2
./sfmc.exe
# [manifest] loaded schemaVersion=1 modules=2 routes=...
```

### 5.2 Install via sfmc inside the SEA

```bash
sfmc> module install feature-chat --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
# sfmc spawns: node tools/fetch-module.mjs install ...
# child process output is forwarded to the REPL
# once installed, modules/packages/feature-chat/ appears → next SEA restart picks it up
```

### 5.3 Local development: copy from a working directory

```bash
# you just finished feature-foo and want to test inside the SEA
node tools/fetch-module.mjs install feature-foo --from dir:../feature-foo-work/
sfmc> restart db
# db-server scans feature-foo
```

### 5.4 Verify integrity

```bash
sfmc module verify
# Verifying installed modules
#   feature-land                    a3f5b2…c1d4e7
#   feature-economy                 b7d218…f09a3c
#   feature-foo                     d4e5f6…789abc

sfmc module info feature-land
# feature-land
#   path        : /.../modules/packages/feature-land
#   files       : 8
#   size        : 12.3 KB
#   fingerprint : a3f5b2c1d4...
#   schemaVer   : 1
#   routes      : 4
#     GET      /api/sfmc/lands          lands:list
#     POST     /api/sfmc/lands          lands:create
#     ...
```

## 6. Relationship with db-server / SAPI

```
              ┌────────────────────────┐
              │   sfmc.exe (SEA)       │
              │   - dispatcher         │
              │   - @sfmc/sdk embedded │
              │   - sfmc CLI           │
              └──────────┬─────────────┘
                         │ spawn child services
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
  db-server          qq-bridge         bds-tools
       │
       │ at startup scans modules/packages/<id>/sapi/manifest.json
       ▼
  modules/packages/<id>/sapi/manifest.json   ← single source of truth
       ▲
       │ SAPI bundle reads the same manifest
```

`sfmc module install` **only touches `modules/packages/<id>/`**. It does NOT:
- edit `modules/module-lock.json` (enable/disable state)
- restart db-server / BDS
- run `npm run build:full`

**Full loop** (manual):
```
node tools/fetch-module.mjs install feature-land --from github:...
vim modules/module-lock.json           # flip enabled=true
sfmc> restart db
# then reload BP from BDS console
```

## 7. Out of scope this round

- Cryptographic signatures / public-key verification (SHA-256 fingerprint only)
- Signed module zips (sidecar is plain SHA-256, not a key signature)
- Module publishing (`sfmc module publish`)
- `install --enable-and-deploy` one-shot chain
- Multi-source concurrent install / dependency resolution

These are Stage L+ roadmap.