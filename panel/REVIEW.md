# Panel TUI 代码审查报告

> 范围：`panel/`（不含 `node_modules/`）
> 时间：2026-07-16
> 评估维度：**设计合理性 / 交互 / 美观性**

---

## 总体印象

| 维度 | 评分 | 评语 |
|------|------|------|
| 设计合理性 | ⭐⭐⭐ | 顶层骨架清晰，但 `app.js` 单文件状态机已经超载；存在输入路由竞态 |
| 交互 | ⭐⭐⭐ | 鼠标 + 键盘双轨、帮助/确认/退出多层反馈都到位，但快捷键密度过高、状态指示不够明显 |
| 美观性 | ⭐⭐⭐⭐ | `theme.js` 色调克制、整体统一性良好；少量视图混入 ASCII 表格字符破坏视觉节奏 |

亮点：完整的 SGR 鼠标解析（`mouse.js`，27 行流式解析覆盖 SGR 1006）、统一设计 token（`theme.js`）、日志防抖 + 文件轮转（`log-buffer.js`）、React hooks 订阅状态机。

---

## 一、设计合理性

### 1.1 `app.js`（478 行）已经膨胀为"什么都管"的根组件

单文件同时承载：

- 9 个 Tab 路由（`TABS` + `switchTab`）
- 输入栏状态（`inputVal/cursorPos/cursorVisible`）
- Toast / Help / Confirm 三种弹层
- 全局 `useInput` 大分发（85+ 行 if/else 链）
- 服务进程命令（启动/停止/重启/复制日志/BDS 更新）
- 鼠标点击命中区清空（甚至放在 render 函数体里，依赖子组件 effect 顺序）
- 屏幕尺寸响应
- 退出双击确认 + 计时器清理

**问题**：

1. **输入路由是单函数瀑布**（`app.js:218-358`），从 `confirm → help → 退出 → Tab → 帮助 → 全屏页返回 → 焦点区切换 → 侧栏 → Esc 双击退出 → 日志滚动 → 主区导航 → Enter → 输入栏 → 输入字符`。任何分支改动都要通读全文。
2. **可访问性陷阱**：`viewZone.consumesDigits` 模式（`app.js:251-256`）—— 当子视图想"消费数字"时父组件就让路，但消费语义含糊，且没有任何视图实际消费，结果是死代码。
3. **`canUseTabShortcut(inputVal, view)`**（`navigation/rules.js:30`）依赖 `view === 'data'` 来禁用数字 Tab 切换，但实际 `data` Tab 用的是 `/` 搜索式输入，与 `inputVal` 无关，规则语义不直观。
4. **`clearHitRegions()` 在 render 函数体里**（`app.js:47`），靠子组件 useEffect 后注册覆盖父级清空。注释里也承认这是一个"先清空-子组件注册"的顺序 hack，非常脆弱。

### 1.2 服务进程与视图耦合混乱

`app.js:188-216` 的 `checkForUpdate()` 直接 `exec('node BDSTools/check-update.js ...')`，然后**从全局 `logBuf` 扫描关键字判断结果**（`当前版本`/`发现新版本:`/`无需更新`/`未找到`）。这是**字符串嗅探式进程间通信**：一旦 BDSTools 日志改文案，面板就静默失效。这种做法应该换成结构化的 stdout（JSON 行）或 db-server 的版本接口。

### 1.3 日志订阅通道不一致

- `tui-react.js:28-35` 用 `events.on('output', ...)` 订阅服务输出
- `app.js:188` 用 `exec(...)` 直接消费 BDSTools 的 stdout
- `services/manager.js:135` `log()` 方法通过 events emitter
- `app.js:174` 又用 `clip` 命令复制日志（依赖 Windows `clip`）

三种进程交互路径混用，没有任何统一封装。

### 1.4 配置与状态层缺失

- `panel-state.json` 被 `api/client.js:24-26` 同步读取两次（每次请求都读盘），未缓存。
- 没有 store / context；`monitor.js` 自己实现一套 Observer（`_listeners` / `clone()`），与 `log-buffer.js` 又另起一套（`logFns` Set + 节流 set）。
- `services/manager.js` 直接 `loadCfg('bds_updater.json')`、`loadCfg('qq_config.json')` 模块顶层调用，无法热重载。

### 1.5 模块启用的合理性

- `modules/catalog.json` 是真理源，但 `monitor.js` / `view` 都需要硬编码模块 ID（如 `scoreboard_sync`、`activity_log`、`fly` 等）。`ServicesView.js` `SERVICE_ORDER` 写死 `['bds','db','qq','llbot']`，与 catalog 不同步。

---

## 二、交互

### 2.1 键盘映射密度过高且不直观

| Tab | Footer 提示数 | 备注 |
|-----|-------------|------|
| dashboard | 5 | 包含 `Tab`、`1-6`、`PgUp/Dn`、`?`、`q` |
| services | 5 | 含 `1-6 切页` 但此时已在 services 页，含义模糊 |
| modules | 5 | `/` `f` `r` `Enter` `↑↓` |
| chat | 5 | `l` 切换跟随状态——不在 Footer 提示里 |
| data | 4 | `数字+Enter`/`r`——数字本身不显示提示 |

问题：

- **同一个 `1-6` 在不同 Tab 含义不同**（services 页按 `1-6` 实际是切 Tab，因为 `canUseTabShortcut` 视 view 而非 activeTab 决定），用户困惑。
- **`?` `h` `F1` 三个键绑同一动作**（`app.js:260`），没必要。
- **`l` 在 Chat 切换跟随**没有任何视觉提示（除了一行 `[● 跟随最新]`），用户不可能发现。
- **`q` 退出 + `Esc` 双击退出并存**（`app.js:238, 292-309`），两层保护冗余。

### 2.2 焦点区域模型过度抽象

`focusZone` 在 `main` / `sidebar` 间切换（`app.js:41`），通过 `←` `→` 控制。但：

- 窄屏（`compact=true`，列 < 80）时侧栏被隐藏（`app.js:428`），但 `focusZone` 状态仍然存在，可能在 `sidebar` 时窄屏渲染失败。
- 切到 `view='svc'` 后焦点机制完全失效——`useInput` 把所有键交给 `SvcView`（`app.js:263-272`），但 `focusZone` 没有重置。
- `Sidebar` 的鼠标命中区坐标写死 `yCursor = 5`（`Shell.js:71`），与 `Header.height=1 + 上下 margin` 等强耦合，重排 Header 立刻错位。

### 2.3 反馈层 OK 但不连续

**好的**：

- `ConfirmOverlay` 区分破坏性操作（标题含"停止/删除/退出/重启/禁用"自动转红边框，`views/views.js:77`）
- Toast 2.5s 自动消失
- 退出双击 + 3s 计时器（`app.js:300-304`）
- Help 弹层位置 `top:2, left:2`（`app.js:472`）

**不好**：

- **进度反馈缺失**：`modules/bds/qbridge` 启动是 fire-and-forget，唯一信号是 `pushLog`。`actionBusy` 状态（`app.js:73`）只是改 Footer 文本"…服务操作进行中"，没有 spinner。
- **错误无定位**：`describeError`（`ModulesView.js:19-22`）只覆盖两个错误码，db-server 报其它码直接抛 `err.message`（一般是英文），用户看不懂。
- **菜单焦点指示很弱**：`Shell.js:118` 只用 `▶` 三角，但因背景色 `T.focusBg` 与 `T.element` 在多数终端色阶接近（都是深蓝灰），纯键盘用户难以看清选中行。
- **`Footer` 输入栏在 `view === 'svc'` 时常亮**（`app.js:440`），但服务页之外的视图输入栏只显示 `$` 前缀，用户不清楚能否输入。

### 2.4 鼠标命中区注册极其脆弱

`Header`（`Shell.js:38-48`）、`Sidebar`（`Shell.js:87-103`）、`ServicesView`（`ServicesView.js:22-30`）各自手算 `x1/x2/y1/y2` 坐标，然后塞进 `useEffect` 注册。问题：

- 坐标是基于**当前字号**估算的（`Header.js:33` `x2 = x1 + text.length`），非等宽终端/CJK 等宽不同立刻错位。
- `Sidebar` 的 `yCursor=5` 是硬编码，与 Header 实际占用行数无关。
- `ServicesView` 服务行 `y1: 5 + index*3, y2: 5 + index*3 + 2`（`ServicesView.js:26`）—— 假设每服务占 3 行，一旦描述文本换行就错位。
- **`clearHitRegions()` 在 `app.js:47` 的 render 体里调用**，意味着每帧第一件事是清空，然后依赖所有子组件的 useEffect 注册回来。如果某个子组件没注册（例如某个 effect 早于父级），点击就掉地。

### 2.5 数据轮询风暴

- `monitor.js` `setInterval(poll, 3000)`（`monitor.js:65`）
- `ChatView.js:74` `setInterval(load, 5000)` 拉频道
- `ChatView.js:101` `setInterval(load, 3000)` 拉消息
- `DbView.js` 没用轮询但每次开表都重发请求
- `ModulesView.js` 拉一次后只在操作后刷新

没有问题共享节流通道，三个轮询独立 fire。如果未来加更多视图，请求密度会失控。

---

## 三、美观性

### 3.1 主题色彩（`theme.js`）很专业，但使用率分散

```text
T.bg           #0d0f12   深近黑
T.panel        #171b22   面板底
T.surfaceAlt   #1d2230   卡片底
T.element      #273244   选中底
T.focusBg      #273244   ≡ element —— 同一个色
T.border       #3b4658
T.borderFocus  #8ec5ff
```

**问题**：

- `T.element` 与 `T.focusBg` **值完全相同**（`theme.js:7, 22`）。一个用于"卡片元素"，一个用于"焦点"，但视觉上无差别。两套命名暗示存在不同的语义层级。
- `T.surface` 与 `T.panel` 同样完全相同（`theme.js:4, 3`）。
- Header 用 `T.panel` 当底（`Shell.js:49`），Sidebar 也用 `T.panel` 当底（`Shell.js:105`），Dashboard 卡片用 `T.surfaceAlt`（`views.js:39`）。三种背景色应有明确分层，目前几乎看不出。

### 3.2 视觉风格混搭

| 文件 | 元素 | 风格 |
|------|------|------|
| `MonitorView.js:67-82` | 玩家表 | 完整 ASCII 表格（`┌ ┬ ┐ │ ├ ┤ └ ┴ ┘`） |
| `views/views.js:50` | Dashboard 日志分隔 | `─` 长横线 |
| `views.js:215` | Modules 列表 | 文本行 |
| `ServicesView.js:48-61` | 服务列表 | 文本行 + `▶` |
| `ChatView.js:130-163` | 双栏布局 | 文本行 + `─` 横线 |

ASCII 表格只用在 `MonitorView`，其它视图都用横线。在 Ink 这种环境里，ASCII 表的列对齐非常脆弱（`tblRow` 假设所有列都是等宽字符串，`pad()` 还会用 `…` 截断宽度算错），与其它视图的极简风不一致。

### 3.3 状态/前缀系统分散

- `theme.js:33-35` 定义 `LEVEL_PREFIX = { info: '[*]', error: '[x]', ... }`
- `Feedback.js:7-14` 又定义 `STATE = { loading: '[...]', empty: '[-]', ... }` —— 形状相同（都是"符号+空格+文本"），但**符号集不一致**：`LEVEL_PREFIX` 用 `[x]`，`STATE` 用 `[x]`，但 `STATE.loading='[...]'` 与 `LEVEL_PREFIX.error='[x]'` 撞字符；`STATE.success='[+]'` vs `LEVEL_PREFIX.success='[+]'` 一致。
- `Dashboard.js:189` `state = m.enabled ? '启用' : '禁用'` 用中文短语，不是符号
- `ServicesView.js:50-51` `status = '运行中' / '已停止'` 也用短语

一个项目里同时混了"符号前缀"和"中文短语"两种状态表达风格。

### 3.4 文字截断/省略不统一

- `MonitorView.js:21` `pad()` 用 `…`（省略号）
- `ModulesView.js` 无截断（依赖 `Box` flex 行为）
- `views/views.js:14` `line.text.slice(0, logW - 2)` 直接砍尾
- `ChatView.js:157` `m.content.slice(0, msgW)` 直接砍尾

四种截断风格，**没有任何截断工具函数**。

### 3.5 边框风格单一

只在两处使用边框：

- `HelpOverlay` `borderStyle: 'round'`（`app.js:474`）
- `ConfirmOverlay` `borderStyle: 'round'`（`views.js:80`）

其它视图无边框，全靠空白和底色分层。在信息密度高的 MonitorView / DbView 表格里缺乏"容器感"。

### 3.6 进度/加载状态不够视觉化

`Feedback.js:7-14` 给出 6 种 `STATE.kind`，但实际只有 `loading/empty/error/warning/success` 被使用，且全部是**静态文本** + 一个 `[...]` 占位符。无 spinner、无动画帧、无脉冲效果。在 3 秒轮询间隙里，"等待监控数据..."和"等待聊天数据..."视觉完全相同。

### 3.7 可读性问题

- `DbView.js:175` 表格行 `${startIdx + i + 1}. ${vals.join(' | ')}` —— 单元格用 ` | ` 分隔，名字里含 `|` 的数据（玩家名可能）会与分隔符冲突。
- `ChatView.js:157` `${resolveName(m)}: ${(m.content || '').slice(0, msgW)}` —— 没区分玩家/系统消息，时间戳丢失。
- `ServiceDataCards.js:60-62` 详情视图 `JSON.stringify(detailData)` 整块打印 20+ 个对象，没有摘要/折叠。
- `MonitorView.js` 表格表头用全角空格对齐（`玩家` 与维度列），但中文 2 字符宽，量起来常差 1 列。

---

## 四、解决方案（按优先级）

### P0：核心架构清理（影响所有视图）

1. **拆分 `app.js`**——把 useInput 大分发按"模式"切分：
   - `input/globalKeys.js`（Tab、退出、帮助、Toast）
   - `input/focusRouter.js`（main / sidebar / svc / fullscreen）
   - `input/confirmMode.js`（confirm / help 弹层期）
   - `input/commandMode.js`（输入栏命令解析）
   父组件只负责"路由到当前模式"，每个模式自己声明自己的键。
2. **统一进程间通信**——`checkForUpdate` 改用 db-server `/api/sfmc/version` 或 `stdout` JSON 行；`copy_logs` 用 Windows 剪贴板 API 替换 `clip` 调用。
3. **配置缓存层**——新增 `panel/config/store.js`，对 `panel-state.json` / `db_config.json` 内存缓存 + 文件监听。
4. **统一状态/订阅**——把 `monitor.js` 的 Observer 和 `log-buffer.js` 的 Set 都改成单个 `panel/store.js`（zustand-lite 自实现即可，~50 行）。

### P1：交互一致性

1. **消灭冗余快捷键**：
   - `?`/`h`/`F1` 三键绑同一动作 → 只保留 `?`
   - `q` 退出 vs Esc 双击退出 → 只保留一种（推荐 Esc 双击 + Toast）
   - `services` Tab 内 `1-6 切页` 提示去掉（全局一致即可）
2. **重做 Footer 提示**——基于 `view × focusZone × confirm` 三态查表，不在 useInput 里手动写 if/else（已有 `footerHintKeys` 是个好的开始，但分支太多）。
3. **`viewZone.consumesDigits` 移除**（实际无人消费）——所有 Tab 统一数字行为：列表页用 `↑↓` 选择，索引视图（data）保留数字。
4. **进度反馈统一**——`Spinner` 组件：`frames: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`，在 `pushLog('loading', ...)` 后挂到 Toast 旁 2s。
5. **错误码中文映射**——把所有 db-server 已知 `error.code`（`dependency_unmet`、`module_cannot_disable`、`port_in_use` 等）做一张 `errorCodeMap` 表，落 `panel/i18n.js`。

### P2：键盘/鼠标共用

1. **鼠标命中区改声明式**——`useMouseRegion({ id, onClick })` hook：根据当前节点的 `Box` flex 布局自动计算坐标。Ink 不直接暴露 ref，但可以用 `useStdout().write` 配合 `yoga-layout` 输出，或干脆放弃逐像素 hit-region，改成"按 F1-F12 触发动作"（每 Tab 12 个固定动作槽）。
2. **`focusZone` 在窄屏自动重置为 `main`**——避免侧栏被隐藏后状态残留。
3. **`Sidebar` 的硬编码 `yCursor=5` 改成 ref-based**：用 `useRef` 在 mount 后读取实际渲染高度。

### P3：美观性

1. **合并 `theme.js` 同义 token**：`T.surface` 删，`T.focusBg` 改名 `T.elementFocus`（值可与 `T.element` 略不同）。
2. **`borderStyle: 'single'` 普及**——主要视图用单线边框围出"卡片"感，Header 维持无边框。
3. **`pad()`/`truncate()` 工具化**——`panel/ui/text.js`：`truncate(str, w, { ellipsis: '…', pad: ' ' })`。
4. **`STATE` 与 `LEVEL_PREFIX` 合并**——单一 `panel/ui/status.js`，所有地方用同一套语义化状态。
5. **MonitorView 表格用 Ink `<Table>` 替代 ASCII 字符**——`meow` 或自己写 `useFlex` 计算列宽，避免对齐漂移。
6. **Dashboard 卡片视觉分层**——服务状态用三态色（绿/橙/灰）圆形 chip + 名字 + PID 元数据条，参考 `lazygit`/`gh-dash` 的紧凑卡片。

### P4：可访问性/文档

1. **键位提示与实际行为不一致点修复**：`Footer` 显示 `数字+Enter` 在 `data` Tab，但 `modules` Tab 实际行为是 `↑↓ + Enter`，提示与键位冲突。
2. **加 `--dry-run` 模式**：`node panel/index.js --demo` 用 mock 数据预览 TUI，方便截图/调试。

---

## 五、改动文件优先级建议

| 文件 | 改动 |
|------|------|
| `panel/app.js` | **P0**：拆 useInput + 移除 `consumesDigits` 死代码 + clearHitRegions 改 hook 化 |
| `panel/theme.js` | **P3**：合并同义 token、新增 `STATUS` 模块 |
| `panel/ui/` (Shell, Feedback, ScrollBar) | **P2/P3**：键盘/鼠标抽象、`StatusLine` 重做 |
| `panel/views/views.js` | **P1**：合并 `STATE`/`LEVEL_PREFIX`，统一 `truncate()` |
| `panel/views/ModulesView.js` | **P1**：错误码中文映射、Spinner 集成 |
| `panel/services/manager.js` | **P0**：版本检查走 db-server API |
| `panel/store.js` (新建) | **P0**：统一状态层 |
| `panel/input/` (新建) | **P0**：按模式切分的 useInput 子模块 |

---

## 六、附录：可直接复用的现有代码

| 模块 | 作用 | 路径 |
|------|------|------|
| `SectionTitle` | 区段标题 + 右侧 detail | `ui/Feedback.js:24-29` |
| `StatusLine` | 状态行 `[!] text` | `ui/Feedback.js:16-22` |
| `EmptyState` | 空态 | `ui/Feedback.js:31-37` |
| `KeyHint` | 键位提示 | `ui/Feedback.js:40-48` |
| `Crumb` | 面包屑 | `ui/Feedback.js:50-57` |
| `ScrollBar` | 滚动条 | `ui/ScrollBar.js` |
| `Bar` + `fmtBarColor` | 进度条 | `views/MonitorView.js:26-54` |
| `LEVEL_COLOR` / `LEVEL_PREFIX` | 日志级别 | `theme.js:33-43` |
| `requiresConfirmation` | 危险动作判定 | `navigation/rules.js:26-28` |
| `getLayout` | 响应式断点 | `navigation/rules.js:5-24` |
| `appendDigit/removeLastDigit/parseSelection` | 数字输入工具 | `navigation/input.js` |
| `describeError` 思路 | 错误码映射 | `views/ModulesView.js:19-22` |
