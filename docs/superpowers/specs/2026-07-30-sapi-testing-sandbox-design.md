# SAPI 测试沙箱高保真规划

**日期：** 2026-07-30  
**状态：** 草案（待审）  
**范围：** `@sfmc-bds/sdk/testing` + 假 `@minecraft/*` + 宿主启动链  
**非目标：** 真 BDS / GameTest 轨（可预留）、Levi 反编译入库

---

## 1. 要解决什么问题

模块作者当前路径：

```text
tsc / IDE 全绿
  → 进 BDS
  → 翻日志才知道运行时哪错了
```

类型系统只保证签名；真机保证完整世界语义。中间缺一层：**可本地复现、带堆栈的运行时**。

成功标准（产品句）：

> 同类故障优先在 `npm test` 以断言或硬失败暴露，且堆栈落在作者模块源码，而不是先依赖 BDS 日志。

能补上的：API 运行时不可用/未实现、startup vs worldLoad 顺序、命令/`Msg`/事件/表单/定时器、配置与模块开关、init 鉴权上下文。  
补不全的：物理/红石/区块、客户端手感、某小版本 BDS 独有 quirk（假引擎可能假绿/假红）。

---

## 2. 约束与事实

| 事实 | 含义 |
|------|------|
| `@minecraft/server` npm 只有 `index.d.ts` | 无 JS 源码可移植；契约 = `.d.ts` + 文档/观察行为 |
| BDS 引擎不开源 | 完整游戏逻辑无合法源码 |
| LeviLamina `mc/scripting/` | **只读对照**：官方 Script 绑定面逆向头（事件表/startup 分相线索）；**不入库、不生成代码自 Levi** |
| Levi `ll/api` 事件 | 平行插件 API，≠ `world.afterEvents`；仅作「世界上会发生什么」的次要参考 |
| 作者模块种类少 | 「按现有 import 扩 API」覆盖永远偏窄 → 必须 **大范围声明面覆盖** |
| 已有基础 | `createSandbox`、allowlist 硬失败、system/world/player/ui/scoreboard 薄实现、假 DB |

版本钉扎：与模板一致的 `@minecraft/server` / `server-ui`（当前如 `2.10.0-beta.1.26.40-preview.30`），升级须重跑生成与覆盖率门禁。对照 Levi 头时须锁定同代 BDS dump，并在映射笔记中注明三方版本。

---

## 3. 总体架构

两条并行线 + 一条对照轨，共用同一假引擎进程态：

```text
┌─────────────────────────────────────────────────────────────┐
│  node --test + minecraft-loader                              │
│                                                              │
│  线 B′  大范围 API 面                                         │
│    .d.ts → 生成器 → 假模块导出（L0 骨架 / L1–L3 语义）         │
│    未实现方法 → UnimplementedMinecraftApiError               │
│                                                              │
│  线 A   宿主启动链                                            │
│    假 startup → ConfigManager.init(内存 DataAdapter)         │
│    → ModuleRegistry.bootAll → snapshot                       │
│    假 worldLoad → bootAfterWorldLoad                         │
│    dispose → teardown                                        │
│                                                              │
│  线 R   Scripting 对照（只读，不入库）                         │
│    Levi mc/scripting 头 → 自有映射笔记 → 指导 L2 优先级        │
│                                                              │
│  作者 API：createSandbox({ module, configs?, enabled? … })   │
└─────────────────────────────────────────────────────────────┘
```

原则：

1. **诚实优于假绿**：未实现必抛；禁止空 `return undefined` 装作成功。  
2. **契约单一权威**：公开导出来自 pin 版本 `.d.ts`，不手写第二份导出表。  
3. **语义分层填**：先全表面可 import，再按专题加深；L2 批次优先参考线 R 事件表。  
4. **宿主走真 Registry**：废弃「旁路只调 hooks」作为默认路径（直接删除旁路默认，不留兼容）。  
5. **Levi 边界**：只读 `mc/scripting`；不拷贝头文件进仓；不从 Levi 生成 TS。

---

## 4. 线 B′：大范围 API 覆盖

### 4.1 语义层级

| 层级 | 含义 | 作者体验 |
|------|------|----------|
| **L0** | 导出存在；方法/属性访问未实现则硬失败 | `import` 不炸；误用立刻红 |
| **L1** | 枚举/常量/无状态 getter 合理默认 | 少数字面量路径可跑通 |
| **L2** | 有状态、可断言（Player、System tick、事件、UI、Scoreboard…） | 主测路径 |
| **L3** | 高成本（Dimension 方块、Entity、Container、结构…） | 专题批次 |

「大范围覆盖」在 v1 = **L0 对 pin 版本公开导出达标**（见 §6），不是 L3 假世界。

### 4.2 生成器（建议）

- 输入：`node_modules/@minecraft/server/index.d.ts`（及 ui）  
- 输出：`modules/sdk/@sfmc-sdk/src/testing/engine/generated/`（或 `dist` 旁路生成物，需可复现）  
- 行为：为 class/enum/function/变量生成同名导出；类方法默认抛带路径的 `UnimplementedMinecraftApiError`  
- 手写 **overrides** 目录覆盖生成物中已实现的 L1–L3（生成器不覆盖 overrides）  
- 命令：如 `npm run gen:mc-fake -w @sfmc-bds/sdk`；CI 校验「生成结果与提交物一致」或「每次 CI 生成」二选一（推荐提交生成物 + CI diff，便于审）

### 4.3 覆盖率门禁

- 统计 `.d.ts` 顶层导出 vs 假模块实际导出  
- 阈值：v1 目标 **≥95% 顶层导出**（余量留给极端类型-only / 条件类型）；方法级 L0 覆盖在生成器内默认满足  
- 版本 bump：更新 pin → 重生成 → 门禁不过则红

### 4.4 与现有手写引擎关系

- 现有 `runtime` / `system` / `world` / `player` / `ui` 升为 **overrides**  
- allowlist 代理可逐步改为「生成面 + overrides 标记已实现」；过渡期两者并存，避免双份真相过久（目标：一两个迭代后 allowlist 由生成元数据驱动）

---

## 5. 线 A：宿主启动保真

### 5.1 目标流程（对齐真机）

```text
createSandbox({ module, configs?, enabled? })
  resetEngine + 注入 __sfmcBdsSystem
  bindDataAdapter(内存实现) + 可选 bindModuleAuthHooks(测试桩)
  ConfigManager.init()          // 不再跳过
  ModuleRegistry.register(module) // 若尚未注册
  ModuleRegistry.bootAll()      // register* + 条件 init
  snapshotEnabled()
  emit 假 worldLoad
  ModuleRegistry.bootAfterWorldLoad()
  返回 Sandbox 句柄

dispose:
  ModuleRegistry.teardown() / cleanupModule
  清 Command/Permission（范围：本沙箱注册的，避免误伤并行测试则单测串行或隔离全局）
  disposeEngine
```

### 5.2 内存 DataAdapter

提供 `configs/all` 形状的 JSON：`modules`（含 enabled）、`module_tokens`、`settings`、`permissions`。  
作者可 `createSandbox({ configs: {...}, enabled: true })` 覆盖。

### 5.3 afterWorldLoad

- 默认：先 boot 非延迟模块；再假 worldLoad；再延迟 init  
- 不再依赖「调用方必须传 `afterWorldLoad: true` 才 init」的旁路语义（旧 `runLifecycle` 行为视为 deprecated）

### 5.4 仍不模拟

- 真 HttpDB / 真 db-server（可用 stub service；可选后续「连 live db」模式，非 v1）  
- `installHostBootstrap` 全量 Sentry 等副作用（可 noop）

---

## 6. 分阶段交付

### 阶段 0 — 规格冻结与基线（0.5–1 天）

- 本文审阅通过  
- 固定 pin 版本；记录当前 conformance / testing 用例清单  
- 文档 `docs/dev/testing.md` 增加「保真层级 / 非目标」

### 阶段 1 — 生成器 + L0 门禁（核心，约 3–5 天）

1. 解析 `.d.ts` 的 MVP（可用 TS compiler API）  
2. 生成 server（先）与 server-ui（后）骨架  
3. loader 切到生成入口 + overrides  
4. 覆盖率测试进 CI  
5. 回归：现有 conformance / template 示例仍绿  

**验收：** 随机抽 `.d.ts` 中未手写过的符号可 import；调用未实现方法抛错且含 API 路径。

### 阶段 2 — 宿主线 A（约 2–4 天）

1. 内存 DataAdapter + 测试用 auth hooks  
2. `createSandbox` 改走 ConfigManager + ModuleRegistry  
3. 假 `startup` / `worldLoad` 分相  
4. 用例：`afterWorldLoad`、disabled 模块不 boot、dispose teardown  
5. 更新 template 示例与 testing 文档  

**验收：** 故意写错 boot 顺序或读未注入配置的模块在 `npm test` 失败，堆栈在模块源码。

### 阶段 3 — 线 R 映射 + L2 加深（持续）

1. 事件流程权威图：`docs/superpowers/notes/script-api-native-map.md`（**已锁定**；Playground/沙箱分相与 emit 对齐）  
2. L2 批次按总图扇出域（非作者 import、非 Levi 内部步骤）：

建议批次：

1. 生命周期有序段（startup / worldLoad / shutdown + SFMC 子步）— 已基本具备  
2. 运行期：玩家 + 聊天/`chatSend` + `scriptEventReceive`（Playground v1）  
3. 玩家交互 / 物品 / 实体 / 方块机关 / 世界杂项 — 按模块常用分批  
4. Scoreboard / Dimension / Inventory / server-ui 等支撑状态（已有则维护）

每批：总图/清单勾选 + 行为单测 + testing 文档。争议：Learn/真机 > Levi。

### 阶段 4 — 作者体验与治理（约 1–2 天）

- VS Code Testing / SFMC Module 文档指向新保真说明  
- changeset、CHANGELOG  
- （可选）`sb.supported` 改为读生成元数据  
- （可选）预留 GameTest 轨目录与文档链接，不实现

### 阶段 5 — 可选增强（排期外）

- live db-server DataAdapter  
- 多模块同沙箱  
- 与真机日志对照的抽检表（人工）  
- server-net / admin / diagnostics 生成 L0

---

## 7. 测试与 CI 策略

| 层 | 内容 |
|----|------|
| 单元 | 生成器纯函数、覆盖率计算、DataAdapter、Registry boot 分支 |
| Conformance | 现有 tick/事件/命令/UI + 新增宿主分相 |
| 模板 | `sfmc-module-template` `npm test` 仍为作者样板 |
| CI | SDK `testing` + `conformance` + 生成物/覆盖率；不启 BDS |

TDD：每批 L2 / 每个宿主行为先红后绿。

---

## 8. 文档与对外话术

- `docs/dev/testing.md`：能测/不能测、L0–L3、与 Watch 分工  
- 模块开发页：先 `npm test` 再 Watch  
- 明确：**全表面 ≠ 假 BDS**；进服仍是终检

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 生成器解析 `.d.ts` 边角失败 | MVP 覆盖 export 形态；失败 CI 红并人工补 |
| 全局 ModuleRegistry / Command 污染并行测试 | 文档要求串行；dispose 强清理；必要时 `node --test` 分文件 |
| L0 硬失败被当成「真机也会挂」 | 文档区分「沙箱未实现」与「断言失败」错误名/文案 |
| 生成物体积大 | 仅生成测试用入口；不打进 SAPI BP bundle |
| 版本升级成本 | pin 与模板同步；升级 checklist 进 publish/contributing |

---

## 10. 决策记录（已共识）

- 不做「按作者模块 import 扩」为主策略 → **大范围 L0**  
- Levi：**只读** `mc/scripting` 作机制线索；**不入库、不生成代码自 Levi**；`ll/api` 不作 Script 权威  
- 对照物主链 = pin 版 `.d.ts` + Learn/观察；线 R 指导 L2 优先级  
- 目标痛点 = 把「进游戏看日志」前移到 `npm test`  
- 宿主保真与 API 大覆盖都要；交付：**先生成器门禁，再宿主 A，再按线 R 加深 L2**  
- 生成物提交 git + CI diff；L0 覆盖率阈值 **95%**  
- 旁路 `runLifecycle` 默认路径 **删除**（不留兼容）

---

## 11. 审阅状态

§11 原悬念已关闭（见 §10）。实现见 `plans/2026-07-30-sapi-testing-sandbox.md` 与 Cursor plan「Levi Scripting Fidelity」。
