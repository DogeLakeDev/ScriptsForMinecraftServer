---
"@sfmc-bds/sdk": minor
---

feat(sdk): 新增 `@sfmc-bds/sdk/testing` 测试 harness

- `createFakePlayer({ id?, name })`：返回 `{ id, name, log, sendMessage }`；`Msg.*` 通过 duck-typed `sendMessage` 自动收集消息，`assertMsg(player, substring)` 断言。
- `createFakeWorld()`：极简事件总线（`on(event, handler)` / `emit(event, payload)` / `reset()`），单测跑 `system.events.subscribe` 替换面。
- `createFakeDb({ provides? })`：in-memory 事务替身，`tx.call(name, input)` 命中 stub 返回 output，未命中抛 `no stub for service "<name>"`；`calls` 数组记录全部调用。
- `runLifecycle(descriptor, opts?)`：直接调 lifecycle 钩子（registerPermissions / registerCommands / registerEvents / init），绕过 `ConfigManager.isReady()` 门禁；返回 `{ ok, error? }`。`opts.afterWorldLoad` 控制是否跑 init（默认遵守 descriptor 自身设置）。`runCleanup(descriptor)` 同款。
- `package.json` exports 新增 `./testing` 子路径；`build.mjs` SUBPATHS 增 `testing (node)`。
- 单元测试：`testing.test.mjs` 9 cases 通过（fake player/world/db + runLifecycle/cleanup 全部覆盖）。
- README 加「模块测试（无需 BDS）」章节，模板仓 README/test 也已指引走 harness。

> `runLifecycle` 不替身 SDK 内部 ConfigManager —— 模块若在 init 内调 db/config/service，须用例自己 stub。本期不模拟真 db-server / 真 BDS。