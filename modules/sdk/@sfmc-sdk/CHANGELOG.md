# @sfmc-bds/sdk

## 0.2.0-beta.15

### Minor Changes

- f616527: 将所有玩家原生命令统一改为 `/c:<命令>`，模块命令不再拼接模块 id；旧的 `/c:<模块>_<命令>` 名称不再注册。

## 0.2.0-beta.14

### Minor Changes

- f616527: 将所有玩家原生命令统一改为 `/c:<命令>`，模块命令不再拼接模块 id；旧的 `/c:<模块>_<命令>` 名称不再注册。

## 0.2.0-beta.13

### Minor Changes

- 74a27c7: 将旧版 `!` 聊天前缀命令迁移到 Bedrock 原生自定义命令接口。平台命令统一使用
  `/sfmc:<command>`，模块命令使用 `/sfmc:<moduleId>_<command>`；同时修复内置
  `/sfmc:help` 及其访客权限未注册的问题。

  交互式数据库事务改为互斥排队执行，避免并发 `beginSession` 清理仍在使用的会话。

## 0.2.0-beta.12

### Patch Changes

- 050da7f: fix: BDS 原生依赖过滤与协商、模块作用域代理及数据库表结构解耦与自愈

  - **bds-tools**: 引入 Bedrock 原生脚本模块白名单机制，过滤 npm 纯数据包；支持自动识别并启用 level.dat 中的 gametest beta 实验性玩法；增强 server.properties 中文本地化与幂等更新。
  - **cli**: 行为包打包期与各模块原生依赖严格协商，协商提升 Bedrock 原生依赖至兼容最高版本；重构 esbuild SDK resolve 插件，为所有包含 `/sapi/` 的业务模块（含跨仓 symlink/junction）自动注入专属作用域虚拟代理，杜绝全局单例状态覆盖与越权。
  - **db-server**: 精简 `initSchema`，移除非底座的业务模块表定义，实现平台核心底座表与业务模组私有表契约解耦；增强 `SchemaRegistry.createPhysical`，自动探测并安全清理历史旧版空表，支持存量表平滑自愈追加缺失列。
  - **sdk**: 优化调试日志门面，显式格式化错误名称、信息与堆栈追踪；确保 SAPI 客户端安全注入请求头；修复 host bootstrap 导出边界以保证 Node 环境引用纯净。

## 0.2.0-beta.11

### Patch Changes

- e714f86: feat(cli/logs): 新增 BDS 原版日志本地化翻译与友好转换引擎，支持自定义规则正则替换与模式字典

## 0.2.0-beta.10

### Patch Changes

- d9ded8f: fix(sdk): 作用域 db/config/service 客户端，消除多模块身份串桶与全局事务互斥

  - 新增 createDbClient / createConfigClient / createServiceClient：身份与 tx 状态封闭在闭包
  - 单例 db/config/service 改为按 moduleId 登记表转发（兼容旧代码）
  - ModuleRegistry lifecycle 注入 ModuleServices；install 装配配对 inTx 探针
  - create-module 模板引导闭包捕获 services.db

## 0.2.0-beta.9

### Minor Changes

- 89ffceb: QQ 入服审批（INTERACTION 回调按钮）+ 群 OpenAPI info/bot_state + 踢人/白名单队列（BDS 由 qq-link 模块经 server-admin 生效）
- 89ffceb: QQ 侧指令菜单（official Markdown/键盘与 llbot 编号菜单共用注册表）
- 89ffceb: QQ 事件推群（节流）：join/leave/death 约 1 分钟聚合；BDS 启停立即推；配置 `qq_events`；出站复用现有 MC→QQ 通道
- 89ffceb: QQ 官方自定义菜单/指令面板同步、C2C 指令回复、status/online 与 QQ↔MC 绑定平台 API（游戏侧见独立模块 qq-link）
- 89ffceb: 群服互通支持 QQ 开放平台官方 Bot（双后端可切回 LLBot）
- 3c07ced: 移除远程控制功能：删除 `sfmc remote` / WebSocket agent、`configs/remote.json` 与对应 schema；不再提供 `@sfmc-bds/remote-controller` 包。

## 0.2.0-beta.8

### Minor Changes

- 8568388: feat(sdk/testing): L0 自 `.d.ts` 生成大范围假导出 + 覆盖率门禁

  对照 Levi 仅作映射笔记（不入库）；pin 版 `@minecraft/server` 为契约权威。

- 8568388: feat(sdk/testing): MockBukkit 风格假引擎 + createSandbox + minecraft-loader

  - 可控 `@minecraft/server` / `server-ui`（L0 生成全表面 + 未实现硬失败、tick、表单队列）
  - `createSandbox` 默认 boot；conformance 套件
  - 导出 `@sfmc-bds/sdk/testing/minecraft-loader`

- 8568388: feat(sdk/testing): createSandbox 宿主分相；API 保真加深含 server-ui 全表面 L0

  对照本地 pin server-ui（CustomForm/MessageBox/Observables/uiManager）；ItemStack/Container/Entity/Dimension/Scoreboard L2；CI 跑 SDK testing + generated/ 一致性。

### Patch Changes

- 8552772: fix(sdk/ConfigManager): `refreshModules` 对全部启停键做 diff 广播

  原先 `_notifyModuleChanges` 在非 force 路径 `break`，只通知 Map 第一项。
  现改为：init 全量通知；refresh 相对 previous 通知变更项（含消失 → false）。

- e175ed9: fix(sdk/testing): minecraft-loader 钉死同一 `@sfmc-bds/sdk` 实例，避免模块仓 node_modules 与宿主双包导致 Command/Permission 空清单；脚手架 Command.register 传入 MODULE_ID。

## 0.2.0-beta.7

### Patch Changes

- b81327a: sdk:移除对旧版type的支持 tools,cli:杂项

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
