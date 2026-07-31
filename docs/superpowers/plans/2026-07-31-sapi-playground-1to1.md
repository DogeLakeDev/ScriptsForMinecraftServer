# SFMC 沙箱 / Playground SAPI 1:1 映射实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 第一轮在 `@sfmc-bds/sdk/testing` + Playground 宿主上对 pin 版 SAPI 做 **构造对象 / 操作对象 / 事件触发** 三块 1:1 表面映射（无最小集裁剪）；未实现语义保持 L0 硬失败。

**架构：** 从 `.d.ts` 生成元数据（属性/方法/事件 hub）；沙箱提供 `objects.create` / `objects.call` / `events.emit`；扩展 Webview 只消费元数据 + RPC。L0 gen 已有声明面，本计划补 **可驱动面**（创建入口、统一 call、全信号 emit）。

**技术栈：** TypeScript、现有 `gen-mc-fake.mjs`、esbuild、VS Code extension webview、`createSandbox`。

**规格：** [../specs/2026-07-31-sfmc-module-extension-design.md](../specs/2026-07-31-sfmc-module-extension-design.md)、[../notes/script-api-native-map.md](../notes/script-api-native-map.md)

---

## 文件职责

| 路径 | 职责 |
|------|------|
| `modules/sdk/@sfmc-sdk/scripts/gen-mc-fake.mjs`（或 `gen-playground-meta.mjs`） | 从 `.d.ts` 产出 class 属性/方法 + Event hub 元数据 JSON |
| `modules/sdk/@sfmc-sdk/src/testing/engine/generated/*-meta*.ts` | 生成物（提交 + CI diff） |
| `modules/sdk/@sfmc-sdk/src/testing/objects.ts` | `create` / `call` / 实例登记 |
| `modules/sdk/@sfmc-sdk/src/testing/events-drive.ts` | 全 hub `emit(signal, payload)` |
| `modules/sdk/@sfmc-sdk/src/testing/sandbox.ts` | 挂上 `sb.objects` / `sb.events` |
| `modules/sdk/@sfmc-sdk/testing-objects.test.mjs` 等 | 契约测试 |
| `extensions/sfmc-module/src/playground/*` | host 进程 + webview + RPC |
| `docs/dev/testing.md` | 作者向：1:1 与 L0 硬失败说明 |

---

### 任务 1：生成元数据（class + events）

**文件：**
- 修改：`modules/sdk/@sfmc-sdk/scripts/gen-mc-fake.mjs`（或新建 gen 脚本并接入 package.json）
- 创建：`src/testing/engine/generated/type-members.json`（或 .ts）
- 创建：`src/testing/engine/generated/event-hubs.json`

- [x] **步骤 1：** 写失败测试：元数据含 `Player` 可写/方法名、`WorldAfterEvents.playerJoin` 等  
- [x] **步骤 2：** 解析 pin `@minecraft/server/index.d.ts`，导出目标 class（Player/Entity/ItemStack/Block/Dimension/…）成员与四大 hub 信号  
- [x] **步骤 3：** `npm run gen:mc-fake`（或新脚本）生成并提交；CI 已有 generated diff 则纳入  
- [ ] **步骤 4：** Commit  

---

### 任务 2：`sb.objects` 构造 + 调用

**文件：**
- 创建：`src/testing/objects.ts`
- 修改：`sandbox.ts`、`player.ts` / `entity.ts` / `inventory.ts` / `dimension.ts`（属性袋写入）
- 测试：`testing-objects.test.mjs`

- [x] **步骤 1：** 失败测试：`create('ItemStack', { typeId, amount })`；`create('Player', { name })`；`call(id, 'sendMessage', ['hi'])`  
- [x] **步骤 2：** 实现实例表 + create 分派（对齐 SAPI 入口）+ call 反射到实例方法（无则 L0）  
- [x] **步骤 3：** 属性袋：对元数据中的可写字段赋值；只读跳过  
- [ ] **步骤 4：** 测试通过 + Commit  

---

### 任务 3：`sb.events` 全信号 emit

**文件：**
- 创建：`src/testing/events-drive.ts`
- 修改：既有 event bus / `sb.emit` 收敛或委托  
- 测试：对每个 hub 信号至少 `emit` 不静默（有订阅可收到或无订阅也成功）

- [x] **步骤 1：** 失败测试：元数据中每个 `world.afterEvents.*` 可 `events.emit('world.afterEvents.playerJoin', payload)`  
- [x] **步骤 2：** 实现按路径派发到 FakeWorld/FakeSystem 信号；payload 缺省用空/占位  
- [x] **步骤 3：** `kill`/`spawnEntity` 等 L2 方法路径确认仍自动发事件  
- [ ] **步骤 4：** Commit  

---

### 任务 4：Playground host + 最小 Webview

**文件：**
- 创建：`extensions/sfmc-module/src/playground/host.ts`、`webview/*`、RPC  
- 修改：`extension.ts`、`package.json` commands  
- 依赖：workspace `@sfmc-bds/sdk/testing`

- [x] **步骤 1：** host 启动 `createSandbox`，暴露 meta / create / call / emit JSON-RPC  
- [x] **步骤 2：** Webview 三栏：构造（按 meta 动态表单）/ 操作（方法列表）/ 事件（hub 树）  
- [x] **步骤 3：** 系统日志频道；生命周期进度按总图  
- [ ] **步骤 4：** F5 手测 + Commit  

---

### 任务 5：路径修复 + 文档

**文件：**
- 重写：`extensions/sfmc-module/src/panels/*` 有效模块根 / `sfmc.root` 选目录  
- 修改：`docs/dev/testing.md`、`module-author.md`（维度表 + 1:1 说明）

- [ ] **步骤 1：** 模块根 / sfmc.root 按扩展规格实现（无猜主仓）  
- [ ] **步骤 2：** testing.md 写清 1:1 与 L0 硬失败  
- [ ] **步骤 3：** Commit  

---

## 验收

1. 元数据覆盖 pin d.ts 中约定 class 与全部 world/system 事件信号  
2. Playground 可构造四类对象、可调任意列出方法、可 emit 任意 hub 信号  
3. 未实现方法调用出现 `UnimplementedMinecraftApiError`（或同等）  
4. Watch/Reload 不猜 `sfmc.root`；快捷糖未做可接受  

## 非目标（本计划）

快捷创建、每玩家聊天糖、Enable/Disable、Marketplace、BDS 原生断点、为每个 L0 方法补齐真语义。
