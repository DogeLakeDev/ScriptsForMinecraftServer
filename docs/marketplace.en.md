# Module Management Guide

> How to obtain modules under the SFMC v2 protocol. Modules are produced by an **external repository** and pulled into the main repo's `modules/packages/<id>/` via `tools/fetch-module.mjs`. Modules are untrusted third-party packages; they only talk to the platform through `@sfmc/sdk`.

## 1. Design

```
Shiroha7z/sfmc-modules              ← external module repo (independent git repo)
  packages/<id>/
    sapi/manifest.json               ← v2 contract (schemaVersion: 2)
    sapi/src/index.ts
    package.json                     ← @sfmc/module-<id>
  index.json                         ← first-party registry

Main repo ScriptsForMinecraftServer/
  modules/packages/<id>/             ← local source after fetch-module
  modules/catalog.json               ← local mirror (synced by fetch)
  modules/module-lock.json           ← runtime enable/disable state
  tools/fetch-module.mjs             ← offline/online fetch CLI
```

**Hard constraints:**

- The module repo's `sapi/manifest.json` is the **single source of truth** — SAPI, db-server, and the sfmc CLI all read it directly
- Module repo publishes GitHub Release tags; `tools/fetch-module.mjs install` resolves tarballs and writes them to the main repo
- The main repo's `modules/catalog.json` is a **local mirror**, synced by the fetch tool on each install
- The main repo does NOT publish modules — only `@sfmc/sdk`

## 2. First-party registry

Default registry is `Shiroha7z/sfmc-modules@main/index.json`:

```jsonc
{
  "version": 1,
  "modules": {
    "feature-land":      { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" },
    "feature-land-gui":  { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" },
    "feature-economy":   { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" }
  }
}
```

`fetch-module` resolves `<id>` → `github:<repo>@<tag>` → pulls the GitHub Release tarball.

The registry is cached at `tools/.sfmc-registry-cache.json` (1h TTL). On network failure, the cache is used and a warning is emitted.

## 3. fetch-module CLI

```bash
# List first-party registry
node tools/fetch-module.mjs search

# Install a module (default source: first-party registry)
node tools/fetch-module.mjs install feature-land

# Install from explicit source
node tools/fetch-module.mjs install feature-foo --from github:owner/repo@v1.0.0
node tools/fetch-module.mjs install feature-foo --from local:/abs/path/foo.zip
node tools/fetch-module.mjs install feature-foo --from dir:/abs/path/foo/

# Verification (GitHub auto-fetches .sha256 sidecar if present)
node tools/fetch-module.mjs install feature-land --from github:Shiroha7z/sfmc-modules@v1.5.0
```

## 4. sfmc module CLI (runtime, available in SEA)

```
sfmc module list                    # scan modules/packages/<id>/, list each
sfmc module info <id>               # show manifest + fingerprint
sfmc module verify [id]             # recompute fingerprint
sfmc module install <id> [--from <source>]
sfmc module uninstall <id>          # rm -rf modules/packages/<id>/
sfmc module enable <id>             # write module-lock.json enabled=true
sfmc module disable <id>            # write module-lock.json enabled=false
```

REPL equivalent:
```
sfmc> module install feature-land --from github:Shiroha7z/sfmc-modules@latest
sfmc> module enable feature-land
```

## 5. Module directory layout

```
modules/packages/<id>/
├── sapi/
│   ├── manifest.json          ← required, v2 protocol contract
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           ← entry, ModuleRegistry.register(...)
│       └── ...business files
├── configs-default/           ← (optional) default configKey values
├── resource_pack/             ← (optional) resource pack contents
└── package.json               ← @sfmc/module-<id>, depends on @sfmc/sdk
```

Each `<id>` must match the `feature-*` / `core-*` naming in `modules/catalog.json`.

## 6. End-to-end examples

### 6.1 Fresh main repo deployment

```bash
# 1) Pull the land module
cd ScriptsForMinecraftServer
node tools/fetch-module.mjs install feature-land
# Pulls tarball + extracts to modules/packages/feature-land/
# Syncs modules/catalog.json
# Writes modules/module-lock.json { enabled: true }

# 2) Pull land-gui
node tools/fetch-module.mjs install feature-land-gui

# 3) BP build + deploy
sfmc behavior-pack build
sfmc behavior-pack deploy

# 4) Start db-server
node db-server/dist/index.js
# Startup log:
#   [manifest v2] loaded 2 modules; provides 13 services
#   [manifest v2] enabled: feature-land, feature-land-gui

# 5) Start BDS, SAPI loads modules
```

### 6.2 In SEA mode

```bash
# SEA is offline; module install spawns a child process running tools/fetch-module.mjs
sfmc> module install feature-chat --from github:Shiroha7z/sfmc-modules@latest
# After install, modules/packages/feature-chat/ appears
# Restart SEA; db-server scans and loads
```

### 6.3 Local dev: copy from working directory

```bash
# You just wrote feature-foo, want to test in the main repo
node tools/fetch-module.mjs install feature-foo --from dir:../sfmc-modules/packages/feature-foo/
sfmc behavior-pack build
```

## 7. Offline / air-gapped

`fetch-module` supports fully offline sources:

```bash
# 1) Air-gapped: download zip, then --from local
scp sfmc-module-feature-foo-1.0.0.zip server:/tmp/
node tools/fetch-module.mjs install feature-foo \
  --from local:/tmp/sfmc-module-feature-foo-1.0.0.zip \
  --sha256 a3f5b2c1d4e5f6...

# 2) Whole directory copy
node tools/fetch-module.mjs install feature-foo --from dir:/mnt/share/modules/feature-foo/
```

## 8. Relationship with db-server / SAPI

```
                    ┌──────────────────────────────────┐
                    │  Shiroha7z/sfmc-modules (ext.)   │
                    │  - index.json (registry)         │
                    │  - packages/<id>/source code     │
                    └──────────────┬───────────────────┘
                                   │ git subtree / fetch tarball
                                   ▼
┌─────────────────────────────────────────────────────────┐
│  Main repo ScriptsForMinecraftServer                     │
│                                                          │
│   modules/packages/<id>/  ← esbuild entry                 │
│   modules/catalog.json    ← static mirror                │
│   modules/module-lock.json ← enable/disable state         │
│                                                          │
│   tools/fetch-module.mjs   ← fetch CLI                    │
│   tools/check-ootb.js      ← pre-boot self-check          │
│   tools/lock.js            ← fingerprint / drift check    │
│                                                          │
│   db-server/               ← runs on 127.0.0.1:3001       │
│     manifest-loader.ts     ← reads v2 manifest, enables   │
│     schema-registry.ts     ← collects db.defineTable      │
│     tx-runner.ts           ← /api/sfmc/db/tx dispatcher   │
│     service-registry.ts    ← service.get dispatcher       │
│     permission-gate.ts     ← startup + runtime permission │
│                                                          │
│   modules/sdk/@sfmc-sdk/   ← npm @sfmc/sdk source         │
└─────────────────────────────────────────────────────────┘
```

## 9. FAQ

| Symptom | Cause / fix |
|---------|-------------|
| `fetch-module search` hangs | Network can't reach `raw.githubusercontent.com`. Check proxy / intranet config |
| `HTTP 404` on tarball | Release tag doesn't exist or tarball name doesn't match `sfmc-module-<id>-<version>.zip` |
| sha256 mismatch | Network MITM or file overwritten. Re-pull from first-party |
| `module install` succeeds but BDS doesn't load | ① Check `modules/module-lock.json` has `enabled: true`; ② Restart BDS (no hot-reload) |
| `db-server` startup logs `moduleId=... schemaVersion=1 (需要 2)` | Pulled module is v1 leftover. Check if you need to upgrade to a v2 version |

---

Next: see [module author guide](./dev/module-author.en.md) to write a new module, or [SDK API reference](./dev/sdk-reference.en.md).