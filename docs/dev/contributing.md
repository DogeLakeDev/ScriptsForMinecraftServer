# 贡献指南

面向向本仓提交改动的开发者：环境、根脚本用法、仓库规则。业务模块源码在 [sfmc-modules](https://github.com/Tanya7z/sfmc-modules)，本仓是平台与 SDK。

更细的约定见 [代码约定](./conventions.md)；工具细节见 [工具脚本](./tools.md)；发包见 [npm 发布](./npm-publish.md)。

## 环境

- **Node.js ≥ 22.13**（`db-server` 依赖未加 flag 的 `node:sqlite`）
- **npm workspaces**（勿用 pnpm 的 `workspace:*` 写本地依赖；用 `^` 对齐各包 `version`）
- 可选：Python 3.12 + `pip install -r docs/requirements.txt`（文档站）

```bash
npm install
npm run build
npm run check-ootb
```

## 根目录 npm scripts

在仓根执行。精简后的入口如下（中间发版步骤已收入 `tools/run-release.mjs`，不再逐个挂脚本）。

### 日常

| 命令 | 说明 |
| ------ | ------ |
| `npm run build` | 各 workspace `build`（`--if-present`） |
| `npm run typecheck` | 各 workspace `typecheck` |
| `npm run lint` | 先 build eslint-plugin，再 `eslint .` |
| `npm start` | 启动 CLI（`sfmc/dist/main.js`） |

单包：`npm run build -w @sfmc-bds/sdk`（同理 `db-server` / `cli` / …）。

### 平台自检

| 命令 | 说明 |
| ------ | ------ |
| `npm run check-ootb` | 开箱自检（含 catalog-sync、check-modules、db 健康等） |
| `npm run catalog-sync` | 扫描 `modules/packages` → 重写 `catalog.json` |
| `npm run check-modules` | 校验 catalog + v2 manifest（空 catalog 合法） |
| `npm run smoke-modules` | 模块 API 冒烟（需 live db-server） |

单跑 `@minecraft/*` pin：`node tools/check-minecraft-versions.mjs`。

### 文档

```bash
npm run docs -- api      # TypeDoc → docs/reference/sdk
npm run docs -- serve    # TypeDoc + MkDocs serve
npm run docs -- build    # TypeDoc + MkDocs → site/
```

### 依赖对齐（syncpack）

```bash
npm run syncpack:lint
npm run syncpack:fix
npx syncpack format            # 排序 package.json 字段
npx syncpack format --check
```

### 发包相关

| 命令 | 说明 |
| ------ | ------ |
| `npm run changeset` | 添加 changeset |
| `npm run version-packages` | `changeset version`（CI / 本地 bump） |
| `npm run prerelease-packages` | 本地 beta 一键发版（`run-release.mjs --pre`） |
| `npm run release-packages` | 正式发版（`--stable`，需先 `changeset pre exit`） |
| `npm run ci-release-packages` | CI 专用（`--ci`：publish → tag → push → gh） |
| `npm run build:publishable` | 按可发包拓扑 build |
| `npm run pack:verify` | 全量 build 后对各可发包 `npm pack` 冒烟 |

## 仓库规则（必读）

### 边界与依赖

- 业务模块只依赖 `@sfmc-bds/sdk` + `@minecraft/*`；跨模块用 manifest + `service.get` / `tx.call`
- 不要直连 db-server 端口、不要 import 其它模块源码、不要读写对方私有表
- 本地 `@sfmc-bds/*` 用 `^<该包 version>`，**禁止** `workspace:*`（本仓是 npm，不是 pnpm）

### 配置与消息

- 配置为 `configs/*.json`，SAPI 启动缓存；改配置后重启 BDS（无热更）
- 系统消息用 `Msg.info/success/error/warning/tips()`，不要直接 `player.sendMessage()`

### 构建

- 包内 `build` / `typecheck` 走 `@sfmc-bds/tools` 的 bin：`sfmc-esbuild-transpile`、`tsc7`
- 不要写 `node ../../../tools/...` 这类随目录深度变化的相对路径

### 提交与审查

- 尽量不破坏已正确的功能；改函数前先读懂原逻辑，增量修改
- 不提交 `configs/`、`data/`、密钥、本机 `.sfmc/` 状态
- 注释用中文 UTF-8，生成后检查乱码
- 审查关注 DRY / OCP / DIP / LSP / 最少知识；重复鉴权、核心 switch 打洞优先抽公共层

### Prettier

双引号、`trailingComma: es5`、`printWidth: 120`，Windows 仓常用 `endOfLine: crlf`（见根 `.prettierrc.json`）。

## 相关文档

| 文档 | 内容 |
| ------ | ------ |
| [架构](./architecture.md) | 组件与数据流 |
| [模块开发](./module-author.md) | 脚手架、link、reload |
| [平台开发](./platform.md) | 改 SDK / db-server / CLI |
| [工具脚本](./tools.md) | `tools/*.mjs` 细节 |
| [npm 发布](./npm-publish.md) | changesets / beta |
| [代码约定](./conventions.md) | Msg、权限、syncpack |
| [文档站维护](../CONTRIBUTING-DOCS.md) | MkDocs / TypeDoc |
