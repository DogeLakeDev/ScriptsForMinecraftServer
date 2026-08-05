# Sapience 设计规格

**日期：** 2026-08-01  
**状态：** 草案（待独立仓落地）  
**产品名：** Sapience  
**前称：** 脚本沙箱 / sapi-sandbox / SFMC Playground Webview（本规格起不再作主品牌）  
**相关：** [2026-07-31-sfmc-script-sandbox-ui-design.md](./2026-07-31-sfmc-script-sandbox-ui-design.md)（历史 UI 决策；布局与宿主模型以本文为准）  
**参考：** [Blender Human Interface Guidelines](https://developer.blender.org/docs/features/interface/human_interface_guidelines/)（范式与密度；非组件库）

---

## 1. 产品定义

| 项 | 内容 |
|----|------|
| 名称 | **Sapience** |
| 一句话 | 面向 Minecraft Bedrock **Script API（SAPI）** 的桌面节点编排与试跑工作台：搭场景、连刺激、跑断言、看日志 |
| 首版用户工程 | 任意以 `@minecraft/server` 为入口的脚本工程（约定可解析的 `main` / `index`；**不要求** SFMC manifest） |
| 架构风格 | **插件化（核心原则）**：壳与假 SAPI 运行时保持通用；生态能力以插件注册，禁止在核心写死厂商分支 |
| SFMC | **官方示例级插件**（`@sapience/plugin-sfmc`）：夹具、权限、模块语义镜像等；可启用/禁用，不是核心内嵌特例 |
| 非目标（本规格） | 真服联机调试、完整游戏逻辑可视化、假物理/红石、把假引擎重写成 Rust |

---

## 2. 仓库与进程边界

### 2.1 独立仓库

Sapience 体量为完整桌面应用（壳 + DS + 宿主协议 + 分发），**单独 Git 仓库**实现与发布。

| 位置 | 职责 |
|------|------|
| **Sapience 仓** | Tauri 壳、UI、命令表、**插件宿主与官方插件**、打包；可依赖测试运行时包 |
| **SFMC monorepo** | 可选薄桥：命令「用 Sapience 打开」；testing / host 若仍由 SDK 发布则继续从这里发版 |
| **规格存档** | 本仓 `docs/specs/` 为权威；SFMC `docs/superpowers/specs/` 可留副本 |

### 2.2 运行时拓扑

```text
Sapience (Tauri 壳, Rust 仅脚手架)
  ├─ WebView2: React UI (xyflow + Tailwind DS)
  └─ spawn: 本机 node → host (stdio JSON-RPC)
              └─ 假 SAPI 世界 + 装载用户工程入口
```

| 决策 | 选择 |
|------|------|
| 桌面壳 | **Tauri 2**（主进程不写业务 Rust） |
| 用户环境 | **接受本机已装 Node ≥22.13**（不打包 SEA / 不捆绑 Node 为默认） |
| 宿主通信 | **stdio 子进程** + 行分隔 JSON-RPC（沿用现 Playground 模型） |
| 前端日志 | **loglevel** → 底栏 Console |
| 后端日志 | 现有宿主/SDK 日志体系 → 经 RPC/stderr 转发进 Console |

---

## 3. 工程模型与插件体系

插件化是 Sapience 的产品与代码风格：核心只做通用能力；领域差异进插件。下文用「插件」统一称呼（不再用「适配器」作主术语）。

### 3.1 最小工程（核心）

Sapience 打开一个**工程根目录**，由核心解析：

1. **入口文件**：`package.json` 的 `main` / `exports`，或约定 `src/index.ts`、`scripts/main.js` 等可配置探测列表  
2. **SAPI 依赖**：能解析到 `@minecraft/server`（及工程声明的其它 `@minecraft/*`）  

有此二者即可图编排与场景试跑。SFMC manifest **不是**打开工程的前提。

### 3.2 插件契约（概要）

插件是带稳定 `id` 的包（首版可同仓 `plugins/<id>`，日后可 npm 外置），向宿主注册扩展点。核心通过 **Plugin Registry** 装载，不 `if (sfmc)` 散落业务。

| 扩展点（首版） | 用途 |
|----------------|------|
| `detectProject` | 识别工程是否适用本插件（如存在 `sapi/manifest.json`） |
| `contributeCommands` | 写入 Operate 命令表（菜单 / Tool / 右键同一注册表） |
| `contributeOutlinerTabs` | Outliner 页签（如「夹具」） |
| `contributePropertyTabs` | Properties 图标页签 |
| `contributeHostHooks` | 宿主侧 fixture / 装载前后钩子（经 RPC 暴露的方法名空间） |
| `contributeNodeTypes` | 可选专用节点（慎用；优先复用核心节点） |

规则：

- **核心零 SFMC 符号**：夹具、模块锁、语义镜像等只出现在 `plugin-sfmc`  
- **启用方式**：用户偏好 / 工程自动探测（`detectProject` 为真时可提示启用）；可手动禁用  
- **UI 显隐**：未启用的插件不贡献页签与命令，避免空「夹具」页  
- **版本**：插件声明兼容的 Sapience 宿主 API 版本；不兼容则拒绝加载并写 Console  

### 3.3 首版插件

| 插件 id | 提供 | 默认 |
|---------|------|------|
| （核心，非插件） | 入口装载、场景、Emit/Tick/Call/断言、Console、图运行 | 始终开 |
| **`sfmc`** | 夹具、settings/权限覆盖、语义镜像、SFMC 模块目录约定 | 探测到 SFMC 工程时建议启用；可关 |

第三方插件（其它脚手架、测试框架）走同一注册表，不改壳。

---

## 4. 从 Blender HIG 采纳的范式

借用法，不复刻 3D 工作流。权威叙述见 Blender [Design Paradigms](https://developer.blender.org/docs/features/interface/human_interface_guidelines/paradigms/)。

| 范式 | 在 Sapience 中的含义 |
|------|----------------------|
| **Non Overlapping** | 默认细分窗口：Screen → Area → Region；常用功能一眼可见，少靠堆叠浮动窗 |
| **Non Blocking** | 普通操作不弹模态挡全局；长任务（跑图）可取消并在状态栏/Console 标明 |
| **Non Modal** | 键鼠语义稳定；临时工具（如平移缩放）松手即结束 |
| **Select → Operate** | 先选中场景对象或图节点，再执行添加/运行/删除等 |
| **Operate → Settings** | 插入后属性在 Properties 调整；避免先填完大表单才创建 |
| **Tools ≠ Properties** | 左 Tool / 菜单命令 vs 右 Properties 数据编辑分离 |
| **Keep UI calm** | 悬停高亮克制；少闪动、少布局跳动（Blender Best Practices） |

**视觉目标：** 强致敬 Blender 默认深色 DCC 气质（面板头、密度、区域感）。**色板可整表替换**，token 与组件分离。

---

## 5. 默认 Screen 布局

```text
┌─ Topbar: 品牌 Sapience │ 文件 编辑 添加 运行 视图 │ 快捷操作 ─┐
├────┬──────────┬────────────────────────────┬────────────────┤
│Tool│ Outliner │     Node Editor (图)         │  Properties    │
│条  │ 场景│图│  │                            │  [图标页签]    │
│可关│ (+插件页签)│                          │                │
├────┴──────────┴────────────────────────────┴────────────────┤
│ Console（loglevel + 宿主转发）                                │
├─────────────────────────────────────────────────────────────┤
│ Status bar：Node / host / 工程根 / 运行态                      │
└─────────────────────────────────────────────────────────────┘
```

| Area | 职责 |
|------|------|
| **Topbar** | 菜单与全局运行；动词化菜单（添加、运行） |
| **Tool Region** | 常用插入图标；**可视图关闭**；与菜单/右键同一命令表 |
| **Outliner** | 核心页签：**场景 / 图**；**夹具**等由插件 `contributeOutlinerTabs` 贡献（未启用则不出现） |
| **Node Editor** | xyflow 控制流图；选中与 Outliner「图」页签双向同步 |
| **Properties** | **左侧图标页签**分类（对象 / 字段 / 运行 / 高级…）；跟 Active |
| **Console** | 内嵌日志；级别过滤；可选定位到相关节点 |
| **Status bar** | 非阻塞状态与环境信息 |

**Active 规则：** 场景实例与图节点选中互斥（与历史沙箱一致）；Properties 只跟一个 Active。

---

## 6. 操作与命令表

| 入口 | 行为 |
|------|------|
| 顶栏 **添加** | 添加节点 / 场景对象（分级菜单） |
| **Tool 条** | 同一命令的快捷图标；可关 |
| **右键** | 画布 / 节点 / Outliner 项：添加、运行、删除等 |

所有入口绑定同一 **Operate 注册表**（id、标签、上下文、handler）。禁止三套各写各的插入逻辑。

运行命令（沿用既有语义，名称可本地化）：运行整图 / 从选中 / 仅选中；失败停在节点 + Console。

---

## 7. 设计系统（可落地）

实现栈：**React 19 + `@xyflow/react` + Tailwind CSS + Radix（无样式原语）+ React Hook Form + Zustand（仅应用级状态）+ Lucide（Outlined / Stroke 线框图标）+ 字体 Inter**。节点内部状态以 xyflow 为源，不在 Zustand 双写全图。

| 项 | 选择 |
|----|------|
| 图标 | **Lucide**，统一 **Outlined / Stroke**（默认 `strokeWidth` 约 1.5–2；避免实心 Fill 作主图标） |
| UI 字体 | **Inter**（加载 variable / 静态均可；等宽仍用 `--sapi-font-mono`） |

### 7.1 Token（默认深色初值，可整表替换）

以下为 **初值**，非永久品牌色。Tailwind 映射到 CSS 变量（如 `--sapi-*`）。

| Token | 初值 | 用途 |
|-------|------|------|
| `--sapi-bg-window` | `#303030` | 窗体底 |
| `--sapi-bg-editor` | `#1d1d1d` | 节点编辑区 |
| `--sapi-bg-panel` | `#424242` | Outliner / Properties |
| `--sapi-bg-panel-header` | `#5680c2` | 区域头（Blender 向蓝） |
| `--sapi-bg-topbar` | `#232323` | 顶栏 |
| `--sapi-bg-console` | `#2b2b2b` | Console |
| `--sapi-bg-widget` | `#545454` | 输入底 |
| `--sapi-border` | `#1f1f1f` | 区域分割 |
| `--sapi-text` | `#e6e6e6` | 主文字 |
| `--sapi-text-dim` | `#9a9a9a` | 次文字 |
| `--sapi-accent` | `#5680c2` | 选中/强调 |
| `--sapi-danger` | `#c05252` | 失败/破坏 |
| `--sapi-ok` | `#6aa84f` | 成功 |
| `--sapi-font-ui` | `Inter, system-ui, sans-serif` | UI（Inter） |
| `--sapi-font-mono` | `Consolas, ui-monospace, monospace` | Console |
| `--sapi-font-size` | `12px` | 默认 UI |
| `--sapi-font-size-sm` | `11px` | 密集面板 |
| `--sapi-row-h` | `22px` | 属性行高 |
| `--sapi-radius` | `3px` | 控件圆角（克制） |
| `--sapi-panel-header-h` | `24px` | 区域头高度 |

### 7.2 核心控件清单（首版必齐）

| 控件 | 说明 |
|------|------|
| PanelHeader | 色条标题 + 可选折叠 |
| IconTabRail | Properties 左图标页签（Lucide Stroke） |
| OutlinerTree | 多选/激活态；页签切换数据源 |
| PropRow | 标签 + 控件同一行；对齐网格 |
| Text / Number / Enum / Toggle / Vector3 | 属性编辑 |
| Menu / ContextMenu | Radix + DS 皮 |
| ToolbarIcon | Tool Region |
| NodeChrome | 标题、选中描边、执行态、失败态 |
| ConsoleLine | 级别色、时间、可选 node 链接 |
| StatusBar | 左环境 / 右运行态 |

### 7.3 文案

- 菜单与命令：**动词优先**（添加 Emit、运行整图），少「创建 xxx 数据」式名词套娃  
- 避免无必要的强确认框；破坏性操作才确认  

---

## 8. 与历史 Playground 的关系

| 可迁移 | 需重做 / 外置 |
|--------|----------------|
| host JSON-RPC 思路、`playground-host` / testing 能力 | VS Code Webview 壳与 `--vscode-*` 皮 |
| 节点类型与断言语义（见旧 UI 规格） | 布局改为本文 Screen；日志改为内嵌 Console |
| SFMC 模块试跑经验 | 工程模型改为通用 SAPI + **`plugin-sfmc`** |

旧扩展内 Playground：**不作为 Sapience 主路径**；最多保留启动桥或逐步拆除。

---

## 9. 里程碑（规格级）

1. **仓与壳**：独立仓 + Tauri + Vite + 空 Screen 壳（分区可拖以后置）  
2. **Host**：本机 Node stdio 拉起；Console 接通 loglevel + 宿主日志  
3. **工程打开**：探测 `@minecraft/server` 入口并 `start`  
4. **图 MVP**：Emit / Tick / 基础断言 + 运行整图  
5. **DS**：token + 上表控件铺齐；Blender 向皮  
6. **插件宿主 API + `plugin-sfmc`**：夹具页签与模块根约定；验证禁用插件后 UI/RPC 无 SFMC 残留  
7. **分发**：安装包或绿色目录；SFMC 扩展薄桥可选  

---

## 10. 已锁定决策（头脑风暴）

| 项 | 选择 |
|----|------|
| 品牌 | Sapience |
| 仓库 | 独立仓 |
| 通用性 | 任意 `@minecraft/server` 入口工程（A） |
| 扩展方式 | **插件化**；SFMC = `plugin-sfmc`，非核心分支 |
| 壳 | Tauri；业务 TypeScript；用户自备 Node |
| 宿主 | stdio 子进程 |
| 视觉 | 强致敬 Blender；色板可替换 |
| 布局 | 三栏 + 底 Console + 可选 Tool |
| Properties | 左侧图标页签 |
| Outliner | 场景 / 图 / 夹具页签 |
| 插入 | 菜单 + 工具条 + 右键，同一命令表 |
| DS 文档深度 | 可落地（token + 控件清单） |
| 图标 | Lucide Outlined / Stroke |
| UI 字体 | Inter |
| 图表库 Recharts | 后置，有明确图表需求再加 |

---

## 11. 仓内路径

| 文件 | 路径 |
|------|------|
| 本规格 | `docs/specs/2026-08-01-sapience-design.md` |
| 交接 | `docs/notes/sapience-handoff.md` |
| 线框归档 | `docs/brainstorm-archive/` |

工作根：`D:\WorkPlace\Sapience`。可在本对话线程内续作。
