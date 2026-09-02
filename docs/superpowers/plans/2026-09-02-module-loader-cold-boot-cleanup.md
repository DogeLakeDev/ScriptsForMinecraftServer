# module-loader 冷启动收敛 Implementation Plan

> **For agentic workers:** Prefer subagent-driven-development (task-by-task + reviews).
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放弃 SAPI 热启停，删除相关半成品 API；收敛 `cleanup`/`teardown` 为「模块自管 + auth 清理」；按序修守卫策略、分层、announce、afterWorldLoad、死面与注释。

**Architecture:** 冷启动唯一真相：`installHostBootstrap` → `ConfigManager.init` → `bootAll` →（可选）`announceLoaded` → `worldLoad` → `bootAfterWorldLoad` → `shutdown` → `teardown`。启停只影响**下次** BDS 启动时装哪些模块；运行中 `ConfigManager.isEnabled` 反映启动时缓存，不再提供 `refreshModules`/`reconcile`。指令生命周期由模块在 `registerCommands`/`cleanup` 自管，loader 不再 stub 注销。

**Tech Stack:** `@sfmc-bds/sdk` module-loader / sapi；文档 `AGENTS.md`、`docs/zh/dev/architecture.md`；兄弟仓 `sfmc-modules` AdminGUI 跟删。

**Spec:** 用户 2026-09-02 决策（本对话）+ 既有审查看板 `module-loader-review.canvas.tsx`

---

## 决策记录：禁用模块指令守卫怎么修

**结论：不接线** `setModuleGuard`**；删除 install 头注释中的虚假承诺；**`command.ts` **的** `setModuleGuard` **保留为可选扩展点（不从 install 调用）。**

理由：

1. 冷启动下未启用模块不会进 `bootModule`，也就不会跑 `registerCommands`——正常路径下禁用模块**没有**指令可拦。
2. 热启停已删除，「运行中 isActive 变 false 但指令仍在表里」不再是设计状态；再接线守卫会暗示可变运行时契约，与本次收敛矛盾。
3. 一行接线成本虽低，但会把 AdminGUI/文档再次引向「运行时禁用」幻觉。
4. 若模块在 entry 顶层副作用里直接 `Command.register`（违规），应用 eslint / 代码审查约束，而不是 loader 假装能补救。

**不做：** 在 `installHostBootstrap` 里调用 `setModuleGuard((id) => ModuleRegistry.isActive(id))`。

---

## File Map

| 文件                                                                 | 责任                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `modules/sdk/@sfmc-sdk/src/module-loader/runtime.ts`                 | 删热启停 / track / Command stub / bootTasks / guardEvent；收敛 cleanup；修 afterWorldLoad；内联 `ModuleId` |
| `modules/sdk/@sfmc-sdk/src/module-loader/internal/module-keys.ts`    | **删除**（类型并入 `runtime.ts`）                                                                          |
| `modules/sdk/@sfmc-sdk/src/module-loader/internal/config-manager.ts` | 删 `refreshModules` / `onModuleEnabledChange` / listener 广播                                              |
| `modules/sdk/@sfmc-sdk/src/module-loader/data-adapter.ts`            | 删 `getModules`（仅热刷新用）；修正注释                                                                    |
| `modules/sdk/@sfmc-sdk/src/module-loader/http-data-adapter.ts`       | 删 `getModules` 实现；注释改为「install 内部装配，非公开子路径」                                           |
| `modules/sdk/@sfmc-sdk/src/module-loader/install.ts`                 | 删 setModuleGuard 承诺、`ModuleSurface`、`enabledModuleIds`、`snapshotEnabled`；正确调用 `announceLoaded`  |
| `modules/sdk/@sfmc-sdk/src/module-loader/index.ts`                   | 收窄公开导出与头注释                                                                                       |
| `modules/sdk/@sfmc-sdk/src/sapi/runtime/permission.ts`               | 改走公开 `module-loader` 出口，不碰 `internal/`                                                            |
| `AGENTS.md`、`docs/zh/dev/architecture.md`                           | 启动序列与「无运行中启停」对齐                                                                             |
| `sfmc-modules/packages/gui/sapi/src/AdminGUI.ts`                     | 去掉 `refreshModules`；文案改为「下次重启生效」                                                            |

**Out of scope（本计划不改，除非编译被迫）：** `_sandbox_archive/`**（已归档）、db-server 的 HTTP enable/disable API（仍可写 lock，供**下次**启动读）、`setModuleGuard` 在 `command.ts` 的实现本体。

---

### Task 1: 删除热启停与冗余 cleanup 追踪

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/runtime.ts`
- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/internal/config-manager.ts`
- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/data-adapter.ts`
- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/http-data-adapter.ts`
- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/install.ts`
- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/index.ts`

- [ ] **Step 1:** `runtime.ts` **删除热启停与 stub**

从 `ModuleRegistry` / 文件级删除：

- `lastEnabled`、`clearLastEnabled`、`snapshotEnabled`、`reconcile`
- `trackCleanup` / `trackCommand` / `trackSystemRun`、`cleanups` Map、`CleanUpFn` 类型（若无其它引用）
- `_cmdUnregister` / `_cmdUnregisterByModule` 及 Stage F 注释
- `bootTasks`、`guardEvent`（若本任务一并删死 API；否则留给 Task 6——**本计划约定 Task 1 只删热启停相关，**`bootTasks`**/**`guardEvent` **放到 Task 6**）

收敛 `cleanupModule(id)` 为：

```ts
static cleanupModule(id: ModuleId): void {
  const d = ModuleRegistry.get(id);
  if (!d) return;
  try {
    d.lifecycle.cleanup?.();
  } catch (e) {
    debug.e("Module", `[${id}] cleanup hook failed`, e);
  }
  booted.delete(id);
  // afterWorldLoad 相关状态位在 Task 4 引入后一并清理
  _authHooks?.clear(id);
}
```

`teardown()` 仍遍历 `cleanupModule`（shutdown 时模块自管资源 + 清 auth）。

- [ ] **Step 2:** `ConfigManager` **删除热刷新面**

删除：

- `onModuleEnabledChange`
- `_moduleChangeListeners`、`_notifyModuleChanges`
- `refreshModules`
- `init()` 里对 `_notifyModuleChanges` 的调用
- 头注释中「通过 onModuleEnabledChange 订阅」表述；保留「无热重载 / 改配置后重启 BDS」

保留：`bindDataAdapter` / `init` / `loadAll` / `isEnabled` / token / configKey / settings / permissions / `resetForTesting`。

- [ ] **Step 3:** `DataAdapter` **收窄**

`data-adapter.ts` 删除 `getModules()` 方法与相关 JSDoc。

`http-data-adapter.ts` 删除对应实现行。

- [ ] **Step 4:** `install.ts` **/** `index.ts` **去热启停调用**

- 启动序列改为：`await ConfigManager.init()` → `ModuleRegistry.bootAll()` →（Task 3）`announceLoaded()`；**不再** `snapshotEnabled()`
- 删除头注释第 5 条（setModuleGuard）
- `index.ts` 头注释去掉 `onModuleEnabledChange`；停止导出已删符号（`guardEvent` 若仍在则 Task 6 再删）

- [ ] **Step 5: Verify**

Run（git bash）:

```bash
pnpm --filter @sfmc-bds/sdk exec tsc7 --noEmit -p tsconfig.types.json
# 或
pnpm --filter @sfmc-bds/sdk build
```

Expected: 通过；全仓（主仓）无对已删符号的引用（`rg reconcile|snapshotEnabled|refreshModules|onModuleEnabledChange|trackCleanup|trackCommand|trackSystemRun` 在 `modules/sdk` 与 `docs`/`AGENTS.md` 中应为 0；`_sandbox_archive` 可残留）。

- [ ] **Step 6: Commit**（仅当用户允许）

```bash
git add modules/sdk/@sfmc-sdk/src/module-loader AGENTS.md docs/zh/dev/architecture.md
git commit -m "refactor(sdk/module-loader): drop hot enable/disable and command-track stubs"
```

---

### Task 2: 指令守卫策略落地（文档 + 注释，不接线）

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/install.ts`（确认无 setModuleGuard 调用与承诺）
- Modify: `AGENTS.md`
- Modify: `docs/zh/dev/architecture.md`
- Optional comment: `modules/sdk/@sfmc-sdk/src/sapi/runtime/command.ts`（`setModuleGuard` JSDoc 注明：冷启动模型下 install 不注入；可选测试/自定义 host）

- [ ] **Step 1: 文档改写启动与启停语义**

`AGENTS.md` / `architecture.md`：

- 启动：`init` → `bootAll` →（announce）→ `worldLoad` → `bootAfterWorldLoad` → `shutdown` → `teardown`
- **删除**「运行中启停：… → refreshModules → reconcile」整段
- 改为：db-server / AdminGUI 的 enable/disable 只改 lock/catalog，**下次** `start bds` / 装载闸门后生效；当前进程内已 boot 模块不自动 teardown

- [ ] **Step 2: Verify**

`rg "reconcile|refreshModules|setModuleGuard|snapshotEnabled" AGENTS.md docs/zh/dev/architecture.md modules/sdk/@sfmc-sdk/src/module-loader`  
Expected: install 无 setModuleGuard 承诺；文档无热启停链路。

- [ ] **Step 3: Commit**（若用户允许；可与 Task 1 合并为一次提交）

---

### Task 3: `announceLoaded` 去遮蔽

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/install.ts`

- [ ] **Step 1: 正确调用 runtime 导出**

删除文件底部本地空函数 `announceLoaded` 与延迟 import 把戏。顶部：

```ts
import { announceLoaded, bindModuleAuthHooks, ModuleRegistry, type BdsSystem } from "./runtime.js";
```

startup 订阅末尾直接：`announceLoaded();`

- [ ] **Step 2: Verify**

静态阅读 startup 回调；`rg "function announceLoaded" modules/sdk/@sfmc-sdk/src/module-loader/install.ts` → 无匹配。

---

### Task 4: 完整 `afterWorldLoad` 语义

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/module-loader/runtime.ts`

- [ ] **Step 1: 拆分「已注册生命周期」与「已 init」**

引入 `initialized: Set<string>`（或等价），约定：

| 阶段                 | `afterWorldLoad: false`                                                    | `afterWorldLoad: true`                                                                                  |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bootModule`         | register → `init` → 加入 `booted` + `initialized`                          | register → 加入 `booted`；**若** `worldLoaded` 已真则立刻 `init` 并加入 `initialized`                   |
| `bootAfterWorldLoad` | 跳过                                                                       | 对 `booted` 且未 `initialized` 且 active 的模块：`applyModuleAuthContext` → `init` → 加入 `initialized` |
| `cleanupModule`      | 调 `lifecycle.cleanup`；从 `booted`/`initialized` 删除；`_authHooks.clear` | 同左                                                                                                    |

禁止 `bootAfterWorldLoad` 对已 `initialized` 的模块再次 `init`。

- [ ] **Step 2:** `isBooted` **语义**

保持 `isBooted` = 已完成 register 阶段（在 `booted` 集合）。若公开需要「已 init」，可新增 `isInitialized(id)`；**仅当**现有调用方需要时再导出，否则先 private Set 即可。

- [ ] **Step 3:** `resetForTesting`

清空新 Set。

- [ ] **Step 4: Verify**

`pnpm --filter @sfmc-bds/sdk build`  
手动推理两条路径：冷启动 `afterWorldLoad:true`（boot 无 init → worldLoad 一次 init）；若测试里先设 `worldLoaded` 再 `bootModule`（单次 init，不双跑）。

---

### Task 5: `permission` 不再直达 `internal/`

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/sapi/runtime/permission.ts`

- [ ] **Step 1: 改 import**

```ts
import { ConfigManager } from "../../module-loader/index.js";
```

（包内相对公开 barrel；不要 `@sfmc-bds/sdk/module-loader` 字符串，避免自引用解析歧义——若仓库惯例是 package name 且已验证可用，可二选一，但**禁止** `internal/config-manager`。）

- [ ] **Step 2: Verify**

确认无环：`module-loader` → 不 import `permission.ts`。  
`rg "module-loader/internal" modules/sdk/@sfmc-sdk/src/sapi` → 0。

---

### Task 6: 删死 API / 空选项 / `module-keys` / http 注释

**Files:**

- Modify: `runtime.ts`、`index.ts`、`install.ts`、`data-adapter.ts`、`http-data-adapter.ts`
- Delete: `internal/module-keys.ts`

- [ ] **Step 1: 死 API**

删除（若 Task 1 未删）：`bootTasks`、`guardEvent` 及 `index.ts` 导出。

`install.ts` 删除未使用的：

- `ModuleSurface` 接口
- `InstallOptions.enabledModuleIds`

- [ ] **Step 2:** `ModuleId` **内联**

在 `runtime.ts`：`export type ModuleId = string;`  
删除 `internal/module-keys.ts` 及其 import。

- [ ] **Step 3:** `http-data-adapter` **/** `data-adapter` **注释**

`data-adapter.ts`：改为「由 `module-loader/install` 经 `createHttpDataAdapter` 装配；非独立 package exports 子路径」。

`http-data-adapter.ts`：同样标明 **install 内部实现，未进** `package.json#exports`。

- [ ] **Step 4: Verify**

```bash
rg "module-keys|bootTasks|guardEvent|ModuleSurface|enabledModuleIds|getModules" modules/sdk/@sfmc-sdk/src/module-loader
pnpm --filter @sfmc-bds/sdk build
```

Expected: 无残留；构建通过。

---

### Task 7: 兄弟仓 AdminGUI 跟删

**Files:**

- Modify: `../sfmc-modules/packages/gui/sapi/src/AdminGUI.ts`（相对 ScriptsForMinecraftServer）

- [ ] **Step 1: 去掉** `refreshModules`

`onToggle` 成功 POST 后：

- 不再 `await ConfigManager.refreshModules()`
- 成功文案改为明确「已写入，重启 BDS 后生效」（creative/survival 的 `applyRuntimeState` 可保留——那是 area 连锁，不是 module-loader 热启停）
- Toggle 展示仍读 `ConfigManager.isEnabled`（启动缓存）；若需避免 UI 与缓存立刻不一致：toggle 失败回滚，或成功后提示用户当前进程仍按旧状态运行

推荐文案行为：

```ts
Msg.success(`${name} 已记录为${val ? "启用" : "禁用"}（重启后生效）`, this.player);
```

- [ ] **Step 2: Verify**

在 `sfmc-modules` 对 gui 包 typecheck（按该仓既有脚本）。  
Expected: 无 `refreshModules` 引用。

---

## 验收清单（全部 Task 完成后）

- [ ] SDK build / typecheck 通过
- [ ] `modules/sdk/@sfmc-sdk` 内无：`reconcile`、`snapshotEnabled`、`refreshModules`、`onModuleEnabledChange`、`trackCleanup`、`trackCommand`、`trackSystemRun`、`bootTasks`、`guardEvent`、`module-keys`
- [ ] `install` 正确调用真正的 `announceLoaded`；无 setModuleGuard 接线与虚假头注释
- [ ] `permission.ts` 不引用 `internal/`
- [ ] `afterWorldLoad` 路径不会双 `init`
- [ ] `AGENTS.md` / architecture 描述冷启动 only
- [ ] AdminGUI 不再调用 `refreshModules`

---

## 建议提交粒度

1. Task 1–2（删热启停 + 文档）
2. Task 3–6（announce / afterWorldLoad / permission / 死面）
3. Task 7（sfmc-modules，若该仓独立 git 则单独提交）

---

## Handoff

计划已写入 `docs/superpowers/plans/2026-09-02-module-loader-cold-boot-cleanup.md`。

请选择执行方式：

1. **Subagent-Driven** — 每 Task 一个子代理 + 审查（推荐）
2. **Inline Agent** — 本会话按 Task 顺序直接改
3. **Stop** — 你稍后自己跑

