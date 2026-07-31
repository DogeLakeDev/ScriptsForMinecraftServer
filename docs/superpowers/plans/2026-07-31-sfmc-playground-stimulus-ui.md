# SFMC 事件刺激台 Webview 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按 [刺激台 UX 规格](../specs/2026-07-31-sfmc-playground-stimulus-ux-design.md) 重铺 Playground Webview：大纲选中 → 属性表单 → Emit；视口日志|状态；实验室保留 1:1。

**架构：** 继续 `PlaygroundHostClient` ↔ `playground-host` JSON-RPC；UI 改用 VS Code Elements + 三区布局。SDK meta / `objects` / `events` 已具备 Event 类型，本计划以扩展 UI 为主，宿主仅补场景摘要等薄 RPC。

**技术栈：** TypeScript、esbuild、`@vscode-elements/elements`（或当前 npm 包名 `vscode-elements`）、既有 `@sfmc-bds/sdk/testing`。

**规格：** [../specs/2026-07-31-sfmc-playground-stimulus-ux-design.md](../specs/2026-07-31-sfmc-playground-stimulus-ux-design.md)

---

## 文件职责

| 路径 | 职责 |
|------|------|
| `extensions/sfmc-module/package.json` | 依赖 `@vscode-elements/elements`（以 npm 实名为准） |
| `extensions/sfmc-module/build.mjs` | 打包扩展；webview 资源可 copy 或 bundle |
| `extensions/sfmc-module/src/playground/media/*` 或 `webview/*` | 刺激台 HTML/CSS/JS（或 TS 编译产物） |
| `extensions/sfmc-module/src/playground/PlaygroundPanel.ts` | 注入 webview、消息桥、加载 Elements |
| `extensions/sfmc-module/src/playground/hostClient.ts` | 既有 RPC 客户端；按需加 `scene.summary` |
| `modules/sdk/@sfmc-sdk/src/testing/playground-host.ts` | 补 `scene.summary` / 列表 RPC（若 UI 需要） |
| `docs/dev/testing.md` | 一句指向刺激台规格（若尚未） |

---

### 任务 1：接入 VS Code Elements

**文件：**
- 修改：`extensions/sfmc-module/package.json`、`build.mjs`
- 修改：`PlaygroundPanel.ts`（CSP + 脚本/样式 URI）

- [x] **步骤 1：** 查清当前维护的 npm 包名与导入方式（`@vscode-elements/elements` / 文档示例）  
- [x] **步骤 2：** 安装依赖；esbuild 或 `asWebviewUri` 提供组件脚本  
- [x] **步骤 3：** 最小 Webview：一个 `vscode-button`「启动」能 RPC `start`  
- [ ] **步骤 4：** Commit  

---

### 任务 2：大纲 + Active 模型

**文件：**
- 创建：webview 侧 `outliner` / `app` 脚本  
- 修改：`PlaygroundPanel.ts` 消息协议  

- [x] **步骤 1：** 左树两区：场景（玩家列表 + +玩家）、事件（hub→信号，可搜）  
- [x] **步骤 2：** 单选 Active：`{ type:'player', id }` 或 `{ type:'event', path }`  
- [x] **步骤 3：** 启动后 `meta` + `objects.list` 灌树；create Player 后刷新场景  
- [ ] **步骤 4：** Commit  

---

### 任务 3：属性表单 + Emit / Tick

**文件：**
- webview 表单生成（读 `PLAYGROUND_META.classes[eventType]`）  
- RPC：`events.emit`、`tick`、`objects.create`  

- [x] **步骤 1：** Active=事件 → 按属性类型渲染 Elements 控件；Player 字段用场景玩家下拉  
- [x] **步骤 2：** Emit 组装 plain object（引用字段用实例目标或 `$ref` 与宿主约定一致）  
- [x] **步骤 3：** Active=玩家 → 展示字段；本轮可不做聊天糖  
- [x] **步骤 4：** Tick 按钮；手测 chatSend / playerJoin  
- [ ] **步骤 5：** Commit  

---

### 任务 4：视口 日志 | 状态

**文件：**
- webview 视口标签  
- 可选：`playground-host` `scene.summary`  

- [x] **步骤 1：** 日志标签消费 `hostEvent` log/progress  
- [x] **步骤 2：** 状态标签：玩家数、最近 emit、boot 文案（engine-only 可写「未加载模块」）  
- [x] **步骤 3：** 默认日志；切换状态不丢日志缓冲  
- [ ] **步骤 4：** Commit  

---

### 任务 5：顶栏分相 + 实验室

**文件：**
- `PlaygroundPanel.ts` / webview  

- [x] **步骤 1：** 顶栏：启动/销毁/分相进度条或列表  
- [x] **步骤 2：** 视图切换「刺激台 | 实验室」；实验室嵌入既有 create/call/JSON 三栏  
- [x] **步骤 3：** 空态文案指向 `docs/dev/testing.md` + 刺激台规格一句话  
- [ ] **步骤 4：** F5 手测验收规格 §7；Commit  

---

## 验收（对照规格 §7）

1. 启动 → +玩家 → 选信号 → 表单 Emit → 日志可见  
2. 默认无手写 JSON  
3. 实验室仍可 1:1  
4. 亮/暗主题可读  
5. 可不依赖模块 boot  

## 非目标

模块引导树、聊天主路径、Timeline、Start & Debug（另计划）。
