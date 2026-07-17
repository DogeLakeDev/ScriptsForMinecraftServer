# Panel TUI 重构方案 v2(最终版)

> 目标:**简洁 · 精致 · 直达 · 可读 · 现代**
> 状态:设计冻结 → 开始实施

---

## 一、设计决策清单(用户确认版)

| 维度     | 决策                                                                 |
|---------|---------------------------------------------------------------------|
| Tab 数  | **5 个**(总览/服务/监控/模块/配置),**取消数据库查看**(db Tab 整个不要) |
| 导航     | 全部用 `↑↓`,**数字键不进快捷键**(留给输入框)                         |
| 配色     | **One Half Dark** 色系 + 严格白色为主(着色只点缀)                   |
| 配置编辑 | **调用系统编辑器**(VSCode/nano),保存后回 TUI                         |
| 布局     | **双栏**(主列表 + 详情预览),**无独立导航侧栏**                       |
| 视觉     | **禁用线框** —— 用纯色块分块,背景色阶分层                           |
| 输入框   | **增强版** —— 光标移动、历史记录、命令调出                          |
| 语言     | **TypeScript(严格模式)** —— 对齐 db-server 的 tsconfig / 依赖       |

---

## 二、布局结构(双栏 · 无边框)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BDS Panel · 总览                          ●●●○ 3/4   12:34:56            │ ← Header (bg: panel)
├──────────────────────────────────────────────────────────────────────────┤
│  总览                                                                   │
│                                                                        │
│  ┌─左栏─────────────────────┐  ┌─右栏───────────────────────────────┐  │
│  │ 服务                     │  │ 最近日志                            │  │
│  │  ● BDS    PID 14231      │  │ 12:34:51 [!] EADDRINUSE 0.0.0.0:... │  │
│  │  ● DB     PID 8810       │  │ 12:34:50 [+] listening on 19132     │  │
│  │  ● QQ     PID 9921       │  │ 12:34:48 [*] /api/sfmc/modules ok   │  │
│  │  ○ LLBot  -              │  │ 12:34:45 [*] player "Steve" joined  │  │
│  │                          │  │ ...                                 │  │
│  └──────────────────────────┘  └────────────────────────────────────┘  │
│                                                                        │
│  选中行高亮(surfaceHi 浅蓝灰背景),其余行用 panel/surface 色阶分层     │
├──────────────────────────────────────────────────────────────────────────┤
│ 总览 › 最近日志       ↑↓ 选择  Enter 详情  s 启动  x 停止  r 重启  ?   │ ← Footer
│ > _                                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**关键约束**:

- 永远不用 `<Box borderStyle="...">`,所有容器边界用**背景色差**区分
- 选中态 = `surfaceHi` 背景色,无三角/箭头前缀
- Tab 间无背景色变,Header 一行保持统一面板色

---

## 三、五个 Tab

| # | Tab   | 内容                                                            | 主要交互                           |
|---|-------|-----------------------------------------------------------------|------------------------------------|
| 1 | 总览   | 左:服务卡片列表;右:最近日志(着色)                              | Enter 进入服务详情;s/x/r 控制       |
| 2 | 服务   | 左:服务列表;右:**服务详情**(实时日志 + 控制按钮 + 命令输入)    | s/x/r 控制;输入框直发 stdin          |
| 3 | 监控   | 左:系统资源条 + 各服务 CPU/MEM;右:TPS + 实体 + 玩家表           | ↑↓ 翻玩家表                        |
| 4 | 模块   | 左:模块目录(按状态分组);右:模块详情(依赖/命令/描述)          | / 搜索;f 筛选;Enter 切换           |
| 5 | 配置   | 左:配置文件列表;bds_updater/qq_config/panel_config;右:键值预览 | e 调用系统编辑器                    |

频道(chat)**删除**(用户明确不要),数据库(db)整个 Tab **取消**。

---

## 四、统一点击键表(全 Tab 通用)

| 键                | 行为                                                     |
|------------------|----------------------------------------------------------|
| `Tab` / `Shift+Tab` | 在左右栏间切换焦点                                      |
| `↑` `↓`          | 上下选择;翻页(长列表)                                  |
| `←` `→`          | (输入框内)光标左/右移;Backspace 替代 → 删除              |
| `Enter`          | 进入详情 / 提交输入                                       |
| `Esc`            | 返回上一级;**双击 Esc 退出**(3 秒内)                    |
| `q`              | 主面板按一次退出(带确认)                                 |
| `?`              | 帮助弹层                                                  |
| `/`              | 搜索                                                      |
| `f`              | 筛选(模块 / 日志等级)                                    |
| `L`              | 日志等级过滤弹层                                          |
| `s` `x` `r`      | 对当前聚焦服务:**启动 / 停止 / 重启**                    |
| `c`              | 复制当前日志到剪贴板                                      |
| `e`              | 编辑当前选中配置项(调用系统编辑器)                       |
| `Ctrl+S`         | 保存(输入框 / 编辑器返回后)                              |
| `Ctrl+C`         | 立即退出(无确认)                                         |
| `Ctrl+A` / `Ctrl+E` | 输入框:跳到行首 / 行尾                                  |
| `Ctrl+W`         | 输入框:删除一个词                                          |
| `Ctrl+U`         | 输入框:清空当前行                                          |
| `↑` / `↓`        | (输入框聚焦时)**浏览历史命令**                            |
| `Ctrl+R`         | (输入框)调出命令历史(fzf 风格反向搜索)                  |

数字 `0-9` **不绑任何快捷键**,输入框可直接输入数字。

---

## 五、鼠标约定

- **单击**:选中当前行 / 触发卡片主动作
- **双击**:进入详情(等价 Enter)
- **滚轮上下**:滚动日志
- **右键**:返回上一级(等价 Esc)

实现:**Ink useRef + ResizeObserver 测量真实绝对坐标**,组件 mount/resize 时注册到中央命中区表,清除走 effect 清理函数(不再 hack 在 render 函数体里)。

---

## 六、配色方案:One Half Dark

引用 [One Half Dark](https://github.com/sonph/onehalf) 调色板(也是 Atom/Sublime 的经典配色):

| 用途              | 色值       | 说明               |
|-----------------|-----------|------------------|
| `bg`            | `#282c34` | 全局底色            |
| `panel`         | `#21252b` | 卡片 / 侧栏(比 bg 略深)|
| `surface`       | `#2c313c` | 普通行背景          |
| `surfaceHi`     | `#3e4452` | 选中行 / 输入框(最亮)|
| `border`        | (不用线框) |                   |
| `text`          | `#abb2bf` | **主体文字**(白色为主,占大头) |
| `muted`         | `#5c6370` | 副文字 / 时间戳     |
| `subtle`        | `#4b5263` | 占位符 / 分隔符     |
| `red`           | `#e06c75` | 错误关键词          |
| `green`         | `#98c379` | success / OK       |
| `yellow`        | `#e5c07b` | warning            |
| `blue`          | `#61afef` | info / 主色        |
| `cyan`          | `#56b6c2` | URL / 路径         |
| `purple`        | `#c678dd` | 玩家名 / 字符串常量 |
| `orange`        | `#d19a66` | IP / 端口 / 数字    |

### 日志分词着色规则(白色 `text` 占比 ≥ 70%)

每条日志:`[level] content`

1. **level 前缀**:`[*]` 蓝、`[+]` 绿、`[!]` 黄、`[x]` 红、`[?]` 灰
2. **关键词高亮**(只染关键 token,其余保持 `text`):
   - `\b(ERROR|FAIL|失败|错误|panic)\b` → red
   - `\b(WARN|警告|warning)\b` → yellow
   - `\b(SUCCESS|成功|OK|started|listening)\b` → green
   - `\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b` → orange(IP + 可选端口)
   - `\b\d+\b` → orange(普通数字,不要染太长上下文)
   - `\b[A-Z][a-z]+Error\b` → red
   - `\b(qq_\d+|玩家名|player)\b` → purple
   - `(https?://[^\s]+|/api/[^\s]+|/[\w./-]+\.(?:json|ts|js))` → cyan
3. **时间戳前缀**(`HH:MM:SS`):muted
4. **其余全部保留 `text` 色**(主体色,白灰)

示例输出:

```
12:34:51 [!] db-server EADDRINUSE 0.0.0.0:3001
            ^yellow ^red         ^orange^  ^orange^
12:34:50 [+] BDS listening on 19132
            ^green                  ^orange
12:34:48 [*] GET /api/sfmc/modules 200 (player "Steve")
            ^blue  ^blue^cyan      ^orange ^purple
```

---

## 七、配色应用规范

- **不使用** `borderStyle` 任何值
- **不使用** `borderColor`
- **不使用** ASCII 表格字符(`┌ ┬ ┐ │ ├ ┤ └ ┴ ┘`)或长 `─` 横线分隔
- 容器边界 = 背景色差(左栏用 `panel`,右栏用 `surface`,选中用 `surfaceHi`)
- 视觉层次仅靠 4 个灰度 + 7 个语义色

---

## 八、文件结构

```
panel/
├── package.json                  # + typescript, tsx, prettier 等
├── tsconfig.json                 # ★ 对齐 db-server
├── .prettierrc.json              # 对齐 db-server
├── index.js                      # 入口(保留 JS,转 tsx 启动)
├── src/
│   ├── main.ts                   # ★ 入口(替代 tui-react.js)
│   ├── theme.ts                  # One Half Dark token + level 配色
│   ├── store.ts                  # 统一状态层(zustand-lite,~60 行)
│   ├── api/
│   │   └── client.ts
│   ├── log/
│   │   ├── buffer.ts             # 日志条目 {level, source, time, text}
│   │   └── highlighter.ts        # ★ 分词着色器
│   ├── input/
│   │   ├── router.ts             # ★ 按模式分发 useInput
│   │   ├── history.ts            # ★ 命令历史 + Ctrl+R 搜索
│   │   └── mouse.ts              # 声明式命中区 + 测量
│   ├── services/
│   │   └── manager.ts            # 进程管理
│   ├── monitor/
│   │   └── collector.ts          # 改为 store 的输入源
│   ├── ui/
│   │   ├── Shell.tsx             # 重写:Header / Footer
│   │   ├── ServiceCard.tsx       # ★ 服务卡片
│   │   ├── LogBlock.tsx          # ★ 渲染着色日志
│   │   ├── ConfigEditor.tsx      # ★ 调系统编辑器
│   │   ├── StatusLine.tsx
│   │   ├── Spinner.tsx
│   │   ├── HelpOverlay.tsx
│   │   ├── ConfirmOverlay.tsx
│   │   └── common.tsx            # KeyHint/ScrollBar/Crumb
│   ├── views/
│   │   ├── Dashboard.tsx
│   │   ├── Services.tsx          # 服务 Tab
│   │   ├── Monitor.tsx
│   │   ├── Modules.tsx
│   │   └── Configs.tsx           # 配置 Tab
│   └── app.tsx                   # 根组件,~100 行
└── monitor.js                    # 删除(移到 src/monitor/)
```

---

## 九、TypeScript 迁移规范(对齐 db-server)

### tsconfig.json(完整复制 db-server)

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "nodenext",
    "target": "esnext",
    "lib": ["esnext"],
    "types": ["node"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### package.json(新增依赖)

```jsonc
{
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^7.1.0",
    "pidusage": "^4.0.1",
    "react": "^19.2.7",
    // 新增(对齐 db-server)
    "ts-node": "^10.9.2"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "typescript": "^6.0.3",
    "prettier": "^3.9.5",
    "prettier-plugin-organize-imports": "^4.3.0",
    "tsx": "^4.x"  // 比 ts-node 快,开发用
  }
}
```

### 编码规范

- **ESM**(`"type": "module"`),所有相对导入必须带 `.js` 后缀(TS 解析时映射到 `.ts`)
- **`import type`** 用于纯类型导入(`verbatimModuleSyntax` 强制)
- **`jsx: "react-jsx"`**,JSX 不需要 `import React`,直接 `<Foo />`
- **不导出未使用的变量/参数**(`noUnusedLocals`)
- **不导出未使用的私有函数**
- **类型严格**:`noUncheckedIndexedAccess` 强制所有数组/对象下标访问判 `undefined`
- **React 组件**:统一用 `function Component({...}: Props) { return h(...) }` 形式,或 FC 但明确 Props 类型

---

## 十、核心新组件草图

### 10.1 `store.ts`(zustand-lite,~60 行)

```ts
type State = {
  tab: 'dashboard' | 'services' | 'monitor' | 'modules' | 'configs';
  focus: 'left' | 'right';
  selectedLeft: number;
  selectedRight: number;
  services: Record<ServiceName, ServiceStatus>;
  monitor: MonitorSnapshot;
  modules: Module[];
  configs: ConfigFile[];
  logs: LogEntry[];
  logFilter: LevelFilter;
  toast: Toast | null;
  modal: ModalState | null;
  inputHistory: string[];
};
const _state: State = { ...初始值 };
const _subs = new Set<() => void>();
export const get = (): State => _state;
export const set = (patch: Partial<State>): void => { Object.assign(_state, patch); _subs.forEach(fn => fn()); };
export const useStore = <T>(selector: (s: State) => T): T => { /* useSyncExternalStore */ };
```

### 10.2 `log/highlighter.ts`

```ts
type Token = { text: string; color: string; bold?: boolean };
const PATTERNS: { re: RegExp; color: string; bold?: boolean }[] = [
  { re: /\b(ERROR|FAIL|失败|panic)\b/gi, color: T.red, bold: true },
  { re: /\b(WARN|警告|warning)\b/gi, color: T.yellow },
  { re: /\b(OK|SUCCESS|成功|started|listening)\b/gi, color: T.green },
  { re: /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, color: T.orange },
  { re: /\b\d{2,5}\b/g, color: T.orange },
  { re: /\bqq_\d+\b/g, color: T.purple },
  { re: /"[^"]+"/g, color: T.purple },
  { re: /(https?:\/\/[^\s]+)/g, color: T.cyan },
  { re: /(\/api\/[^\s]+)/g, color: T.cyan },
];
export function tokenize(line: string): Token[] { /* 扫描+切分 */ }
```

### 10.3 `input/router.ts`(按模式切分)

```ts
type Mode = 'normal' | 'input' | 'confirm' | 'help' | 'modal';
type Handler = (input: string, key: Key) => boolean;
const HANDLERS: Record<Mode, Handler[]> = {
  normal: [tabSwitch, navList, actionKeys, mouseClick],
  input: [historyNav, textEdit, submit],
  confirm: [yN],
  help: [dismiss],
  modal: [dismiss],
};
export function dispatch(input: string, key: Key): void {
  const mode = currentMode();
  for (const h of HANDLERS[mode]) if (h(input, key)) return;
}
```

### 10.4 `input/history.ts`(命令历史)

- 持久化:`~/.bds-panel.history`(每条命令一行,最多 500)
- `↑`/`↓`:翻历史(从最新开始)
- `Ctrl+R`:进入反向搜索模式,输入子串实时筛选,Enter 调出,Esc 退出
- 普通模式下:`:` 进入命令模式(类似 vim)

---

## 十一、迁移步骤

| Task | 内容                                                         |
|------|--------------------------------------------------------------|
| 1    | **本文档**(完成)                                              |
| 7    | 迁移 panel 到 TypeScript(tsconfig/package/目录结构)            |
| 2    | theme(One Half Dark)+ store + ui/common                      |
| 3    | 鼠标声明式 + input router                                    |
| 4    | 日志分词着色器 + LogBlock                                     |
| 5    | 5 个视图 + ServiceCard + ConfigEditor                         |
| 6    | app.tsx 骨架 + 集成 + 跑通验证                                |

---

## 十二、风险与对策

| 风险                          | 对策                                                              |
|------------------------------|------------------------------------------------------------------|
| Ink 7 + verbatimModuleSyntax | 必要时关闭部分检查,保持 ESM 兼容性;实际跑通为准                   |
| tsx 与 Ink 鼠标 stream 冲突   | 用 child_process 跑 TUI,父进程做 CLI 包装(index.js → spawn tsx) |
| 配置编辑器调用阻塞 TUI        | 在子进程 spawn 编辑器,TUI 暂停响应;编辑器退出后刷新文件并显示 toast |
| 一半 Dark 在浅色终端不友好    | 用户环境是 Windows Terminal / iTerm,默认深色,无需做 light 主题  |
| 多 Tab 切换动画闪屏           | 不做动画,直接重渲染;Ink 已优化                                  |

---

## 十三、验收清单

- [ ] 5 个 Tab 切换无残留状态
- [ ] 服务卡片 4 个服务状态实时刷新
- [ ] 日志按 level + 关键词分词着色,白色占比 ≥ 70%
- [ ] 鼠标单击/双击/滚轮/右键全部生效
- [ ] 输入框 ↑↓ 翻历史、Ctrl+R 反向搜索、Ctrl+A/E/W/U 全部生效
- [ ] 配置 Tab 按 `e` 调起 nano/vscode,保存后 TUI 立即重新加载
- [ ] 整个 TUI 没有任何 `borderStyle` 或 ASCII 表格字符
- [ ] `tsc --noEmit` 零报错
- [ ] `npm start` 一键启动
- [ ] 总览页一眼看到 4 服务状态 + 关键指标 + 最近错误
