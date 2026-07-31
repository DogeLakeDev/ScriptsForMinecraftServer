# SFMC 事件刺激台（Playground）UX / UI 设计

**日期：** 2026-07-31  
**状态：** 已审（对话确认）  
**范围：** `extensions/sfmc-module` Playground Webview 交互与视觉；依赖既有 `@sfmc-bds/sdk/testing` 1:1 API  
**前置：** [2026-07-31-sfmc-module-extension-design.md](./2026-07-31-sfmc-module-extension-design.md)、[script-api-native-map.md](../notes/script-api-native-map.md)  
**非目标：** 模块引导左树、场景故事板主路径、每玩家聊天糖做默认主路径、假 BDS 视口

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
| UI 库 | **[VS Code Elements](https://vscode-elements.github.io/)**（Web Components）；不用已停更的 `@vscode/webview-ui-toolkit`；不上 React/MUI/Ant |
| 实现策略 | 薄皮重铺：保留 `playground-host` RPC 与 meta；重写 Webview |

---

## 3. 信息架构

```text
┌─ 顶栏：启动 | 销毁 | 分相进度 | [刺激台] [实验室] ─────────────┐
├──────────┬─────────────────────┬──────────────────────────────┤
│ 大纲     │ 属性（跟 Active）    │ 视口                         │
│          │                     │ [日志] [状态]                │
│ 场景     │ 玩家字段 或         │                              │
│  ·玩家*  │ Event 表单          │ 日志：系统频道镜像           │
│  [+玩家] │                     │ 状态：玩家/boot/最近 emit    │
│ 事件     │ [Emit] [Tick]       │                              │
│  ·hub…   │                     │                              │
└──────────┴─────────────────────┴──────────────────────────────┘
```

### 3.1 大纲（Outliner）

**场景**

- 列出沙箱内玩家（显示名 + kind）
- **+ 玩家**：弹出名 / OP 等最小字段 → `objects.create('Player', …)`
- 选中玩家 → Active = 该玩家

**事件**

- `world|system` × `beforeEvents|afterEvents` → 信号名（来自 `PLAYGROUND_META.events` / `eventTypes`）
- 可搜索过滤
- 选中信号 → Active = 该信号；属性区标题显示 `eventType`

本轮不做「本模块相关」分组。

### 3.2 属性（Properties）

**硬规则：一次一个 Active**（玩家 **或** 事件，互斥高亮）。

| Active | 属性区内容 | 主操作 |
|--------|------------|--------|
| 玩家 | 可写/展示字段（名、OP 等）；只读展示 id | （本轮）可选「设为默认 sender」；聊天糖后置 |
| 事件 | 按 `PLAYGROUND_META.classes[eventType].properties` 生成表单 | **Emit**；旁路 **Tick** |

表单控件映射（VS Code Elements）：

| d.ts 类型线索 | 控件 |
|---------------|------|
| `boolean` | checkbox / switch |
| `number` | number input |
| `string` | text input |
| `Player` / `Entity` 等引用 | 下拉：场景内已有实例；空选项表示未绑 |
| 其余 / 复杂 | 文本框或「在实验室用 JSON」提示 |

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
| Operator | Emit / Tick / +玩家 |
| Viewport | 视口：日志 \| 状态 |
| Timeline | 后置（刺激历史） |

---

## 5. 技术约束

- Webview CSP：Elements 经扩展打包注入；`webview.cspSource` + nonce/hash 按 VS Code 惯例
- 主题：依赖 Elements + `--vscode-*`，不引入独立品牌皮
- 宿主：继续 JSON-RPC stdio；表单提交 → `events.emit(path, plainObject)`；创建玩家 → `objects.create`
- 元数据权威：`PLAYGROUND_META`（含 `eventTypes`、Event `kind: "event"`）

---

## 6. 分轮交付

| 轮次 | 交付 |
|------|------|
| **本轮** | 刺激台三区 UI（Elements）+ 全量事件树 + Event 表单 + Emit/Tick + 视口日志/状态切换 + 实验室保留 1:1 + 场景 +玩家 |
| **下一轮** | 模块引导左树；每玩家聊天主路径；刺激历史 / Timeline |
| **更后** | 启动并调试；场景模板 |

---

## 7. 验收

1. 未读文档的作者能在 1 分钟内：启动 → 加玩家 → 选 `chatSend`（或任意信号）→ 填表 → Emit → 在日志区看到记录  
2. 默认路径无需手写 JSON、无需理解 `$ref`  
3. 实验室仍可 create Event 袋与原始 emit  
4. 外观跟编辑器主题（亮/暗）可读  
5. 产品可一句话介绍：「IDE 里的 SAPI 事件刺激台」

---

## 8. 与既有规格关系

- 不修改 1:1 映射范围（构造 / 操作 / 事件触发仍成立）  
- 本文件只规定 **默认人机路径** 与 **UI 分层**；API 仍以 sandbox / playground-host 为准  
- 扩展设计中的分相进度、系统日志镜像约定继续有效，落在顶栏与视口「日志」
