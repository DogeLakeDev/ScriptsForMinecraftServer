# AGENTS.md — ScriptsForMinecraftServer

面向 Cursor / Codex 等 agent 的仓库速查。人类读者详见 `docs/zh/dev/`。

**语言：** 本文档与代码注释默认简体中文。

## 仓库结构

npm workspaces 单体仓库（根 `package.json` 的 `workspaces`）。

| 路径 | 职责 | 运行时 |
|------|------|--------|
| `modules/sdk/@sfmc-sdk/` | SDK 伞包（`@sfmc-bds/sdk`） | Node + SAPI |
| `modules/sdk/@sfmc-eslint-plugin/` | ESLint 规则（`@sfmc-bds/eslint-plugin`） | Node |
| `modules/packages/<id>/` | **业务模块安装目录**（主仓默认可空，见下文） | Node + SAPI |
| `packages/db-server/` | SQLite HTTP REST 后端 | Node.js ≥22.13 |
| `packages/qq-bridge/` | QQ 桥（官方 Bot / LLBot） | Node.js |
| `packages/bds-tools/` | BDS 自动更新 + 行为包组装 | Node.js |
| `packages/cli/` | sfmc CLI（REPL + 进程监管，`@sfmc-bds/cli`） | Node.js |
| `packages/meta/` | `@sfmc-bds/sfmc` 聚合包 | Node.js |
| `packages/devkit/` | 作者 Watch / scaffold（`@sfmc-bds/devkit`） | Node.js |
| `packages/sfmc-extension/` | VS Code/Cursor 扩展「SFMC Module」 | — |
| `packages/tools/` | 自检、fetch、catalog、docs、release 脚本 | Node.js |
| `packages/remote-controller/` | 远程 agent | Node.js |

**目录约定：** `packages/*` = 平台包；`modules/packages/*` = 业务模块。勿混淆。

**包独立性：** BDS 更新、pack 组装、探活等能力落在 `bds-tools` / `db-server` / `qq-bridge` / SDK 内，须能不经 CLI 独立调用。`@sfmc-bds/cli` 只做编排与交互壳；**禁止**服务包反向依赖 cli。

## 业务模块不在主仓

主仓 **默认不包含** 已安装的业务模块；`modules/packages/` 仅是安装目标（可为空，仅 `.gitkeep`）。

| 数据 | 路径 / 来源 |
|------|-------------|
| 已装模块镜像 | `modules/catalog.json`（本地投影） |
| 启停状态 | `modules/module-lock.json` |
| 模块契约 | `modules/packages/<id>/sapi/manifest.json` |
| 发现索引 | `sfmc-modules` 仓库 `index.json`（npm 优先） |

安装 / 卸载：

```bash
node packages/tools/fetch-module.mjs search
node packages/tools/fetch-module.mjs install <id> [--from <source>] [--link]
node packages/tools/fetch-module.mjs uninstall <id>
```

**来源（`--from`）：** 默认 npm `@sfmc-bds/module-<id>`；亦支持 `github:owner/repo@tag`（兼容 `Tanya7z/sfmc-modules`）、`local:` / `dir:` / `tgz:` / `zip:`；`--link` 可 junction/symlink 到作者仓。

运行时接线：`modules/sdk/@sfmc-sdk/src/module-loader/`。

## SAPI 行为包：构建与部署

行为包 **无** 提交到仓库的固定壳；部署时由 CLI + `bds-tools` 组装。

```bash
sfmc mod build      # esbuild → <SFMC_ROOT>/packs/_build/sfmc-modules/
sfmc mod reload     # build + deploy + 请求 BDS reload
# 等价旧称：sfmc behavior-pack build / deploy
```

- esbuild banner 注入：`installHostBootstrap()`（`@sfmc-bds/sdk/module-loader/install`）
- 遍历 **lock 中 enabled** 且 catalog 有的模块 `sapi/src/index.ts`，输出 `scripts/main.js`
- 每个模块入口须 `ModuleRegistry.register({ id, lifecycle })`
- 改 SAPI 源码 → `mod reload`；改 `configs/*.json` 或 manifest → **重启 BDS**

部署目标：`<BDS>/worlds/<level>/behavior_packs/sfmc-modules/`（RP 为 `sfmc-modules-rp`）。

## SAPI 宿主启动顺序

实现在 `modules/sdk/@sfmc-sdk/src/module-loader/install.ts`，**不是**旧版 Peace/Fly/MonitorReporter 硬编码列表。

1. **`system.beforeEvents.startup`**  
   `ConfigManager.init()` → `ModuleRegistry.bootAll()` → `snapshotEnabled()`
2. **`world.afterEvents.worldLoad`**  
   `ModuleRegistry.bootAfterWorldLoad()`（仅 `afterWorldLoad: true` 的模块执行 `init`）
3. **`system.beforeEvents.shutdown`**  
   `ModuleRegistry.teardown()`

`bootModule` 单模块顺序：`registerPermissions` → `registerCommands` → `registerEvents` → `init`（非 `afterWorldLoad` 或已 worldLoad 时）。

`ConfigManager.init()` 一次性 `GET /api/sfmc/configs/all`，只缓存 `modules` / `settings` / `permissions` 及 **module token 表**；不轮询。模块私有配置走 `@sfmc-bds/sdk/sapi/config`。

**待接线（install 注释，尚未实装）：** `setModuleGuard`（`Command.trigger` 运行时守卫）、宿主层统一 `chatSend → Command.trigger` 桥。测试沙箱已内置 chat 桥；BDS 生产路径目前依赖模块 `registerEvents` 或后续宿主补全。

## 模块生命周期

```ts
ModuleRegistry.register({
  id: "feature-afk",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {},
    registerCommands() {},
    registerEvents() {},
    async init() {},
    cleanup() {},
  },
});
```

运行中启停：`POST /api/sfmc/modules/:id/{enable|disable}` → db-server 写 lock → SAPI `ConfigManager.refreshModules()` → `ModuleRegistry.reconcile()`。

## 配置模型（无热重载）

- 平台 JSON：`configs/*.json`（gitignore；各服务首次启动写默认值 + `$schema`）
- **改平台配置 → 重启 BDS**（无 reload 命令、无轮询）
- **唯一运行时写 lock 的 REST：** `POST /api/sfmc/modules/:id/{enable|disable}`
- 模块 JSON 运行中可经 `config.set` 写回；仍无整包热更

关键端点：

| 路由 | 说明 |
|------|------|
| `GET /api/sfmc/configs/all` | SAPI 启动快照（**豁免** v2 模块鉴权） |
| `GET /api/sfmc/settings/{key}` | 设置；`bridge_channel_id` 等可回退到对应 JSON |
| `GET /api/sfmc/{areas,permissions,...}` | 匹配的平台 JSON |
| `GET/POST /api/sfmc/db/*` | v2：Bearer **module_token** + `?moduleId=` |
| `GET/POST /api/sfmc/services*` | 同上 |
| `GET/POST /api/sfmc/configs/<configKey>` | 模块配置命名空间（非 `/all`） |

db-server 仅监听 loopback。legacy 管控 token：`configs/db_config.json` 的 `http_auth` 或 `HTTP_AUTH`（主要约束非公开 POST/PUT）。

SAPI 侧 db/config/service 客户端目标 `127.0.0.1:3001`（硬编码）。**模块禁止新用 legacy `HttpDB`**，用 `@sfmc-bds/sdk/sapi/db|service|config`。

## 代码约定

- **消息：** `Msg.info/success/error/warning/tips()`（`@sfmc-bds/sdk/sapi/runtime`）。**禁止** `player.sendMessage()`（ESLint `no-player-send-message`）
- **表单正文：** `ListFormInfo(string[])` — 首行 `[*]`，缩进行 plain
- **按钮/表单标题：** 无格式码（「返回」除外）
- **货币：** 计分板，`Money.UNIT`（`节操`）
- **命令：** 聊天 `!命令` / `！命令`；`Permission.register(name, level)` — Any=0, Member=1, OP=2, Admin=3
- **模块守卫：** 未启用模块不参与 `bootAll`；`Command.register` 可带 `moduleId`；`Command.trigger` 预留 `moduleGuard` 钩子
- **模块边界：** 只依赖 `@sfmc-bds/sdk` + `@minecraft/*`；跨模块走 manifest + `service.get` / `tx.call`；不读他模块私有表、不 import 他模块源码
- **SQLite 标识符（db-server）：** 可信标识用 `sql()` / `.append(raw(...))`，勿 `` SQL`…${table}…` ``

## QQ Bridge

文件：`packages/qq-bridge/index.js` → `dist/index.js`。配置：`configs/qq_config.json`。

| `qq_backend` | 行为 |
|--------------|------|
| `"official"`（默认） | QQ 开放平台 Gateway；QQ→MC 仅转发群内 @机器人；MC→QQ 由 db-server 调官方发群 API |
| `"llbot"` | WS 3002（LLBot reverse-ws）；MC→QQ 由 db-server 直连 LLBot HTTP（默认 3004） |

消息流：

```text
Official:
  QQ → MC: Gateway ─WS──→ qq-bridge ─POST──→ db-server:3001/api/sfmc/messages
  MC → QQ: db-server ─HTTPS──→ OpenAPI /v2/groups/{group_openid}/messages

LLBot:
  QQ → MC: LLBot ─WS:3002──→ qq-bridge ─POST──→ db-server:3001/api/sfmc/messages
  MC → QQ: db-server ─HTTP──→ LLBot:3004/send_group_msg
```

防循环：跳过 bot 自身消息；message id 5 秒去重。

**启动顺序：** db-server → qq-bridge → BDS（`qq_backend=llbot` 且启用时 CLI 才拉起 LLBot）。

## 根目录命令

```powershell
npm install
npm run build                    # 全部 workspace
npm run start                    # sfmc CLI REPL
npm run lint                     # 先 build eslint-plugin，再 eslint .
npm run typecheck
npm run verify                   # 平台集成自检（CI 默认）
npm run check-ootb               # verify 别名
npm run catalog-sync             # 装模块后投影 catalog（维护命令）
npm run syncpack:lint
```

### db-server

```bash
cd packages/db-server
npm run dev          # tsx src/index.ts
npm run start        # node dist/index.js
npm run test
```

默认端口 **3001**（`configs/db_config.json` 的 `db_port`）。

### bds-tools

```bash
cd packages/bds-tools
npm run build
npm run update             # BDS 更新检查/执行
npm run update:check
npm run update:force
npm run rollback
npm run start|stop|status|watch
```

### sfmc CLI

```bash
npm start -- status
npm start -- start db|qq|update|manager|bds|-all
npm start -- stop …
npm start -- restart …
npm start -- init
npm start -- update
```

`SFMC_SERVICE` 环境变量：`db` / `qq` / `update` / `manager`。

**作者向** `mod test|watch|publish` 已迁至 **VS Code 扩展 + `@sfmc-bds/devkit`**；CLI 保留运维向 `mod build|reload|install|enable|disable|…`。

### 开发工具脚本

```bash
node packages/tools/verify.mjs
node packages/tools/catalog-sync.mjs
node packages/tools/check-modules.mjs
node packages/tools/fetch-module.mjs install <id>
```

## SAPI debug 与 Sentry

```ts
import { debug } from "@sfmc-bds/sdk/sapi/runtime";
```

| 开关 | 位置 |
|------|------|
| 控制台 debug | BDS `variables.json` → `sfmc_debug: true` |
| Sentry | `secrets.json` → `SENTRY_DSN` |

CLI（仅外部 argv）：`sfmc debug status|enable|disable`、`sfmc debug sentry on --dsn <url>|off`。改 BDS 配置后需 `mod reload` 或重启 BDS。

## 测试

- db-server：`node --test`（`packages/db-server`）
- SDK / 模块：`@sfmc-bds/sdk/testing` + `node --test`
- 无 BDS 时用 `createSandbox()` 对齐宿主分相（含 chat → `Command.trigger` 桥）

本地 SDK 单测：`npm test -w @sfmc-bds/sdk`。改 mc-fake 生成物后：`npm run gen:mc-fake -w @sfmc-bds/sdk` 并提交 `testing/engine/generated/`。

## CI

| Workflow | 触发 | 要点 |
|----------|------|------|
| `ootb.yml` | push/PR → `main` / `refactor/**` | 矩阵 ubuntu + windows；**不启真实 BDS** |
| `docs.yml` | push → `main`（docs 路径） | Rspress + TypeDoc → GitHub Pages |
| `changeset-release.yml` | push → `main` | Version Packages PR → 发布 |
| `npm-publish.yml` | `workflow_dispatch` | 紧急单包发布（默认 beta tag） |

**ootb 步骤：** `npm ci` → build all → 各 workspace 单测 → `gen:mc-fake` 一致性 → **`npm run verify`**（一次起 db）。

**Node 版本：** `engines` 最低 **≥22.13.0**（`node:sqlite` 无 flag）；CI 以根目录 **`.node-version`** 为准（当前见文件内容）。

**发布规则：** 改动可发布包公开 API/行为时 PR 须含 changeset（`npx changeset`）。pre 模式（`.changeset/pre.json`）下勿发 `latest`。

## Prettier

双引号、`trailingComma: es5`、`tabWidth: 2`、`printWidth: 120`、**`endOfLine: crlf`**（Windows 仓约定）。插件：`prettier-plugin-organize-imports`。

## 注意事项

- **`configs/`、`data/`、`dist/`** 等 gitignore；缺失 config 由服务写内置默认
- **`SFMC_ROOT`**：db-server 等从此根读 `configs/`；`verify` 内含隔离根目录模拟
- **`modulesDir`** 默认 `"modules"`（相对 `SFMC_ROOT`）
- **JSON Schema：** `modules/sdk/@sfmc-sdk/schemas/` + `.vscode/settings.json`
- **构建脚本：** 包内用 `@sfmc-bds/tools` 的 `sfmc-esbuild-transpile` / `tsc7`，勿写 `node ../../../tools/...`
- **审查维度：** DRY、OCP、DIP、LSP、最少知识；重复鉴权/lock 读写/核心 switch 打洞优先抽取

## Cursor Cloud（Linux VM）

Cloud 环境为 Linux；Node 服务可正常运行。

每次会话跑服务前：

1. `npm install`
2. **`npm run build --workspaces --if-present`**（`dist/` 被 ignore，缺 build 会 import 失败）
3. 首次启动会自动写 `configs/` 默认 JSON

```bash
SFMC_ROOT=$PWD node packages/db-server/dist/index.js
# 健康检查：GET http://127.0.0.1:3001/api/health
```

**`node:sqlite` 必须 Node ≥22.13**（非 22.5–22.12 的 experimental 路径）。

lint：先 `npm run build --workspace @sfmc-bds/eslint-plugin`，再 `npm run lint`。

## 延伸阅读

| 主题 | 路径 |
|------|------|
| 架构 | `docs/zh/dev/architecture.md` |
| 平台开发 | `docs/zh/dev/platform.md` |
| 代码约定 | `docs/zh/dev/conventions.md` |
| 构建装载 | `docs/zh/dev/build-pipeline.md` |
| 模块作者 | `docs/zh/dev/module-author.md` |
| 测试沙箱 | `docs/zh/dev/testing.md` |
| 文档站 agent 说明 | `website/AGENTS.md` |
