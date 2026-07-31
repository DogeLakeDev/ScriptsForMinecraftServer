# SAPI 测试沙箱高保真 — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 `@sfmc-bds/sdk/testing` 以 pin 版 `.d.ts` 为大范围 L0 契约面，并以 ModuleRegistry + 假 Config 对齐 BDS 启动链，把「类型绿、进服才看日志」的故障前移到 `npm test`。

**架构：** 生成器从 `@minecraft/server`/`server-ui` 的 `index.d.ts` 产出 L0 假导出；手写 overrides 提供 L1–L3 语义；`createSandbox` 改为 ConfigManager（内存 DataAdapter）+ ModuleRegistry boot/worldLoad/teardown。minecraft-loader 继续把 `@minecraft/*` 指到假实现。

**技术栈：** Node ≥22.13、TypeScript、TS Compiler API（或等价 `.d.ts` 解析）、`node --test`、现有 `@sfmc-bds/sdk` esbuild 测试包。

**规格：** [../specs/2026-07-31-sfmc-testing-and-extension-design.md](../specs/2026-07-31-sfmc-testing-and-extension-design.md)

---

## 文件结构（预期）

| 路径 | 职责 |
|------|------|
| `modules/sdk/@sfmc-sdk/scripts/gen-mc-fake.mjs`（或 `tools/` 下） | `.d.ts` → L0 骨架生成 |
| `modules/sdk/@sfmc-sdk/src/testing/engine/generated/server.ts` | 生成的 server 导出（可再拆文件） |
| `modules/sdk/@sfmc-sdk/src/testing/engine/generated/server-ui.ts` | 生成的 ui 导出 |
| `modules/sdk/@sfmc-sdk/src/testing/engine/overrides/**` | 手写高保真实现（迁入现有 system/world/player/ui…） |
| `modules/sdk/@sfmc-sdk/src/testing/engine/coverage.ts` | 覆盖率统计（若需运行时） |
| `modules/sdk/@sfmc-sdk/src/testing/host/memory-data-adapter.ts` | 内存 DataAdapter |
| `modules/sdk/@sfmc-sdk/src/testing/sandbox.ts` | createSandbox 改宿主路径 |
| `modules/sdk/@sfmc-sdk/src/testing/lifecycle.ts` | 删除或降为内部/测试专用 |
| `modules/sdk/@sfmc-sdk/src/testing/minecraft-loader.mjs` | resolve 到生成+overrides 入口 |
| `modules/sdk/@sfmc-sdk/conformance.test.mjs` / `testing.test.mjs` | 门禁与宿主用例 |
| `docs/dev/testing.md` | 作者文档 |
| `.changeset/*.md` | SDK minor/patch 说明 |

---

### 任务 1：基线与文档锚点

**文件：**
- 修改：`docs/dev/testing.md`
- 参考：`docs/superpowers/specs/2026-07-31-sfmc-testing-and-extension-design.md`

- [ ] **步骤 1：** 在 `testing.md` 增加「保真层级 L0–L3」「非目标」「与 BDS 日志分工」三小节（中文、对齐 style-sample）
- [ ] **步骤 2：** 记录当前 `npm run test -w @sfmc-bds/sdk` 通过数作为基线
- [ ] **步骤 3：** Commit（若用户要求）：`docs(testing): 沙箱高保真规划锚点`

---

### 任务 2：`.d.ts` 导出枚举（生成器 MVP）

**文件：**
- 创建：`modules/sdk/@sfmc-sdk/scripts/gen-mc-fake.mjs`
- 创建：`modules/sdk/@sfmc-sdk/scripts/gen-mc-fake.test.mjs`（或 `src/testing/gen/*.test.ts`）
- 修改：`modules/sdk/@sfmc-sdk/package.json`（script `gen:mc-fake`）

- [ ] **步骤 1：** 写失败测试：给定迷你 `.d.ts` fixture，应列出 class/enum/function 名
- [ ] **步骤 2：** 跑测试确认失败
- [ ] **步骤 3：** 用 TS compiler API 实现枚举（先 server 单文件）
- [ ] **步骤 4：** 测试通过
- [ ] **步骤 5：** 对真实 `node_modules/@minecraft/server/index.d.ts` dry-run 打印导出数量

---

### 任务 3：L0 代码生成 + 硬失败

**文件：**
- 创建：`modules/sdk/@sfmc-sdk/src/testing/engine/generated/server.ts`（生成）
- 修改：`scripts/gen-mc-fake.mjs`（emit）
- 修改：`engine/allowlist.ts` 或生成内联抛错

- [ ] **步骤 1：** 约定：生成类方法体为 `throw new UnimplementedMinecraftApiError("…")`
- [ ] **步骤 2：** 生成 enum 为真实字符串/数字字面量（从 `.d.ts` 读）
- [ ] **步骤 3：** `npm run gen:mc-fake` 写出文件
- [ ] **步骤 4：** 单测：`import { SomeRareExport }` 存在；调用未实现方法抛错且 message 含路径
- [ ] **步骤 5：** Commit（若要求）

---

### 任务 4：loader 接线 + overrides 迁入

**文件：**
- 修改：`minecraft-loader.mjs`、`mc-bridge-server.ts`、`mc-bridge-ui.ts`
- 移动：现有 `system.ts`/`world.ts`/`player.ts`/`ui.ts` → `overrides/`
- 修改：`runtime.ts` 组合 generated + overrides

- [ ] **步骤 1：** 设计合并策略：overrides 同名导出覆盖 generated
- [ ] **步骤 2：** 接线 loader，跑现有 conformance —— 先红再修至全绿
- [ ] **步骤 3：** template / testing.test 全绿
- [ ] **步骤 4：** 删除重复的纯手写顶层导出表（避免双真相）

---

### 任务 5：覆盖率 CI 门禁

**文件：**
- 创建：`modules/sdk/@sfmc-sdk/src/testing/engine/export-coverage.test.mjs`（或 scripts 测）
- 修改：SDK `package.json` test 脚本、根 CI 若需

- [ ] **步骤 1：** 测试：导出覆盖率 &lt; 阈值则 fail（先用阈值 0.5 验证逻辑）
- [ ] **步骤 2：** 调到规格阈值（默认 0.95）并在真实生成物上通过
- [ ] **步骤 3：** CI：`gen:mc-fake` 后 `git diff --exit-code`（若采用提交生成物策略）

---

### 任务 6：内存 DataAdapter + 宿主 createSandbox

**文件：**
- 创建：`src/testing/host/memory-data-adapter.ts`
- 修改：`src/testing/sandbox.ts`
- 修改：`src/testing/lifecycle.ts`（删除或标内部）
- 修改：`testing.test.mjs` / `conformance.test.mjs`

- [ ] **步骤 1：** 失败测试：`afterWorldLoad: true` 的模块在 createSandbox 后 `init` 已跑（经假 worldLoad）
- [ ] **步骤 2：** 失败测试：`enabled: false` 时不 registerCommands
- [ ] **步骤 3：** 实现 MemoryDataAdapter + sandbox 走 ConfigManager.init → bootAll → worldLoad → bootAfterWorldLoad
- [ ] **步骤 4：** dispose → teardown + 清 Command/Permission
- [ ] **步骤 5：** 删除默认路径对旁路 `runLifecycle` 的依赖（无兼容别名）
- [ ] **步骤 6：** 全量 SDK testing 绿

---

### 任务 7：作者文档 + changeset + 模板例

**文件：**
- 修改：`docs/dev/testing.md`、`docs/dev/module-author.md`
- 修改：`sfmc-module-template/test/example.test.ts`（若 API 微调）
- 创建：`.changeset/testing-sandbox-fidelity.md`

- [ ] **步骤 1：** 文档写清 L0 硬失败 vs 断言失败、Watch 分工
- [ ] **步骤 2：** changeset：`@sfmc-bds/sdk` minor（行为变化）
- [ ] **步骤 3：** 跑 template `npm test`（若本地链得到 workspace SDK）

---

### 任务 8：L2 第一批加深（可选同 PR 或后续）

**文件：** `overrides/` 下按专题

- [ ] **步骤 1：** 选定批次（建议：事件 emit 辅助 + Player 字段对齐 `.d.ts`）
- [ ] **步骤 2：** TDD 行为用例
- [ ] **步骤 3：** 更新 testing.md「已实现语义」表

---

## 执行顺序建议

`1 → 2 → 3 → 4 → 5`（B′ 可测）然后 `6 → 7`（A 宿主）；`8` 持续迭代。

## 完成定义

- [ ] 规格 §6 阶段 1、2 验收句可演示
- [ ] SDK testing + conformance CI 绿
- [ ] 文档与 changeset 齐全
- [ ] 用户审阅规格 §11 决策点无未决项
