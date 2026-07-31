# SFMC 脚本沙箱 UI 设计（sapi-sandbox）

**日期：** 2026-07-31（合并整理）  
**状态：** 已审（实现进行中）  
**范围：** `extensions/sfmc-module` Playground Webview 人机路径与视觉  
**前置：** [2026-07-31-sfmc-testing-and-extension-design.md](./2026-07-31-sfmc-testing-and-extension-design.md)、[script-api-native-map.md](../notes/script-api-native-map.md)  
**非目标：** 完整游戏逻辑可视化、真服事件总线、假 BDS 视口、每玩家聊天糖做默认主路径  

> 本文合并原《刺激剧本（蓝图）》与《事件刺激台 UX》。默认主壳为 **节点图编排**；场景坞 + `PLAYGROUND_META` 表单承载 1:1 属性。产品名统一为 **脚本沙箱**（英：sapi-sandbox）。旧称「刺激剧本 / 事件刺激台」弃用。

---

## 1. 产品定义

| 项 | 内容 |
|----|------|
| 名称（UI） | **脚本沙箱**（sapi-sandbox） |
| 一句话 | 用可连线的节点编排 SAPI 刺激，整图或局部重跑，在日志里看模块反应 |
| 隐喻 | 轻量 Blueprint / 测试编排图 + Blender 式「场景选中 → 属性跟选」 |
| 对照 | 可点选重试的冒烟步骤图；真机仍用 Watch |

作者真实节奏往往是：搭一串刺激 → 改一处 → **只重试该步或从某节点起重跑**，不必每次从零点完。节点图擅长编排与局部重试；单次填表 Emit 降为节点操作 / 辅能力。

---

## 2. 已锁定决策

| 决策 | 选择 |
|------|------|
| 主壳 | **节点图**（控制流边）；非全量数据流端口 |
| Event 字段 | 选中 Emit → 侧栏按 `PLAYGROUND_META` 表单；不把每字段拉成线 |
| 局部重试 | 一等公民：整图 / 从选中 / 仅选中 |
| 场景实例 | World / Dimension **天生**（场景坞）；Player / Entity 可 create |
| 属性 | **1:1 mirror**：类属性来自 meta；Event 袋可填（含 d.ts 只读字段）；引用用 `$ref` 下拉 |
| 生命周期 | **开面板即沙箱**；无启动 / 销毁主按钮；次要「重置场景」 |
| 填 payload | 表单优先；原始 JSON 为高级 / 实验室后置 |
| UI 栈 | **React + `@xyflow/react` + Radix**；皮跟 `--vscode-*`（路径含 `#` 暂不接 Tailwind CLI） |
| 宿主 | `playground-host` JSON-RPC；执行 = 有序调用 `objects.*` / `events.emit` / `tick` |
| 打开方式 | 在主编辑器组以 **新标签页** 打开（`ViewColumn.Active`），避免 `Beside` 半屏过窄 |
| 日志 | **仅** VS Code Output「SFMC 扩展」（`@sfmc-bds/sdk/logs`）；Webview **不**内嵌日志面板；断言用静默缓冲 |
| 面板布局 | Photoshop 式：工具 / 属性可 **左停靠 / 右停靠 / 浮动**，可关、可拖、可改宽；视图菜单复位 |
| 菜单字体 | 菜单项与快捷键标注用 **标准 UI 字体**（`--vscode-font-family` / Segoe UI），不用等宽定制体 |
| 基础编辑 | 撤回 / 重做 |
| 快捷键查阅 | **弹窗**（文件 → 快捷键… / `?`）；非停靠面板 |

---

## 3. 信息架构

```text
┌─ 顶栏：文件 | 编辑 | 视图 | 插入 | 运行 │ 运行整图 | 重置 | 状态 ─┐
├─────────┬──────────────────────────────┬─────────┤
│ 停靠列   │ 画布（节点 + 控制流）          │ 停靠列   │
│（可空）  │ 浮动面板叠在画布上            │（可空）  │
└─────────┴──────────────────────────────┴─────────┘
  日志 → VS Code Output「SFMC 扩展」（视图 → 打开 Output 日志）
```

- **画布：** 编排、选中、运行高亮  
- **工具面板：** 紧凑插入工具条 + 场景块卡片网格（默认可左停靠）；场景对象视觉对齐画布 `.s-node`  
- **属性面板：** 跟 Active（图节点 **或** 场景实例，互斥）  
- **快捷键：** 文件菜单弹窗（遮罩 + 居中对话框）；Esc / 点遮罩 / 关闭关掉  
- **日志：** 只写 Output；失败停在红态节点  

### 3.1 生命周期

- 打开面板 → 自动 `start`（World / 默认 Dimension 已登记）  
- 关闭面板 → dispose 宿主  
- **重置场景** → 再跑 `createSandbox`（清空玩家 / 实体后重建壳）  

---

## 4. 运行与重试

| 命令 | 行为 | 建议快捷键 |
|------|------|------------|
| **运行整图** | 无入边集合按稳定拓扑序跑完全图 | F5 |
| **从选中运行** | 以当前节点为起点沿出边跑子图 | Ctrl+F5 |
| **仅运行选中** | 只执行当前一节点 | Ctrl+Enter |
| **运行上游 / 到此边前** | 边右键：以边的 source 为终点跑可达上游（含 source，不含 target） | — |

| 策略 | 何时 |
|------|------|
| **保留世界** | 默认「仅选中 / 从选中」 |
| **重置再跑** | 顶栏「重置」；整图可选手重置（后置勾选） |

失败：**停在失败节点** + 日志定位；不自动清空世界（除非策略要求）。

**条件分支（MVP）：** 断言节点支持多种 `assertKind`（日志包含/不含、场景存在、属性、计数、上次 Emit/Call）；真走通过边、假走失败边或停住。暂不做完整表达式语言。

---

## 5. 节点 MVP

| 节点 | 作用 | 侧栏 |
|------|------|------|
| **新建 Player** | `objects.create('Player', 袋)` | FakePlayerInit 入口 + Player/Entity **可写**表面 |
| **Emit** | `events.emit(path, payload)` | path 搜索 + Event 类型全字段表单 |
| **Tick** | `tick(n)` | n |
| **Call** | `objects.call(id, method, args)` | 目标 `$ref` / method / args JSON |
| **断言** | 按 `assertKind` 求值；失败停 / 走失败边 | 见下表 |
| **注释** | 文档 | 文本 |

#### 断言类型（`assertKind`）

| assertKind | 含义 | 主要字段 |
|------------|------|----------|
| `log` | 日志缓冲包含子串 / `/正则/` | `pattern`；可选 `ignoreCase` |
| `logNot` | 日志缓冲**不**包含 | 同上 |
| `sceneExists` | 场景中存在匹配对象 | `targetKind` / `targetName` / `targetId` |
| `prop` | `objects.inspect` 后属性等于/包含/正则 | `targetId`、`propName`、`expected`、`matchMode` |
| `count` | 某 kind 数量 ≥ / = / ≤ N | `targetKind`、`countOp`、`countN` |
| `lastEmit` | path **或** payload/result 摘要匹配；可填字段精确比 | `pattern` 或 `propName`+`expected` |
| `lastCall` | method/result 匹配；可填字段精确比 | 同上 |

**轻量表达式（`expected`，`$`/`@` 前缀）：** 字面量；`$id.prop[.nested]`；`@lastEmit[.path|.payload.k|.result.k]`；`@lastCall[.id|.method|.result]`。无运算符/函数/多语句。

旧剧本仅有 `pattern` 的断言节点：读入时默认 `assertKind=log`。`lastEmit` 宿主快照含 `path` + 规范化 `payload` + emit 后 `result`。

后置：等待事件、新建 Entity、表单应答、分组框、断言失败边。  

**非目标：** 每个 SAPI 类一个方块、属性全拉成端口、模拟红石 / 物理、完整表达式语言。

---

## 6. 场景坞与 1:1 属性

### 6.1 场景坞

| 节点 | 来源 | 新建 |
|------|------|------|
| World | 沙箱单例 | 否 |
| Dimension | overworld / nether / the_end | 否 |
| Player / Entity / ItemStack / Block | `objects.create` 或图运行产生 | 是（预填 / 图节点） |

选中 → `objects.inspect` → 按 `PLAYGROUND_META.classes[kind].properties` **全量展示**（本轮只读为主）。

### 6.2 表单控件

| d.ts 线索 | 控件 |
|-----------|------|
| `boolean` | 下拉 / 开关 |
| `number` | number |
| `string` | text；`dimensionId` 可用场景维度下拉 |
| `Vector3` / location | x / y / z |
| `Player` / `Entity` / `Dimension` | 场景实例下拉 → `{ $ref }` |
| 其余 / 复杂 | JSON 文本 |

**硬规则：** 一次一个 Active（图节点与场景互斥高亮）。

### 6.3 与实验室

任意 kind create / call / 原始 JSON 为 **高级入口**（后置页或菜单），不删能力、不抢主路径。

---

## 7. 剧本文件

- 建议路径：模块下 `stimulus/*.json` 或工作区 `.sfmc/stimulus/*.json`  
- 至少：`schemaVersion`、`nodes[]`、`edges[]`；可选 `viewport`  
- Emit 的 `path` + `payload` 纯 JSON；嵌套实例用 `$ref`  
- 无头重放与 UI **共用执行器**（DIP）：`runGraph(graph, range, hostClient)`  

---

## 8. 交互基线

| 能力 | 约定 |
|------|------|
| 撤回 / 重做 | Ctrl+Z / Ctrl+Y（或 Ctrl+Shift+Z）；覆盖增删、连线、换连、拖动、属性 / 边备注编辑 |
| 面板显隐 | 视图菜单：显示/隐藏工具、属性、复位布局、打开 Output |
| 快捷键查阅 | 文件 → 快捷键…（或顶栏 `?` / 键 `?`）；弹窗列表 |
| 调宽 | 画布与右侧栏之间拖分割条；宽度持久化 |
| 右键 | 节点：插入…、运行、复制、删除；边：运行上游 / 到此边前、编辑备注、重新连接（拖终点）、删除 |
| 边备注 / 换连 | 边 `label` 仅展示；`onReconnect` + `edgesReconnectable` 拖终点换节点 |

---

## 9. 技术要点

- 打包：扩展 Webview esbuild；CSP / `asWebviewUri` 按 VS Code 惯例  
- 主题：`--vscode-*` + 节点强调色（player / emit / tick / assert）  
- 元数据：`PLAYGROUND_META`（`classes` / `events` / `eventTypes`）  
- RPC：`inspect` / `sceneSummary` / `create` / `emit` / `tick` / `reset`  

---

## 10. 分轮交付

| 轮次 | 交付 |
|------|------|
| **本轮 MVP** | 画布五类节点 + 控制流 + 三运行范围 + 场景坞 World/Dim + meta 表单 + 日志红态 + 存盘 + 撤回/面板/主编辑器标签页 |
| **下一轮** | 断言失败边、无头 CLI 重放、Entity 节点、轨迹回放 |
| **更后** | 数据口（player → sender）、模块引导、启动并调试深链、实验室页 |

---

## 11. 验收

1. 能搭：新建玩家 → Emit `chatSend` → Tick → 断言，保存后再打开顺序一致  
2. 改 Emit 后可用「仅选中 / 从选中」重试，不必重搭前缀  
3. 场景坞可见 World 与三维；点选可看 meta 属性快照  
4. Player / Emit 侧栏字段来自 meta（非手写两三框）  
5. 撤回、隐藏侧栏、拖宽可用；以主编辑器新标签页打开（非半屏分栏）  
6. 一句话可介绍：「IDE 里可局部重试的 SAPI 脚本沙箱」  

---

## 12. 文档沿革

| 原文件 | 处理 |
|--------|------|
| `2026-07-31-sfmc-playground-stimulus-graph-design.md` | 并入本文（主壳） |
| `2026-07-31-sfmc-playground-stimulus-ux-design.md` | 并入本文（场景坞 / 1:1 表单 / 生命周期） |
| Elements 三区刺激台 | 历史路径；栈已改为 React + xyflow + Radix |

引擎与扩展边界见 [测试沙箱与扩展设计](./2026-07-31-sfmc-testing-and-extension-design.md)。
