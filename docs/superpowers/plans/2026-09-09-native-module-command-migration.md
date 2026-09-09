# Native Module Command Migration Implementation Plan

> **For agentic workers:** Prefer subagent-driven-development (task-by-task + reviews).
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有独立模块仓的命令声明迁移到 Bedrock 原生启动期注册模型，并逐仓提交、推送。

**Architecture:** SDK 在 `system.beforeEvents.startup` 中统一注册 `sfmc:` 命名空间；平台命令暴露为 `/sfmc:<command>`，模块命令暴露为 `/sfmc:<moduleId>_<command>`。模块在文件顶层调用 `Command.register`，SDK 统一把原生命令描述渲染为 `描述 - §7模块名`。

**Tech Stack:** TypeScript、Minecraft Bedrock Script API、pnpm/npm workspaces、Git

**Spec:** user-provided requirements

---

### Task 1: 完善 SDK 原生命令模板

**Files:**

- Modify: `modules/sdk/@sfmc-sdk/src/sapi/runtime/command.ts`
- Modify: `modules/sdk/@sfmc-sdk/test/sapi/runtime/command.test.ts`
- Modify: `packages/cli/src/module-pack-build.ts`
- Test: `modules/sdk/@sfmc-sdk/test/sapi/runtime/command.test.ts`

- [x] **Step 1:** 原生命令描述由 SDK 统一输出为 `描述 - §7模块名`；平台命令保持原描述。
- [x] **Step 2:** 让显式 `mod build` 始终重建，避免 SDK 变化被模块指纹缓存错误跳过。
- [x] **Step 3:** 运行 SDK、CLI 相关类型检查和测试。
- [ ] **Step 4:** 在核心仓单独提交并推送。

### Task 2: 迁移有玩家命令的模块

**Files:**

- Modify: `sfmc-module-afk/sapi/src/index.ts`
- Modify: `sfmc-module-chat/sapi/src/index.ts`
- Modify: `sfmc-module-clean/sapi/src/index.ts`
- Modify: `sfmc-module-coop/sapi/src/index.ts`
- Modify: `sfmc-module-data-backup/sapi/src/index.ts`
- Modify: `sfmc-module-gui/sapi/src/index.ts`
- Modify: `sfmc-module-inventory-switcher/sapi/src/index.ts`
- Modify: `sfmc-module-land/sapi/src/index.ts`
- Modify: `sfmc-module-monitor/sapi/src/index.ts`
- Modify: `sfmc-module-online-time/sapi/src/index.ts`
- Modify: `sfmc-module-qq-link/sapi/src/index.ts`

- [x] **Step 1:** 把每个 `Command.register` 移到模块顶层，保持权限、处理器、费用和模块 ID 不变。
- [x] **Step 2:** 更新旧前缀相关注释与测试断言。
- [x] **Step 3:** 逐仓运行类型检查与测试。
- [ ] **Step 4:** 逐仓暂存全部未提交改动，分别提交并推送 `main`。

### Task 3: 清理无命令模块的遗留生命周期钩子

**Files:**

- Modify: `sfmc-module-activity-log/sapi/src/index.ts`
- Modify: `sfmc-module-area/sapi/src/index.ts`
- Modify: `sfmc-module-chat-sounds/sapi/src/index.ts`
- Modify: `sfmc-module-economy/sapi/src/index.ts`
- Modify: `sfmc-module-fly-area/sapi/src/index.ts`
- Modify: `sfmc-module-gamemode-area/sapi/src/index.ts`
- Modify: `sfmc-module-peace-area/sapi/src/index.ts`
- Modify: `sfmc-module-qa/sapi/src/index.ts`
- Modify: `sfmc-module-spawn-protect/sapi/src/index.ts`

- [x] **Step 1:** 删除空的 `registerCommands` 生命周期属性和过时说明。
- [x] **Step 2:** 逐仓运行类型检查与测试。
- [ ] **Step 3:** 逐仓暂存全部未提交改动，分别提交并推送 `main`。

### Task 4: 集成验证

**Files:**

- Inspect: `D:/WorkPlace/SFMC/packs/_build/sfmc-modules/scripts/main.js`
- Inspect: `D:/WorkPlace/SFMC/BDS/worlds/Bedrock level/behavior_packs/sfmc-modules/scripts/main.js`

- [ ] **Step 1:** 使用 dev 脚本强制构建并部署：`sfmc-dev.ps1 mod reload --force`。
- [ ] **Step 2:** 确认构建产物包含 `registerNativeCommands`、`customCommandRegistry` 和模块命令名。
- [ ] **Step 3:** 完整重启 BDS，并确认 `/sfmc:help` 与至少一个模块命令出现在补全列表中。
