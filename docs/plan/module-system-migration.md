# 模块系统迁移计划（Stage A–I）

> 日期：2026-07-21
> 状态：现状盘点 + 剩余阶段规划（本文只做规划，不含代码改动）
> 关联文档：[module-architecture.md](./module-architecture.md)、[modules.md](./modules.md)（旧草案）、
> [docs/dev/manifest-contract.zh.md](../dev/manifest-contract.zh.md)、[docs/dev/module-author.zh.md](../dev/module-author.zh.md)

## 〇、关于本文的来源说明

任务要求「阅读仓库根目录的 `HANDOFF.md` 获取完整上下文」，但当前分支、其他分支
（`main`、`origin/refactor/module-system`）以及 git 历史中都**不存在** `HANDOFF.md`。
因此本文的「完整上下文」是通过下列真实来源重建的：

- `docs/plan/module-architecture.md`（目标架构与 5 阶段实施顺序）
- `docs/plan/modules.md`（旧版包管理器草案，README 中标注为 "Stage A–G 之前的草案"）
- 代码内的阶段标记（`Stage A+B` / `Stage C` / `Stage D-G` / `Stage F` / `阶段 I`）
- `modules/catalog.json`、`services/catalog.json`、`modules/module-lock.json` 的实际内容
- `modules/sdk/@sfmc-sdk/` 与 `db-server/src/` 的实际目录结构

如果 `HANDOFF.md` 事后被补充，且其定义的迁移范围与本文不一致，应以 `HANDOFF.md` 为准，
并据此修订本文。

## 一、这次迁移是什么

这是一次**把 SAPI 宿主层与模块系统从「模块内相对路径 + 单体 db-server」逐步收敛进
`@sfmc/sdk` 契约 + 清晰宿主适配层**的分阶段迁移，代号 Stage A–I。它与
`module-architecture.md` 描述的目标一致，但落地形态在两处已与旧文偏离（见 §三）：

1. 框架包**没有**拆成 `shared/sfmc-{contracts,sapi-sdk,node-sdk,logs}` 四个独立包，
   而是统一收进单包 `modules/sdk/@sfmc-sdk`，用子路径导出区分抽屉：
   `@sfmc/sdk/contracts`、`@sfmc/sdk/sapi/runtime`、`@sfmc/sdk/sapi/host`、
   `@sfmc/sdk/sapi/sdk`、`@sfmc/sdk/node/*`、`@sfmc/sdk/logs`、`@sfmc/sdk/module-loader`、
   `@sfmc/sdk/behavior-pack-build`。
2. Node 业务侧**没有**按模块拆成每模块 `node/` + `schemas/`，而是集中在
   `db-server/src/{domain,routes,lib}`（已是 TS 化的清晰分层，但不是 per-module）。

本文承认现实形态，并在此基础上继续推进，不主张推倒重来。

## 二、目标架构回顾（来自 module-architecture.md）

- 依赖单向：`能力模块 → @sfmc/sdk（sapi/node SDK）→ contracts → logs`。
- 核心层随宿主常驻、不可卸载；能力模块/功能模块可独立启停。
- 所有可注销资源进模块的 `DisposableStore`，运行时逆序集中清理。
- 启用/禁用/安装/更新/卸载统一走一个 `ModuleManager` 入口，命令/HTTP/远程控制不各自复制状态变更逻辑。
- SAPI 构建产物不得含 `node:*`；Node 模块不得直接 import Minecraft API。

## 三、现状盘点

### 3.1 已经成型的部分

| 领域 | 现状 |
|------|------|
| 单包 SDK | `@sfmc/sdk` 已建立，抽屉齐全：`contracts`、`sapi/runtime`、`sapi/host`、`sapi/sdk`、`node/*`、`logs`、`module-loader`、`behavior-pack-build`。`build.mjs` 按子路径区分 neutral/node 平台。 |
| runtime 抽屉 | 已含实装：`Command`、`Permission`、`Msg`、`debug`、`HttpDB`、`Money`、`MenuNavigator`、`FormStatus`、工具函数。90% 业务只依赖此抽屉。 |
| contracts 抽屉 | 已含跨端共享类型：`land`、`coop`、`chat`、`economy`、`player`、`world`、`scoreboard`、`module`、`handle`。 |
| module-loader | `ModuleRegistry`（register/boot/reconcile/cleanup/teardown）、`ConfigManager`、`install` 骨架已在，`bootAll`/`bootAfterWorldLoad`/`reconcile` 生命周期可用。 |
| 模块包 | `modules/packages/<id>/sapi/{manifest.json,src/index.ts}` 25 个包成型；BP 由 `sfmc behavior-pack build` 聚合。 |
| db-server | 已 TS 化为 `src/{domain,routes,lib,server.ts,manifest.ts}` 清晰分层；`manifest.ts` 定义了 manifest 只读契约形状。 |
| 服务/工具注册表 | `services/catalog.json` 已从模块目录中分出（`service-db`/`service-qq-bridge`/`tool-bds-updater`）。 |

### 3.2 阶段进度矩阵（据代码标记重建）

| 阶段 | 目标 | 状态 | 证据 |
|------|------|------|------|
| A+B | runtime 工具入 `@sfmc/sdk/sapi/runtime`；loader 把 `Command.unregister*` 改 stub | 完成 | `module-loader/runtime.ts:4-9` 注释 + runtime 抽屉已实装 |
| C | 模块入口经 `ModuleRegistry.register`；BP 仍经 loader 间接引用行为包 | 进行中 | `packages/land/sapi/src/index.ts:10-13`、`packages/creative/sapi/src/index.ts:6-8` |
| D–G | 把 `gui / libs / api` 等跨包相对依赖拆成各自模块/包；行为包切到 controller 形态 | 未开始 | 同上 index.ts 注释「Stage D-G 把 gui/libs/api 等迁到各自模块后再修」 |
| F | 实装 `sapi/host` 的 14 字段 `SapiHostApis` 适配器（commands/permissions/config/data/events/scheduler/rpc/services/logger/tools/economy/messages/ui/disposables）；`install.ts` 的 data adapter 由占位换真实 | 未开始 | `sapi/host/index.ts:6-11`、`module-loader/install.ts:15,51` |
| （sdk 契约） | `@sfmc/sdk/sapi/sdk` 引入 `defineSapiModule` / `SapiHostApis` 契约类型 | 占位 | `sapi/sdk/index.ts` 仅导出版本号 |
| I | db-server 消费 manifest 的 `routes`/`migrations`/`handlers`，建立 handler-registry / migration-runner | 未开始 | `manifest-contract.zh.md`「handlers 阶段 I 留空」；各 manifest 三字段基本为空 |

### 3.3 技术债与漂移清单（需在迁移中一并收敛）

1. **`module-lock.json` 有孤儿/错位条目**
   - `service-panel`：`panel/` 已删除，仍残留启用态。
   - `feature-money`：`catalog.json` 已重命名为 `feature-economy`（configKey 仍 `money`），
     lock 里同时存在 `feature-money`（旧）和 `feature-economy`（新），前者是孤儿。
   - `service-db` / `service-qq-bridge` / `tool-bds-updater`：这些 id 现属 `services/catalog.json`，
     lock 混入了服务态。需明确 lock 是否应管理服务，抑或服务态独立存储。
2. **`package.json` 脚本路径 bug**：`"check-catalog": "node /tools/check-catalog.js"` 用了
   绝对路径 `/tools`（前导斜杠），应为 `tools/check-catalog.js`。当前该脚本无法直接跑通。
3. **`*-gui` 子包未进 catalog**：`chat-gui`、`coop-gui`、`land-gui` 有各自 `manifest.json`，
   但不在 `catalog.json`，靠 `chat/coop/land` 业务包 `import` 被 esbuild 传递打包。
   Stage D–G 需明确它们是「归入宿主模块的内部包」还是「独立注册模块」，并统一。
4. **manifest 三字段未被消费**：绝大多数 `manifest.json` 的 `routes`/`migrations`/`handlers`
   为空且 db-server 未按其装配路由/迁移（属 Stage I）。
5. **文档漂移**：`CLAUDE.md` 仍引用 `panel/`、`db-server/inedx.js`（拼写）、`BDSTools/` 等旧结构；
   `AGENTS.md` 较新。`docs/plan/modules.md` 为旧草案。迁移完成后应对齐三份文档。
6. **旧 feature 级方案文档中的验证命令已失效**：`coop-reform-plan.md` / `land-audit-and-plan.md`
   里 `cd scriptsforminecraftserver && npm run build` 指向已删除目录，需改为 §六 的新命令。

## 四、剩余阶段迁移计划

原则：每阶段结束时现有功能仍可 `build && deploy` 正常运行；先补契约与校验，再迁实现，最后删旧路径。

### Stage C-收尾：入口与行为包 controller 化（低风险，先做）

- 范围：确认所有 `packages/<id>/sapi/src/index.ts` 都只经 `ModuleRegistry.register` 暴露生命周期，
  无顶层副作用；标注仍存在的跨包相对依赖清单，作为 Stage D–G 的输入。
- 触点：`modules/packages/*/sapi/src/index.ts`、`module-loader/runtime.ts`。
- 验收：`sfmc behavior-pack build` 产出单一 `scripts/main.js`；任一模块 `cleanup()` 后无遗留命令/事件/定时器。

### Stage D：`gui` 依赖归位

- 范围：把当前经相对路径/传递 import 使用的 GUI 代码，明确成「独立 gui 子包」或「并入宿主模块」，
  统一 `chat-gui`/`coop-gui`/`land-gui` 的归属，并在 `catalog.json` 与 manifest 中如实登记。
- 触点：`modules/packages/{chat,coop,land,*-gui}`、`modules/catalog.json`、`gui` 包。
- 验收：`node tools/check-catalog.js` 通过（含 §五 的路径修复）；GUI 模块被显式登记，无「隐式传递打包」的未登记包。

### Stage E：`libs` / 工具包归位

- 范围：把仍以相对路径共享的工具下沉——纯工具进 `@sfmc/sdk/sapi/runtime`（或独立工具包），
  与世界/玩家/实体/记分板相关的 SAPI 工具进独立工具包（见 architecture §5「工具包」）。
- 触点：`@sfmc/sdk/sapi/runtime/tools.ts`、各模块相对 import。
- 验收：跨模块相对 `../` 依赖清零；SAPI 产物不含 `node:*`。

### Stage F：宿主适配层实装（关键阶段）

- 范围：
  1. 在 `@sfmc/sdk/sapi/sdk` 定型 14 字段 `SapiHostApis` 接口 + `defineSapiModule`。
  2. 在 `@sfmc/sdk/sapi/host` 实装各适配器（commands/permissions/config/data/events/scheduler/
     rpc/services/logger/tools/economy/messages/ui/disposables）。
  3. `module-loader/install.ts` 把占位 data adapter 换成真实 `bindDataAdapter`；
     `runtime.ts` 恢复 `Command.unregisterByModule` 的真实值调用（去掉 A+B 的 stub）。
- 触点：`@sfmc/sdk/src/sapi/{sdk,host}`、`module-loader/{install,runtime}.ts`。
- 验收：模块只能访问上下文显式提供的能力；停用模块后命令/事件/路由/定时器全部回收；
  `npm run module-core:verify` 通过。

### Stage G：Node 侧模块化与 `ModuleManager` 单入口

- 范围：
  1. 评估是否将 db-server 业务按模块拆 `node/` + `schemas/`，或保持集中 `domain/` 但由清单驱动装配。
  2. 在 `sfmc` 建唯一 `ModuleManager`，统一 install/enable/disable/update/uninstall；
     CLI、`POST /api/sfmc/modules/:id/{enable|disable}`、远程控制都只调它。
- 触点：`sfmc/src/modules/*`、`db-server/src/routes/modules.ts`、`remote-controller`。
- 验收：状态变更只有一处实现；`module-lock.json` 写入路径唯一。

### Stage I：清单驱动的路由与迁移

- 范围：db-server 消费聚合 `manifest.json` 的 `routes`/`migrations`/`handlers`，
  建立 handler-registry 与按 version 升序的 migration-runner；模块声明式挂载路由与建表。
- 触点：`db-server/src/manifest.ts`、`db-server/src/routes/_shared.ts`、各模块 `sapi/manifest.json`。
- 验收：新增一个带 route+migration 的模块，无需改 db-server 核心即可挂载并建表；manifest 与实际路由/迁移一致有自动校验。

## 五、数据/配置一致性修复（可与上面阶段并行，低风险）

1. 清理 `module-lock.json`：移除 `service-panel`、`feature-money` 孤儿；明确服务态存储位置。
2. 修 `package.json` 的 `check-catalog` 脚本路径（`/tools` → `tools`）。
3. 让 `tools/check-catalog.js` 校验覆盖：catalog id 唯一、依赖闭包、entry 路径存在、
   lock 与 catalog/services 三方一致（无孤儿、无缺失）。
4. `tools/lock.js rebuild` 后 `drift` 干净。
5. 对齐 `CLAUDE.md` / `AGENTS.md` / `docs/plan/modules.md` 与现实结构（文档任务）。

## 六、统一验收标准与验证命令

每阶段必须同时满足（承接 architecture §8）：

- `npm run module-core:verify` 通过（SDK typecheck + build）。
- `node tools/check-catalog.js`、`node tools/check-ootb.js` 通过。
- `sfmc behavior-pack build && sfmc behavior-pack deploy` 成功，BDS 重启后功能可用。
- 任一模块停用后无遗留事件订阅/定时器/命令/路由。
- 模块只能访问上下文显式提供的能力。
- SAPI 构建产物不含 `node:*`；Node 模块不直接 import Minecraft API。
- 迁移期间旧路径保持可运行，适配完成后再删除旧入口。

新验证命令（替代旧文档中已失效的 `scriptsforminecraftserver` 命令）：

```bash
npm run module-core:verify        # SDK typecheck + build
npm run build                     # 全 workspace 构建
node tools/check-catalog.js       # catalog / lock 一致性（需先修 §五.2 路径）
node tools/check-ootb.js          # 环境就绪自检
# 需要活的 db-server：
cd db-server && npm run build && npm run test
node tools/smoke-modules.js       # 模块系统回归（需 db-server 在线）
```

## 七、建议实施顺序与风险

推荐顺序：**§五 一致性修复 → Stage C 收尾 → D → E → F → G → I**。理由：

- 先修 catalog/lock/脚本，让 `check-catalog` / `smoke-modules` 能作为后续每阶段的守门校验。
- D/E 是纯 SAPI 侧的依赖归位，风险低且能显著减小跨包耦合，为 Stage F 的宿主适配铺路。
- Stage F 是关键分水岭（去 stub、装配真实 host adapters），改动集中在 SDK，回归面可控。
- G/I 涉及 Node 侧装配与清单驱动，改动最深，放最后并保留旧路径兜底。

主要风险：

1. **Stage F 去 stub 后的资源回收回归**：`Command`/事件/定时器注销若有遗漏，停用模块会泄漏。
   需要以 §六 的「停用无遗留」为硬验收。
2. **单包 SDK 的平台边界**：`build.mjs` 已区分 neutral/node；新增 host 适配器时务必确保
   `sapi/runtime` 保持 neutral、不引入 `node:*`。
3. **清单驱动迁移（Stage I）与现有集中式 db-server 路由并存期**：需保证同一路由不被双重注册。
4. **文档与真相源漂移**：`CLAUDE.md` 等旧文可能误导后续贡献者；纳入 §五 一并对齐。
