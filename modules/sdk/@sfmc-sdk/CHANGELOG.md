# @sfmc-bds/sdk

## 0.2.0-beta.6

### Minor Changes

- 0992ab9: feat(sdk): 新增 `@sfmc-bds/sdk/testing` 测试 harness

  - `createFakePlayer({ id?, name })`：返回 `{ id, name, log, sendMessage }`；`Msg.*` 通过 duck-typed `sendMessage` 自动收集消息，`assertMsg(player, substring)` 断言。
  - `createFakeWorld()`：极简事件总线（`on(event, handler)` / `emit(event, payload)` / `reset()`），单测跑 `system.events.subscribe` 替换面。
  - `createFakeDb({ provides? })`：in-memory 事务替身，`tx.call(name, input)` 命中 stub 返回 output，未命中抛 `no stub for service "<name>"`；`calls` 数组记录全部调用。
  - `runLifecycle(descriptor, opts?)`：直接调 lifecycle 钩子（registerPermissions / registerCommands / registerEvents / init），绕过 `ConfigManager.isReady()` 门禁；返回 `{ ok, error? }`。`opts.afterWorldLoad` 控制是否跑 init（默认遵守 descriptor 自身设置）。`runCleanup(descriptor)` 同款。
  - `package.json` exports 新增 `./testing` 子路径；`build.mjs` SUBPATHS 增 `testing (node)`。
  - 单元测试：`testing.test.mjs` 9 cases 通过（fake player/world/db + runLifecycle/cleanup 全部覆盖）。
  - README 加「模块测试（无需 BDS）」章节，模板仓 README/test 也已指引走 harness。

  > `runLifecycle` 不替身 SDK 内部 ConfigManager —— 模块若在 init 内调 db/config/service，须用例自己 stub。本期不模拟真 db-server / 真 BDS。

### Patch Changes

- c72fdc8: feat(tools): 脚手架转向 cwd 单包根（与 Tanya7z/sfmc-module-template 同构）

  - `tools/new-module.mjs`：
    - 默认（缺省 `--root`）：写到 **cwd** 作为单包根（包根 = 包仓库根），生成自包含 `package.json` + 自包含 `sapi/tsconfig.json` + `$schema` 指向 `node_modules/@sfmc-bds/sdk`。
    - `--root <path>` / `SFMC_MODULES_ROOT` 显式 legacy 模式：仍写到 `<root>/packages/<id>`（兼容旧 sfmc-modules 工作区）。
    - 拒绝 `--root` 指向主仓 `modules/packages`（那是 install 落点，不是开发工作区）。
    - 终端打印「模式: cwd 单包根 / legacy 工作区」+ 各自的下一步命令。
  - `tools/scaffold-redirect.test.mjs`：5 cases 表驱动（cwd 单包 / legacy / 拒主仓 / 缺 packages / env fallback）。
  - i18n：`modwiz.genPackage` / `modwiz.skeletonWritten` 等改为 cwd 友好文案。
  - 文档：上一轮 `module-author.md` 已写明 `sfmc module create` 在模块仓根执行 + `--from local --link` 装入主仓；本 PR 落地脚手架默认行为。

## 0.2.0-beta.5

### Patch Changes

- none

## 0.2.0-beta.4

### Patch Changes

- none

## 0.2.0-beta.3

### Patch Changes

- none

## 0.2.0-beta.2

### Minor Changes

- feat(sapi): 增强 debug 门面（运行时开关 + DebugSink），经 @minecraft/diagnostics 可选接入 Sentry；BP manifest 声明 diagnostics/server-admin

### Patch Changes

- feat(sapi): 增强调试日志功能，支持 Sentry 接入，更新相关模块和文档

## 0.2.0-beta.1

### Patch Changes

- a5ccbd3: fix(logs/config): BDS 级别解析 DRY 到 SDK；剥前缀后勿误判 Error；readJson 剥 BOM；log-filter 走 ensureSchemaConfig

## 0.2.0-beta.0

### Minor Changes

- 进度条 ProgressHandle.setTotal / 非 TTY 契约；HttpDB 按请求 token 与 DataAdapter；ModuleRegistry 鉴权注入；日志高亮；ensureCoreConfigs；contracts 精简与 cleanupModule 作用域收敛。
