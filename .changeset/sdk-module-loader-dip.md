---
"@sfmc-bds/sdk": minor
---

feat(sdk/module-loader): 拆 BDS SAPI host 抽象，模块 loader 不再顶层 import `@minecraft/server`

DIP：

- 新增 `BdsSystem` / `ModuleAuthHooks`；`trackSystemRun` 与模块身份注入均经钩子，不顶层拉 SAPI client。
- **`@sfmc-bds/sdk/module-loader` barrel 不再 re-export** `installHostBootstrap` / `createHttpDataAdapter`。
  BDS 入口：`@sfmc-bds/sdk/module-loader/install`；BP esbuild banner 调用 `installHostBootstrap()`。
- 因此 `import "@sfmc-bds/sdk/module-loader"`（仅 ModuleRegistry / ConfigManager）在 `node --test`
  下**无需** mock `@minecraft/server`。
- 若测试还 `import "@sfmc-bds/sdk/sapi/runtime"`（Command/Msg 等），仍需 mock（与 loader DIP 无关）。

破坏性：原先从 `@sfmc-bds/sdk/module-loader` 取 `installHostBootstrap` 的调用方须改子路径。
