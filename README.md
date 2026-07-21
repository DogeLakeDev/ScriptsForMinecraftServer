# sfmc-modules

SFMC v2 protocol modules. First-party modules for [ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer), built on `@sfmc/sdk`.

Each module under `packages/<id>/` ships:

- `sapi/manifest.json` — v2 protocol declaration (`schemaVersion: 2`)
- `sapi/src/index.ts` — SAPI entry point (`ModuleRegistry.register({...})`)
- `package.json` — depends on `@sfmc/sdk`
- Optional `configs-default/` — initial `configs/<configKey>.json` defaults
- Optional `resource_pack/` — assets bundled with the BP

## Layout

```
sfmc-modules/
├── packages/
│   ├── land/                       # 领地 (v2 standard example)
│   ├── land-gui/                   # 领地 GUI 表单
│   ├── economy/                    # 经济系统
│   ├── chat/  chat-gui/            # 聊天
│   ├── coop/  coop-gui/            # 合作社
│   ├── fly/                        # 区域飞行
│   ├── afk/                        # 挂机判定
│   ├── peace/                      # 和平区域
│   ├── spawn-protect/              # 重生保护
│   ├── clean/                      # 地面掉落清理
│   ├── qa/                         # 问答
│   ├── tps/                        # TPS 监控
│   ├── chat-sounds/                # 聊天音效
│   ├── daily-task/                 # 每日任务
│   ├── online-time/                # 在线时长
│   ├── monitor/                    # 服务器监控
│   ├── activity-log/               # 行为日志
│   ├── scoreboard-sync/            # 计分板快照
│   ├── inventory-switcher/         # 背包切换
│   ├── creative/                   # 创造区域
│   ├── survival/                   # 生存区域
│   ├── data-backup/                # 数据备份
│   ├── gui/                        # 主菜单 GUI
│   └── ...
├── index.json                      # module catalog mirror
├── tools/
│   ├── check-modules.js            # 校验所有 manifest.json 合法
│   └── build.js                    # 批量 esbuild 到 ./build/
├── .github/workflows/ci.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## Module contract (v2)

Each module MUST have a `sapi/manifest.json`:

```json
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "领地系统",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [
    "db:read:lands",
    "db:write:lands",
    "config:read:land",
    "config:write:land",
    "service:economy.account"
  ],
  "services": {
    "provides": [
      { "name": "land.byOwner", "input": {...}, "output": {...} }
    ],
    "requires": [
      { "name": "economy.account" }
    ]
  },
  "notes": "..."
}
```

`v1` manifest (with `routes` / `tables` / `migrations` / `handlers`) is rejected by
the platform at startup.

## Module author quickstart

```bash
mkdir -p packages/my-module/sapi/src
cat > packages/my-module/sapi/manifest.json <<'EOF'
{
  "schemaVersion": 2,
  "id": "feature-my-module",
  "name": "My Module",
  "type": "feature",
  "configKey": "my_module",
  "requires": [],
  "permissions": ["db:read:my_table", "db:write:my_table", "config:read:my_module"],
  "services": { "provides": [], "requires": [] },
  "notes": ""
}
EOF
cat > packages/my-module/package.json <<'EOF'
{
  "name": "@sfmc/module-my-module",
  "version": "0.1.0",
  "type": "module",
  "main": "sapi/src/index.ts",
  "private": true,
  "dependencies": {
    "@sfmc/sdk": "^0.1.0"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  }
}
EOF
```

```typescript
// packages/my-module/sapi/src/index.ts
import { db } from "@sfmc/sdk/sapi/db";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "feature-my-module",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("my_module.use", Permission.Any);
    },
    async init() {
      await db.defineTable("my_table", {
        id: { type: "text", primary: true },
        created_at: { type: "integer", notNull: true },
      });
    },
    cleanup() {},
  },
});
```

## Development workflow

```bash
# 拉全部模块到本地 BP 构建目录(主仓 scripts/ 下)
cd ../ScriptsForMinecraftServer
sfmc module install land --from github:Shiroha7z/sfmc-modules@latest
sfmc module install land-gui --from github:Shiroha7z/sfmc-modules@latest
sfmc behavior-pack build
sfmc behavior-pack deploy
```

## Distribution

Releases publish per-module tarballs:

```
sfmc-module-<id>-<X.Y.Z>.zip
sfmc-module-<id>-<X.Y.Z>.zip.sha256
```

`tools/check-modules.js` validates that every `packages/*/sapi/manifest.json` is v2-compliant
and the `index.json` catalog mirror matches the on-disk modules.

## CI

GitHub Actions runs:

1. `tools/check-modules.js` — manifest v2 sanity
2. `tools/build.js` — esbuild every module's `sapi/src/index.ts` to verify no compile errors
3. Publish tarball artifacts on tag push

## Migration from main repo

The `modules/packages/<id>/` directories in
[ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer)
were migrated to this repo via `git subtree push`:

```bash
cd ../ScriptsForMinecraftServer
git subtree push --prefix=modules/packages \
  git@github.com:Shiroha7z/sfmc-modules.git main
```

After push, modules live under `packages/<id>/` here. The main repo's
`modules/catalog.json` is updated to fetch `index.json` from this repo via:

```bash
sfmc module install <id> --from github:Shiroha7z/sfmc-modules@latest
```

## License

ISC