# 架构

## 分层

```
┌── 作者独立仓（template）──┐     ┌── sfmc-modules（薄 index）──┐
│  sapi/ + package.json     │     │  index.json（npm 优先）      │
│  npm publish ─────────────┼──►  │  登记 PR / mod publish       │
└───────────────────────────┘     └────────────┬────────────────┘
                                               │ mod search / defaultSourceFor
┌──────────────────────────────────────────────▼────────────────┐
│  主仓                                                          │
│  modules/packages/ → catalog + lock（install 落点，可 --link） │
│  esbuild → packs/_build/sfmc-modules/ → BDS                    │
│  db-server :3001  ←→  SAPI (BDS 内)                            │
│  qq-bridge :3002  →  db-server                                 │
│  sfmc CLI 管理上述进程                                          │
└───────────────────────────────────────────────────────────────┘
```

## SAPI 启动顺序

1. `system.beforeEvents.startup`  
   `ConfigManager.init()` → `ModuleRegistry.bootAll()` → `snapshotEnabled()`
2. `world.afterEvents.worldLoad`  
   `ModuleRegistry.bootAfterWorldLoad()`（`afterWorldLoad: true` 的模块）
3. `system.beforeEvents.shutdown`  
   `ModuleRegistry.teardown()`

`ConfigManager` 启动时拉一次 `/api/sfmc/configs/all`，之后不轮询。

## 模块生命周期

每个模块在 `sapi/src/index.ts` 里：

```ts
ModuleRegistry.register({
  id: "feature-afk",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() { /* … */ },
    registerCommands() { /* … */ },
    registerEvents() { /* … */ },
    async init() { /* … */ },
    cleanup() { /* … */ },
  },
});
```

## 真理源

| 数据 | 来源 |
|------|------|
| 模块契约 | 已装包 `modules/packages/<folder>/sapi/manifest.json` |
| 发现目录 | `sfmc-modules/index.json` |
| 已装列表 | `catalog.json`（mirror） |
| 启停 | `module-lock.json` |
| 运行时配置 | `configs/*.json` + db-server API |

## workspace 一览

| 路径 | 职责 |
|------|------|
| `modules/sdk/@sfmc-sdk/` | SDK 伞包 |
| `db-server/` | REST + SQLite |
| `qq-bridge/` | QQ WS 入口 |
| `bds-tools/` | BDS 更新、pack-manager |
| `sfmc/` | CLI / REPL / supervisor |
| `remote-controller/` | 远程控制 |
| `tools/` | 自检、fetch、catalog |

下一章：[平台开发](./platform.md)
