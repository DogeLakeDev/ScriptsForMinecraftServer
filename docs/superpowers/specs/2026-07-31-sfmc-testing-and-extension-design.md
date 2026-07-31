# SFMC 测试沙箱与 Module 扩展设计

**日期：** 2026-07-30 / 2026-07-31（合并整理）  
**状态：** 已审（实现进行中）  
**范围：** `@sfmc-bds/sdk/testing` 假引擎与宿主启动链；`extensions/sfmc-module` 作者工具与 Playground 宿主消费面  
**非目标：** 真 BDS / GameTest 轨、Levi 反编译入库、Marketplace、Enable/Disable、扫主仓 `modules/packages`、完整假 BDS  
**对照：** [script-api-native-map.md](../notes/script-api-native-map.md)  
**UI 主路径：** [2026-07-31-sfmc-script-sandbox-ui-design.md](./2026-07-31-sfmc-script-sandbox-ui-design.md)（脚本沙箱 / sapi-sandbox）

> 本文合并原《SAPI 测试沙箱高保真规划》与《SFMC Module 扩展重写设计》。引擎保真与扩展消费面放在同一规格，避免两套口径。

---

## 1. 要解决什么问题

### 1.1 测试沙箱

```text
tsc / IDE 全绿 → 进 BDS → 翻日志才知道运行时哪错了
```

> 类型系统只保证签名；真机保证完整世界语义。中间缺一层：**可本地复现、带堆栈的运行时**。

成功标准：

> 同类故障优先在 `npm test` 以断言或硬失败暴露，且堆栈落在作者模块源码，而不是先依赖 BDS 日志。

能补上的：API 运行时不可用/未实现、startup vs worldLoad 顺序、命令 / `Msg` / 事件 / 表单 / 定时器、配置与模块开关、init 鉴权上下文。  
补不全的：物理 / 红石 / 区块、客户端手感、某小版本 BDS quirk（假引擎可能假绿 / 假红）。

### 1.2 Module 扩展

现有扩展常见缺陷：Watch 盯错模块、`sfmc.root` 静默回退、启停半成品、与 CLI / `devkit` 漂移。

成功标准：

> 作者单独打开模块仓，用脚本沙箱验证模块行为，用 Watch / Reload 联调真机；路径与重建逻辑与 `devkit` 同源，不再猜主仓。

作者默认不必手写 `node:test`；手写测试为可选增强。

---



## 2. 约束与决策摘要


| 决策             | 选择                                                                           |
| -------------- | ---------------------------------------------------------------------------- |
| API 覆盖策略       | **大范围 L0**（非「按作者 import 扩」）                                                  |
| 契约权威           | pin 版 `@minecraft/server` / `server-ui` `.d.ts`；生成 `PLAYGROUND_META` / 假导出   |
| 未实现 API        | `UnimplementedMinecraftApiError` 硬失败；禁止空成功                                   |
| Levi           | 只读 `mc/scripting` 作机制线索；**不入库、不生成代码自 Levi**                                  |
| 宿主路径           | `createSandbox` 走真 `ConfigManager` + `ModuleRegistry`；删除旁路 `runLifecycle` 默认 |
| 扩展路线           | 薄扩展 + 厚 `devkit` / SDK testing                                               |
| 主工作区           | 单独打开模块仓；`sfmc.root` 指向 SFMC 工作目录（含 `configs/`、`modules/`）              |
| `sfmc.root` 缺失 | Watch / Reload 时选目录，写入 Workspace 设置后继续                                       |
| 测试主路径          | IDE 脚本沙箱 + 一键冒烟；非强制 `npm test`                                               |
| 断点             | 「启动并调试」（Node + source map）；目标主要是模块 `sapi/src`                                |
| 启停             | 第一版不做                                                                        |
| SAPI 1:1（第一轮）  | 构造对象 / 操作对象 / 事件触发 — **无最小集裁剪**                                              |


版本钉扎与模板一致；升级须重跑生成与覆盖率门禁。

---



## 3. 总体架构

```text
┌─ VS Code / Cursor (extensions/sfmc-module) ───────────────┐
│  路径 │ Tree │ 脚本沙箱 Webview │ 命令 │ 状态栏              │
│  debug → playground-host                                  │
└─────────────┬───────────────────────────┬─────────────────┘
              │                           │
              ▼                           ▼
┌─ playground-host ─────────┐  ┌─ @sfmc-bds/devkit ─────────┐
│  createSandbox / RPC      │  │  scaffold / Watch / Deploy  │
│  objects.* / events.*     │  │  resolveModuleRoot（权威） │
└─────────────┬─────────────┘  └────────────────────────────┘
              ▼
┌─ @sfmc-bds/sdk/testing ───────────────────────────────────┐
│  线 B′  .d.ts → 生成 L0 + overrides（L1–L3）               │
│  线 A   假 startup → ConfigManager → boot → worldLoad     │
│  线 R   Levi 只读对照 → 指导 L2 优先级（不入库）            │
└───────────────────────────────────────────────────────────┘
```

**DIP：** 模块根判定、SFMC 根约定、重建部署只在 `devkit`（或 SDK）一处；扩展只做 VS Code UI 与进程生命周期。假引擎不在扩展内再实现。

---



## 4. 线 B′：大范围 API 覆盖



### 4.1 语义层级


| 层级     | 含义                     | 作者体验              |
| ------ | ---------------------- | ----------------- |
| **L0** | 导出存在；未实现则硬失败           | `import` 不炸；误用立刻红 |
| **L1** | 枚举 / 常量 / 无状态默认        | 少数字面量路径可跑通        |
| **L2** | 有状态、可断言                | 主测路径              |
| **L3** | 高成本（方块 / Entity / 结构…） | 专题批次              |


v1「大范围」= **L0 对 pin 公开导出达标**，不是 L3 假世界。

### 4.2 生成器与门禁

- 输入：`node_modules/@minecraft/server/index.d.ts`（及 ui）  
- 输出：`modules/sdk/@sfmc-sdk/src/testing/engine/generated/`  
- 手写 **overrides** 覆盖已实现语义；生成器不覆盖 overrides  
- 覆盖率：顶层导出 **≥ 95%**；生成物提交 git + CI diff  
- 现有 runtime / system / world / player / ui 升为 overrides



### 4.3 SAPI 1:1 三块（Playground / objects 共用）


| 块        | 行为                                                                  |
| -------- | ------------------------------------------------------------------- |
| **构造对象** | 属性袋 = d.ts 可写字段；入口对齐 SAPI；World / Dimension **不经** `create`（沙箱天生登记） |
| **操作对象** | 全部 method 可调；L2 有语义 / 否则 L0                                         |
| **事件触发** | 全部 hub 信号可 emit；payload 按 Event 类型属性袋                               |


元数据权威：`PLAYGROUND_META`。计划见 [../plans/2026-07-31-sapi-playground-1to1.md](../plans/2026-07-31-sapi-playground-1to1.md)。

---



## 5. 线 A：宿主启动保真

```text
createSandbox({ module, configs?, enabled? })
  resetEngine + 注入 __sfmcBdsSystem
  bindDataAdapter(内存) + 可选 auth hooks
  ConfigManager.init()
  ModuleRegistry.register + bootAll + snapshotEnabled
  假 worldLoad → bootAfterWorldLoad
  返回 Sandbox

dispose → teardown / cleanup → disposeEngine
```

内存 DataAdapter 提供 `configs/all` 形状。默认先 boot 非延迟模块，再假 worldLoad，再延迟 init。

**仍不模拟：** 真 HttpDB（可用 stub）；全量 Sentry 等副作用可 noop。

---



## 6. 世界模拟维度（沙箱 + Playground 共用）

「全表面 ≠ 假 BDS」。


| ID  | 维度        | 含义                               | 沙箱     | 脚本沙箱 UI   |
| --- | --------- | -------------------------------- | ------ | --------- |
| H   | 宿主分相      | ConfigManager → boot → worldLoad | 有      | 进度 / 重置   |
| S   | System    | run / tick / flush               | 有      | Tick 节点   |
| W   | World     | 假 world                          | 薄      | 场景坞只读     |
| D   | Dimension | 默认三维可查；无物理                       | 部分 L2  | 场景坞只读     |
| P   | 玩家        | 名、OP、位置、Msg…                     | 有      | 图节点 / 场景  |
| E   | 实体        | spawn / query…                   | 部分 L2  | 场景 / 后置节点 |
| I   | 物品栏       | ItemStack / Container            | 有      | 后置        |
| C   | 聊天 → 命令   | `chatSend` → `!`                 | emit 有 | Emit 节点   |
| V   | 事件对象      | 属性袋 + emit                       | 有      | Emit 表单   |
| U   | UI        | 表单 + queueResponse               | 有      | 后置        |
| B   | 记分板       | objective / score                | 有      | 后置        |
| M   | 模块宿主      | Registry / Permission / Msg      | 有      | boot / 冒烟 |
| N   | DB        | 内存假 DB                           | 有      | 默认        |


**永不模拟：** 完整物理、红石、流体、AI、区块生成语义、客户端渲染、BDS 原生断点。

作者可见文档须同步：`docs/dev/testing.md`、`docs/dev/module-author.md`。

---



## 7. Module 扩展



### 7.1 路径解析

**有效模块根：** `package.json` + `sapi/manifest.json`（`schemaVersion === 2`，非空 `id`）。

发现顺序：活动编辑器向上找 → 各 workspaceFolder 自身 → **不**递归扫子目录、**不**扫 `sfmc.root/modules/packages/`*。多个则 Tree 全列 / QuickPick；零个则提示打开模块根。

`sfmc.root`**：** 仅 Watch / Reload 需要；缺失则选文件夹写入 Workspace。脚本沙箱 / New Module **不依赖**它。

### 7.2 Playground 宿主（消费面）

- 加载当前 `moduleRoot` → `createSandbox`；同时仅一个会话  
- JSON-RPC：`meta` / `start`(=重置) / `objects.*` / `events.*` / `tick` / `scene.summary`  
- 开面板即沙箱；UI 布局与运行模型见 [脚本沙箱 UI](./2026-07-31-sfmc-script-sandbox-ui-design.md)  
- 「启动并调试」：`debug.startDebugging` → playground-host + source map

**分相进度（宿主 emit，UI 勾选）：** 原生层（System / World / `startup` / `worldLoad`）与 SFMC 层（ConfigManager / ModuleRegistry）必须分标，避免把宿主步骤写成 BDS 内置。细节对齐 [architecture.md](../../dev/architecture.md) 与映射笔记。

**日志频道：** 系统频道 ≈ BDS 控制台；玩家回显按玩家路由（广播可进系统 + 各在线玩家）。扩展 OutputChannel 可镜像系统频道。

**冒烟：** `SFMC: Run Module Tests` = 对已注册命令走 `!name` + `chatSend`；不 spawn `npm test` 作主路径。禁止扩展直接 `triggerCommand` 作手点主路径。

### 7.3 其它命令与 Tree


| 命令                 | 行为                                    |
| ------------------ | ------------------------------------- |
| New Module         | scaffold → 可选打开目录                     |
| Start / Stop Watch | 解析 moduleRoot + sfmc.root；同时仅一个 Watch |
| Reload to BDS      | `rebuildAndDeploy`                    |
| Refresh            | 重扫模块根                                 |
| 打开脚本沙箱             | Webview + playground-host             |


保留对外 command id（文档已引用）。删除半成品 Enable / Disable。`deactivate` 停 Watch 与宿主。

---



## 8. 分阶段交付（引擎）


| 阶段  | 内容                              |
| --- | ------------------------------- |
| 0   | 规格冻结；pin；testing 文档基线           |
| 1   | 生成器 + L0 门禁（核心）                 |
| 2   | 宿主线 A（ConfigManager + Registry） |
| 3   | 线 R 映射 + L2 加深（持续）              |
| 4   | 作者体验与治理                         |
| 5   | 可选：live db、多模块同沙箱…              |


扩展实现建议分批：路径 + Tree + Watch → playground-host + 脚本沙箱 UI → UI 应答 + 冒烟 + 启动并调试。

---



## 9. 验收要点

**沙箱：** 未实现符号可 import；调用抛错含 API 路径；boot 顺序错误在 `npm test` 失败且堆栈在模块源码。  

**扩展：**

1. 单独开模块仓能识别有效根
2. 脚本沙箱可编排刺激并看日志；场景含 World / Dim
3. 启动并调试可在模块源码断点
4. 冒烟经 `!` + chatSend
5. Watch / Reload 缺根则选目录写入设置
6. `docs/dev/testing.md` 含维度表，与本规格一致
7. 无：猜主仓、Watch 死盯第一项、启停半成品入口

---



## 10. 风险与话术


| 风险                 | 缓解                        |
| ------------------ | ------------------------- |
| `.d.ts` 解析边角       | MVP 覆盖 export 形态；CI 红并人工补 |
| 全局 Registry 污染并行测试 | 串行 / dispose 强清理          |
| L0 被当成「真机也会挂」      | 文档区分沙箱未实现 vs 断言失败         |
| 生成物体大              | 仅测试入口；不进 SAPI BP bundle   |


对外话术：**全表面 ≠ 假 BDS**；先 `npm test` / 脚本沙箱，再 Watch 进服终检。

---



## 11. 文档沿革


| 原文件                                          | 处理                                                         |
| -------------------------------------------- | ---------------------------------------------------------- |
| `2026-07-30-sapi-testing-sandbox-design.md`  | 并入本文                                                       |
| `2026-07-31-sfmc-module-extension-design.md` | 并入本文                                                       |
| Playground 人机路径                              | 见 [脚本沙箱 UI](./2026-07-31-sfmc-script-sandbox-ui-design.md) |


实现计划：`plans/2026-07-30-sapi-testing-sandbox.md`、`plans/2026-07-31-sapi-playground-1to1.md`。