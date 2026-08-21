# AGENTS.md — ScriptsForMinecraftServer

Agent 仓速查。人类详文：`docs/zh/dev/`。语言与注释：简体中文。

技能入口（现状剧本）：`.cursor/skills/sfmc-onboarding` · `sfmc-module-author` · `sfmc-code-review`。

## 三根路径

| 根            | 内容                                       |
| ------------- | ------------------------------------------ |
| **monorepo**  | 平台源码（本仓；路径含 `#` 时命令加引号）  |
| **SFMC_ROOT** | 工作目录：`configs/`、`modules/`、运行数据 |
| **作者仓**    | 单个业务模块的独立 git 仓                  |

`packages/*` = 平台包；`modules/packages/<id>/` = SFMC_ROOT 上的模块安装目标（主仓默认且一般为空）。

## 包地图

| 路径                               | 包 / 职责                              |
| ---------------------------------- | -------------------------------------- |
| `modules/sdk/@sfmc-sdk/`           | `@sfmc-bds/sdk`（Node + SAPI）         |
| `modules/sdk/@sfmc-eslint-plugin/` | `@sfmc-bds/eslint-plugin`              |
| `packages/db-server/`              | SQLite HTTP，默认 `:3001`，Node ≥22.13 |
| `packages/qq-bridge/`              | QQ 桥（official / llbot）              |
| `packages/bds-tools/`              | BDS 更新 + 行为包组装                  |
| `packages/cli/`                    | `@sfmc-bds/cli`：编排与 REPL           |
| `packages/meta/`                   | `@sfmc-bds/sfmc` 聚合包                |
| `packages/create-module/`          | `npm create @sfmc-bds/module`          |
| `packages/devkit/`                 | Watch / rebuild                        |
| `packages/sfmc-extension/`         | 扩展「SFMC Module」                    |
| `packages/tools/`                  | 仓内 verify / docs / release（私有）   |

能力在 `bds-tools` / `db-server` / `qq-bridge` / SDK；CLI 只编排。

## 模块安装与索引

| 数据     | 位置                                       |
| -------- | ------------------------------------------ |
| 已装镜像 | `modules/catalog.json`                     |
| 启停     | `modules/module-lock.json`                 |
| 契约     | `modules/packages/<id>/sapi/manifest.json` |
| 发现     | `sfmc-modules` 的 `index.json`（npm 优先） |

```bash
sfmc mod search
sfmc mod install <id> [--from <source>] [--link]
sfmc mod uninstall <id>
```

`--from`：默认 npm `@sfmc-bds/module-<id>`；另支持 `github:` / `dir:` / `local:` / `tgz:` / `zip:`。`--link` 挂接作者仓。装载实现：`modules/sdk/@sfmc-sdk/src/module-loader/`。

## 行为包

部署时由 CLI + `bds-tools` 组装（仓内无固定壳）。

```bash
sfmc mod build      # → <SFMC_ROOT>/packs/_build/sfmc-modules/
sfmc mod reload     # build + deploy + 请求 BDS reload
```

- banner：`installHostBootstrap()`；入口 `ModuleRegistry.register`
- 遍历 lock 中 enabled 且 catalog 有的 `sapi/src/index.ts` → `scripts/main.js`
- 目标：`<BDS>/worlds/<level>/behavior_packs/sfmc-modules/`（RP：`sfmc-modules-rp`）

| 变更                       | 生效                      |
| -------------------------- | ------------------------- |
| `sapi/src`                 | `mod reload` / 扩展 Watch |
| `configs/*.json`、manifest | 重启 BDS                  |

## 宿主与生命周期

实现：`module-loader/install.ts`。

1. `startup` → `ConfigManager.init()` → `bootAll()` → `snapshotEnabled()`
2. `worldLoad` → `bootAfterWorldLoad()`（`afterWorldLoad: true` 的 `init`）
3. `shutdown` → `teardown()`

`bootModule`：`registerPermissions` → `registerCommands` → `registerEvents` → `init`。

`ConfigManager.init()`：一次 `GET /api/sfmc/configs/all`，缓存 `modules` / `settings` / `permissions` 与 module token。模块私有配置：`@sfmc-bds/sdk/sapi/config`。

运行中启停：`POST /api/sfmc/modules/:id/{enable|disable}` → lock → `refreshModules()` → `reconcile()`。

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

## 配置与 HTTP

- 平台 JSON：`configs/*.json`（gitignore；服务首次启动写默认值 + `$schema`）
- 运行时写 lock：仅 enable/disable
- 模块配置：运行中可 `config.set`；整包仍靠重启 / reload 边界如上
- db-server：loopback；SAPI 客户端目标 `127.0.0.1:3001`
- 模块客户端：`@sfmc-bds/sdk/sapi/db|service|config`
- 管控 token：`configs/db_config.json` 的 `http_auth` 或 `HTTP_AUTH`

| 路由                                     | 说明                               |
| ---------------------------------------- | ---------------------------------- |
| `GET /api/sfmc/configs/all`              | SAPI 启动快照（豁免模块鉴权）      |
| `GET /api/sfmc/settings/{key}`           | 设置                               |
| `GET /api/sfmc/{areas,permissions,…}`    | 平台 JSON                          |
| `GET/POST /api/sfmc/db/*`                | Bearer module_token + `?moduleId=` |
| `GET/POST /api/sfmc/services*`           | 同上                               |
| `GET/POST /api/sfmc/configs/<configKey>` | 模块配置命名空间                   |

## 代码约定

| 主题      | 现行做法                                                              |
| --------- | --------------------------------------------------------------------- |
| 消息      | `Msg.*`（`@sfmc-bds/sdk/sapi/runtime`）                               |
| 表单正文  | `ListFormInfo(string[])`：首行 `[*]`，缩进 plain                      |
| 按钮/标题 | 无格式码（「返回」除外）                                              |
| 货币      | 计分板，`Money.UNIT`（`节操`）                                        |
| 命令      | 聊天 `!` / `！`；`Permission.register`：Any=0 … Admin=3               |
| 模块依赖  | `@sfmc-bds/sdk` + `@minecraft/*`；跨模块：manifest + `service` / `tx` |
| SQL 标识  | `sql()` / `.append(raw(...))`                                         |

## QQ Bridge

配置：`configs/qq_config.json`。启动：db-server → qq-bridge → BDS。

| `qq_backend`       | 路径                                                 |
| ------------------ | ---------------------------------------------------- |
| `official`（默认） | Gateway → qq-bridge → db messages；出站 OpenAPI 发群 |
| `llbot`            | LLBot WS:3002 → qq-bridge → db；出站 LLBot HTTP:3004 |

自身消息跳过；message id 5 秒去重。`llbot` 启用时 CLI 可拉起 LLBot。

## 命令速查

```powershell
# monorepo
npm install && npm run build
npm run lint          # 先 build eslint-plugin
npm run typecheck
npm run verify
npm start             # REPL

# 运维（SFMC_ROOT）
npm start -- status|start|stop|restart|init|update
# 服务：db|qq|update|manager|bds|-all

# 作者
npm create @sfmc-bds/module@latest
# Test / Link / Watch / Publish → 扩展「SFMC Module」（create-module + devkit）
```

```bash
# 单包
cd packages/db-server && npm run dev|start|test
cd packages/bds-tools && npm run update|start|stop|status
```

Debug：`variables.json` → `sfmc_debug`；Sentry：`secrets.json` → `SENTRY_DSN`。CLI：`sfmc debug …`。

## 测试与 CI

| 层         | 方式                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| db-server  | `node --test`                                                                |
| SDK / 模块 | `@sfmc-bds/sdk/testing` + `createSandbox()`                                  |
| SDK 本地   | `npm test -w @sfmc-bds/sdk`；mc-fake：`npm run gen:mc-fake -w @sfmc-bds/sdk` |

| Workflow                | 作用                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `ootb.yml`              | ubuntu+windows；build → 单测 → gen 一致性 → `verify`（无真实 BDS） |
| `docs.yml`              | Rspress + TypeDoc → Pages                                          |
| `changeset-release.yml` | Version Packages → 发布                                            |
| `npm-publish.yml`       | 紧急单包（默认 beta）                                              |

Node：`engines` ≥22.13；CI 跟 `.node-version`。可发布包 API/行为变更带 changeset；pre 模式发 beta tag。

## 工程约定

- Prettier：双引号、`trailingComma: es5`、`tabWidth: 2`、`printWidth: 120`、`endOfLine: crlf`
- gitignore：`configs/`、`data/`、`dist/` 等；缺 config 由服务写默认
- `SFMC_ROOT` 读配置；`modulesDir` 默认 `"modules"`
- Schema：`modules/sdk/@sfmc-sdk/schemas/` + `.vscode/settings.json`
- 包内构建：workspace `@sfmc-bds/tools` 的 `sfmc-esbuild-transpile` / `tsc7`
- 审查：DRY / OCP / DIP / LSP / 迪米特 → skill `sfmc-code-review`

## Cloud（Linux）

```bash
npm install && npm run build --workspaces --if-present
SFMC_ROOT=$PWD node packages/db-server/dist/index.js
# GET http://127.0.0.1:3001/api/health
```

## 延伸阅读

| 主题               | 路径                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| 架构 / 平台 / 约定 | `docs/zh/dev/architecture.md` · `platform.md` · `conventions.md`     |
| 构建 / 作者 / 测试 | `docs/zh/dev/build-pipeline.md` · `module-author.mdx` · `testing.md` |
| 文档站             | `website/AGENTS.md`                                                  |
