# 脚本沙箱 Webview MVP 实现计划

> **面向 AI 代理的工作者：** 按任务顺序实现；步骤用复选框跟踪。

**目标：** 扩展 Playground 主路径改为 React + xyflow + Radix 脚本沙箱画布，接现有 `playground-host` RPC，支持整图/从选中/仅选中运行与存盘。

**规格：** [../specs/2026-07-31-sfmc-script-sandbox-ui-design.md](../specs/2026-07-31-sfmc-script-sandbox-ui-design.md)

**架构：** Webview 只管画布与侧栏；纯函数 `orderNodes` + 逐步 `postMessage` 调扩展；扩展 `PlaygroundPanel` 转 RPC。执行顺序逻辑与 UI 解耦，便于后置 CLI。

**技术栈：** React 19、@xyflow/react、@radix-ui/react-dropdown-menu、手写 CSS（`--vscode-*`；Tailwind 因路径 `#` 暂缓）、esbuild 打 Webview、现有 hostClient。

---

## 文件

| 路径 | 职责 |
|------|------|
| `extensions/sfmc-module/src/playground/graph-ui/**` | React 画布应用 |
| `extensions/sfmc-module/src/playground/graph/order.ts` | 拓扑 / 从选中 / 仅选中 |
| `extensions/sfmc-module/src/playground/PlaygroundPanel.ts` | HTML/CSP、自动 start、run/save 消息 |
| `extensions/sfmc-module/build.mjs` | esbuild 扩展 + graph bundle + tailwind |
| `extensions/sfmc-module/package.json` | 依赖与命令标题 |

### 任务 1：脚手架与构建

- [x] 加依赖（react、xyflow、radix；tailwind 暂缓 CLI）
- [x] `build.mjs` 产出 `dist/webview/graph.js` + `graph.css`
- [x] `PlaygroundPanel` 改加载 graph 入口；命令改名「刺激剧本」

### 任务 2：画布 MVP UI

- [x] 五类节点 + 连线 + 侧栏 + 运行菜单 + 日志区
- [x] 皮映射 vscode 变量（手写 CSS；Tailwind 因 `#` 路径暂缓）

### 任务 3：接宿主运行

- [x] `order.ts` + 逐步 create/emit/tick
- [x] 断言对照 webview 日志缓冲；失败红态
- [x] 重置场景 = reset RPC

### 任务 4：存盘

- [x] 保存/打开剧本 JSON（`schemaVersion` + nodes + edges）

### 任务 5：验收手测

- [x] build 通过；F5 开面板见画布（待作者本机 Reload）
