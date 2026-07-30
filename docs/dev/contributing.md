# 贡献指南

向本仓（平台与 SDK）提交改动时看这篇。业务模块在独立作者仓发布，不经本仓 changesets。

更细约定见 [代码约定](./conventions.md)；脚本见 [工具脚本](./tools.md)；模块发包见 [发布你的模块](./publish.md)。

## 环境

- **Node.js ≥ 22.13**
- **npm workspaces**（本地 `@sfmc-bds/*` 用 `^<version>`，禁止 `workspace:*`）
- 可选：Python 3.12 + `pip install -r docs/requirements.txt`

```bash
npm install
npm run build
npm run check-ootb
```

## 根脚本

### 日常

| 命令 | 说明 |
| ------ | ------ |
| `npm run build` | 各 workspace build |
| `npm run typecheck` | 各 workspace typecheck |
| `npm run lint` | build eslint-plugin 后 `eslint .` |
| `npm start` | CLI |

单包：`npm run build -w @sfmc-bds/sdk`。

### 自检

| 命令 | 说明 |
| ------ | ------ |
| `npm run check-ootb` | 开箱自检 |
| `npm run catalog-sync` | packages → catalog |
| `npm run check-modules` | catalog + manifest |
| `npm run smoke-modules` | 需 live db-server |

### 文档

```bash
npm run docs -- api
npm run docs -- serve
npm run docs -- build
```

### 依赖对齐

```bash
npm run syncpack:lint
npm run syncpack:fix
npx syncpack format --check
```

### 平台发包

| 命令 | 说明 |
| ------ | ------ |
| `npm run changeset` | 添加 changeset |
| `npm run prerelease-packages` | 本地 beta 一键 |
| `npm run pack:verify` | `npm pack` 冒烟 |

当前 **beta-only**。模块作者发包见 [发布你的模块](./publish.md) 附录。

## 仓库规则

- 业务模块只依赖 `@sfmc-bds/sdk` + `@minecraft/*`；跨模块用 manifest + service
- 不直连 db-server、不 import 其它模块源码、不读写对方私有表
- 配置 JSON、SAPI 启动缓存；改配置后重启 BDS
- 消息用 `Msg.*`，不用 `player.sendMessage()`
- 包内 build/typecheck 走 `@sfmc-bds/tools` bin，勿写随深度变化的 `../../../tools`
- 不提交 `configs/`、`data/`、密钥、本机 `.sfmc/`
- 注释中文 UTF-8；审查关注 DRY / OCP / DIP / LSP / 最少知识

## 相关

| 文档 | 内容 |
| ------ | ------ |
| [架构](./architecture.md) | 分层 |
| [平台开发](./platform.md) | SDK / db / CLI |
| [ESLint 约定](./eslint.md) | 规则 |
| [文档站维护](../CONTRIBUTING-DOCS.md) | MkDocs / TypeDoc |
