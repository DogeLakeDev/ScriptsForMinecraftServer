---
"@sfmc-bds/sdk": minor
---

feat(sdk/module-loader): 拆 BDS SAPI host 抽象，模块 loader 不再顶层 import `@minecraft/server`

DIP 改进 —— 让 `node --test` 等非 BDS 环境可直接 import `@sfmc-bds/sdk/module-loader` 而不依赖 `@minecraft/server` runtime。

- 新增 `BdsSystem` 类型（`module-loader/runtime.ts`）：仅声明模块 loader 实际使用的字段（`clearRun` / 可选 `runInterval` / `run`）。
- `ModuleRegistry.trackSystemRun()` 改为读 `globalThis.__sfmcBdsSystem?.clearRun(runId)`；不存在或抛错时 noop。
- `installHostBootstrap()` 在 BDS 进程里执行 `globalThis.__sfmcBdsSystem = system`（顶层 import `@minecraft/server` 仍发生在 install.ts，它只被 BP bundle 调用）。

行为不变（BP 在 BDS 中运行时语义 100% 一致；测试环境之前根本跑不起来，现在能跑）。

模块作者影响：

- 模板 `sapi/src/index.ts` 仍可用 `ModuleRegistry.register({...})`，无需任何改动。
- 模板 `test/*.test.ts` 现在可以直接 `import "@sfmc-bds/sdk/testing"` + `import "../sapi/src/index.js"`，无需 ESM loader hook mock `@minecraft/server`。

无 `BdsSystem` 时 `trackSystemRun` 静默 noop；模块若依赖 `system.clearRun`，应保证 BP 启动了 `installHostBootstrap()`（已是一贯约定）。