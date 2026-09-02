# 架构

SFMC 如何把「作者仓 → npm / index → 主仓装载 → BDS」串起来。

## 分层

```text
┌── 作者独立仓（template）──┐     ┌── sfmc-modules（薄 index）──┐
│  sapi/ + package.json     │     │  index.json（npm 优先）      │
│  npm publish ─────────────┼──►  │  登记 PR（薄 index）         │
└───────────────────────────┘     └────────────┬────────────────┘
                                               │ mod search / install
┌──────────────────────────────────────────────▼────────────────┐
│  主仓 / SFMC_ROOT                                              │
│  modules/packages/ → catalog + lock（可 --link）               │
│  esbuild → packs/_build/sfmc-modules/ → BDS 世界目录           │
│  packages/db-server :3001  ←→  SAPI（BDS 内）                  │
│  packages/qq-bridge :3002  →  db-server                        │
│  packages/cli（sfmc CLI）监督上述进程                          │
└───────────────────────────────────────────────────────────────┘
```

## SAPI 启动顺序

1. `system.beforeEvents.startup`  
   `ConfigManager.init()` → `ModuleRegistry.bootAll()` → `announceLoaded()`
2. `world.afterEvents.worldLoad`  
   `ModuleRegistry.bootAfterWorldLoad()`（`afterWorldLoad: true`）
3. `system.beforeEvents.shutdown`  
   `ModuleRegistry.teardown()`

`ConfigManager` 启动时拉一次 `GET /api/sfmc/configs/all`，只缓存 `modules` / `settings` / `permissions`（及 token 表），之后不轮询。改 configs 或模块启停后需重启 BDS。模块私有 `configs/<configKey>.json` 走 `@sfmc-bds/sdk/sapi/config`。

## 模块生命周期

```ts
ModuleRegistry.register({
  id: "feature-afk",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {},
    registerCommands() {},
    registerEvents() {},
    async init() {},
    cleanup() {},
  },
});
```

装载与打包见 [构建与装载](./build-pipeline.md)。

## 真理源

| 数据 | 来源 |
| ------ | ------ |
| 模块契约 | `modules/packages/<id>/sapi/manifest.json` |
| 发现目录 | `sfmc-modules/index.json` |
| 已装列表 | `catalog.json`（本地镜像） |
| 启停 | `module-lock.json` |
| 运行时配置 | `configs/*.json` + db-server API |

## workspace 一览

| 路径 | 职责 |
| ------ | ------ |
| `modules/sdk/@sfmc-sdk/` | SDK 伞包 |
| `modules/sdk/@sfmc-eslint-plugin/` | ESLint 插件 |
| `modules/packages/<id>/` | 业务模块（不变） |
| `packages/db-server/` | REST + SQLite |
| `packages/qq-bridge/` | QQ WS |
| `packages/bds-tools/` | BDS 更新、pack-manager |
| `packages/cli/` | CLI / REPL / supervisor（运维；npm `@sfmc-bds/cli`） |
| `packages/meta/` | `@sfmc-bds/sfmc` 聚合包 |
| `packages/devkit/` | 作者 Watch / scaffold（`@sfmc-bds/devkit`） |
| `packages/sfmc-extension/` | VS Code/Cursor 扩展 |
| `packages/tools/` | 仓内自检、catalog、发版脚本（**不发 npm**） |

**目录约定：** `packages/*` = 平台包；`modules/packages/*` = 业务模块。

模块作者日常以 Watch / 真机联调验证运行时行为，见 [测试](./testing.md)。

下一章：[平台开发](./platform.md)。
