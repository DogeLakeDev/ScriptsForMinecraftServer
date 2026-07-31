# SFMC 事件刺激台（Playground）UX / UI 设计

**日期：** 2026-07-31  
**状态：** 已审（对话确认）→ **主隐喻已演进**  
**演进：** 默认主路径改为 **刺激剧本（蓝图）**，见 [2026-07-31-sfmc-playground-stimulus-graph-design.md](./2026-07-31-sfmc-playground-stimulus-graph-design.md)。本文保留为三区 / 单步填表辅模式与历史决策参考。  
**范围：** `extensions/sfmc-module` Playground Webview 交互与视觉；依赖既有 `@sfmc-bds/sdk/testing` 1:1 API  
**前置：** [2026-07-31-sfmc-module-extension-design.md](./2026-07-31-sfmc-module-extension-design.md)、[script-api-native-map.md](../notes/script-api-native-map.md)  
**非目标：** 模块引导左树、每玩家聊天糖做默认主路径、假 BDS 视口  

---

## 1. 产品定义

| 项 | 内容 |
|----|------|
| 名称（UI） | **事件刺激台**（副标题可保留 Playground） |
| 一句话 | 在 IDE 里选 SAPI 信号、用表单填 Event、Emit，在视口看模块反应 |
| 隐喻 | Blender：**大纲选中 → 属性跟选 → 操作员执行**；不是通用 API 浏览器 |
| 对照 | Roblox Playtest 的「刺激」侧；真机联调仍用 Watch |

底层 1:1（`objects.create` / `call` / 原始 JSON emit）进入次要入口 **实验室**，不占据默认主路径。

---

## 2. 已锁定决策

| 决策 | 选择 |
|------|------|
| 产品隐喻 | 事件刺激台（Stimulus），非进服试玩主隐喻、非场景故事板主隐喻 |
| 找事件（本轮） | **全量 hub 树 + 搜索**；「按模块引导」后置 |
| 填 payload | **表单优先**；JSON 仅实验室 / 高级编辑 |
| 骨架 | IDE 双栏演进为 **三区**：大纲 \| 属性 \| 视口 |
| 视口 | **日志 \| 状态** 可切换标签；默认日志 |
| 生命周期 | **开面板即沙箱**；无启动/销毁主按钮；次要「重置场景」 |
| 场景树 | World / Dimension（天生）+ Player / Entity（可 create，预填） |
| UI 库 | **[VS Code Elements](https://vscode-elements.github.io/)**（Web Components）；不用已停更的 `@vscode/webview-ui-toolkit`；不上 React/MUI/Ant |
| 实现策略 | 薄皮重铺：保留 `playground-host` RPC 与 meta；重写 Webview |

---

## 3. 信息架构

```text
┌─ 顶栏：Tick | 重置场景 | 分相进度 | [刺激台] [实验室] ───────┐
├──────────┬─────────────────────┬──────────────────────────────┤
│ 大纲     │ 属性（跟 Active）    │ 视口                         │
│          │                     │ [日志] [状态]                │
│ 场景     │ 实例字段 / 新建草稿 │                              │
│  World   │ 或 Event 表单       │ 日志：系统频道镜像           │
│  Dim…    │                     │ 状态：场景摘要 / 最近 emit   │
│  Player… │ [Emit|创建] [Tick] │                              │
│  Entity… │                     │                              │
│  [新建▾] │                     │                              │
│ 事件     │                     │                              │
│  ·hub…   │                     │                              │
└──────────┴─────────────────────┴──────────────────────────────┘
```

### 3.0 生命周期（无启动/销毁主按钮）

- 打开面板 → 自动 `createSandbox`（World / 默认 Dimension 已存在）
- 关闭面板 → dispose 宿主
- **重置场景**：次要操作，等价于再跑一遍 `createSandbox`（清空玩家/实体后重建壳）
- 顶栏「启动 / 销毁」视为糖，**不做主路径**

### 3.1 大纲（Outliner）

**场景**（世界模拟维度 W / D / P / E）

| 节点 | 来源 | 新建 |
|------|------|------|
| World | 沙箱单例（非 `objects.create`） | 否 |
| Dimension | `getDimension` 默认 overworld / nether / the_end | 否 |
| Player / Entity | `objects.create` | 是（预填） |
| ItemStack / Block | 同左（引擎可构造） | 是（预填）；树分组可选 |

- **新建**：选 kind → 属性区「新建草稿」按 `PLAYGROUND_META.classes[Kind]` 出表单并预填 → **创建**
- 选中实例 → Active = 该实例（跟属性）

**事件**

- `world|system` × `beforeEvents|afterEvents` → 信号名（来自 `PLAYGROUND_META.events` / `eventTypes`）
- 可搜索过滤
- 选中信号 → Active = 该信号；属性区标题显示 `eventType`

本轮不做「本模块相关」分组。

### 3.2 属性（Properties）

**硬规则：一次一个 Active**（场景实例 / 新建草稿 / 事件，互斥高亮）。

| Active | 属性区内容 | 主操作 |
|--------|------------|--------|
| World / Dimension | 按 meta 展示字段（多只读） | （本轮）只读为主；方法进实验室 |
| Player / Entity / … | 展示 id + 字段快照 | （本轮）只读为主 |
| 新建草稿 | 全字段表单 + 预填 | **创建** → `objects.create` |
| 事件 | 按 `PLAYGROUND_META.classes[eventType].properties` 生成表单 | **Emit**；旁路 **Tick** |

表单控件映射（VS Code Elements）：

| d.ts 类型线索 | 控件 |
|---------------|------|
| `boolean` | checkbox / switch |
| `number` | number input |
| `string` | text input |
| `location` / 坐标袋 | x/y/z 数字框 |
| `Player` / `Entity` 等引用 | 下拉：场景内已有实例；空选项表示未绑 |
| 其余 / 复杂 | JSON 文本框（预填默认） |

嵌套引用在 RPC 层仍可译为 `$ref`；作者默认不手写 JSON。

### 3.3 视口（Viewport）

| 标签 | 内容 |
|------|------|
| **日志**（默认） | 系统频道：分相、emit、L0 错误、宿主日志；选中玩家时可强调与其相关的行（能做到再做，非 blocker） |
| **状态** | 场景摘要：已加载模块 id（若有）、boot 成败、玩家列表摘要、最近一次 emit 路径与时间 |

扩展 OutputChannel「SFMC 扩展」继续镜像系统级日志（既有约定）。

### 3.4 实验室

独立顶栏页（或同 Webview 内第二视图）：

- 现有 1:1：任意 kind create / call / 原始 JSON payload
- 不删能力；文案标明「高级 / 1:1」

---

## 4. Blender 映射（文档用）

| Blender | 刺激台 |
|---------|--------|
| Outliner | 大纲：场景 + 事件 |
| Active Object | 当前选中玩家或信号 |
| Properties | 属性表单 |
| Operator | Emit / Tick / 新建 / 重置场景 |
| Viewport | 视口：日志 \| 状态 |
| Timeline | 后置（刺激历史） |

---

## 5. 技术约束

- Webview CSP：Elements 经扩展打包注入；`webview.cspSource` + nonce/hash 按 VS Code 惯例
- 主题：依赖 Elements + `--vscode-*`，不引入独立品牌皮
- 宿主：继续 JSON-RPC stdio；开面板自动 `start`；表单 → `events.emit` / `objects.create`；World/Dim 经 registry 登记供选中
- 元数据权威：`PLAYGROUND_META`（含 `eventTypes`、Event `kind: "event"`）

---

## 6. 分轮交付

| 轮次 | 交付 |
|------|------|
| **本轮** | 刺激台三区 + 自动生命周期 + 场景 World/Dim/Player/Entity + 新建预填 + Event 表单 Emit/Tick + 视口日志/状态 + 实验室 1:1 |
| **下一轮** | 模块引导左树；每玩家聊天主路径；刺激历史 / Timeline |
| **更后** | 启动并调试；场景模板 |

---

## 7. 验收

1. 未读文档的作者能在 1 分钟内：开面板（已有 World/Dim）→ 新建玩家 → 选 `chatSend`（或任意信号）→ 填表 → Emit → 在日志区看到记录  
2. 默认路径无需手写 JSON、无需理解 `$ref`  
3. 实验室仍可 create Event 袋与原始 emit  
4. 外观跟编辑器主题（亮/暗）可读  
5. 产品可一句话介绍：「IDE 里的 SAPI 事件刺激台」

---

## 8. 与既有规格关系

- 不修改 1:1 映射范围（构造 / 操作 / 事件触发仍成立）  
- 本文件只规定 **默认人机路径** 与 **UI 分层**；API 仍以 sandbox / playground-host 为准  
- 扩展设计中的分相进度、系统日志镜像约定继续有效，落在顶栏与视口「日志」
