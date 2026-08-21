---
name: sfmc-onboarding
description: >-
  SFMC (ScriptsForMinecraftServer) current-state onboarding: three roots
  (monorepo, SFMC_ROOT, author repo), package map, author vs ops surfaces,
  config/reload model, and doc index. Use when starting work in this repo,
  running the stack, or clarifying where code and data live.
---

# SFMC Onboarding

先读本 skill；更深事实查精简版 `AGENTS.md`（回复引用要点即可）。

## 三根路径

| 根 | 内容 | 典型路径 |
|----|------|----------|
| **monorepo** | 平台源码 | `…/ScriptsForMinecraftServer`（路径含 `#` 时命令加引号） |
| **SFMC_ROOT** | 工作目录：`configs/`、`modules/`、运行数据 | 本机常 `D:\WorkPlace\SFMC`；远端常 `/root/SFMC` |
| **作者仓** | 单个业务模块的独立 git 仓 | `mod install --from dir:… --link` → `SFMC_ROOT/modules/packages/` |

| 任务 | 在哪做 |
|------|--------|
| 改平台 | monorepo |
| 跑服 / 装模块 / 改平台 JSON | SFMC_ROOT |
| 写业务模块 | 作者仓 |

`modules/packages/` 是 SFMC_ROOT 上的安装目标；主仓默认不带业务模块源码。

## 上手清单

```text
- [ ] 确认 cwd 是哪一种根
- [ ] Node ≥ 22.13（.node-version）
- [ ] monorepo：npm install && npm run build --workspaces --if-present
- [ ] 设 SFMC_ROOT 后再启服务（缺 configs 时服务写默认值）
- [ ] 启动：db-server → qq-bridge（若用）→ BDS
- [ ] GET http://127.0.0.1:3001/api/health
```

```powershell
npm run build
npm run lint          # 先 build eslint-plugin
npm run typecheck
npm run verify
npm start             # sfmc CLI REPL
```

## 包地图

| 包 | 职责 |
|----|------|
| `modules/sdk/@sfmc-sdk` | `@sfmc-bds/sdk` |
| `packages/db-server` | SQLite HTTP，默认 `:3001` |
| `packages/qq-bridge` | QQ 桥 |
| `packages/bds-tools` | BDS 更新 + 行为包组装 |
| `packages/cli` | 编排与 REPL |
| `packages/create-module` | `npm create @sfmc-bds/module` |
| `packages/devkit` | Watch / rebuild |
| `packages/sfmc-extension` | VS Code/Cursor「SFMC Module」 |
| `packages/tools` | 仓内自检 / docs / release（私有包） |

`bds-tools` / `db-server` / `qq-bridge` / SDK 可独立调用；CLI 只编排。

## 作者面与运维面

| 面 | 工具 | 职责 |
|----|------|------|
| **作者** | 扩展 + `create-module` + `devkit` | 建仓、单测、link、watch、publish |
| **运维** | `sfmc` CLI（在 SFMC_ROOT） | `mod install` / `enable` / `build` / `reload` |

作者流程细节 → `sfmc-module-author`。

## 配置与部署

| 变更 | 生效方式 |
|------|----------|
| `configs/*.json`、manifest 语义 | 重启 BDS |
| 模块 `sapi/src` | `sfmc mod reload`（或扩展 Watch） |
| 模块启停 | `POST /api/sfmc/modules/:id/{enable\|disable}` 写 lock |

## 现行契约（摘要）

- 模块依赖：`@sfmc-bds/sdk` + `@minecraft/*`；跨模块经 manifest + `service` / `tx`
- 消息：`Msg.*`（`@sfmc-bds/sdk/sapi/runtime`）
- 数据/配置/服务客户端：`@sfmc-bds/sdk/sapi/db|config|service`
- 沟通与注释：简体中文，UTF-8

## 文档索引

| 主题 | 路径 |
|------|------|
| 仓速查 | `AGENTS.md` |
| 架构 / 约定 | `docs/zh/dev/architecture.md`、`conventions.md` |
| 模块作者 / 测试 | `docs/zh/dev/module-author.mdx`、`testing.md` |
| 文档站 | `website/AGENTS.md` |
