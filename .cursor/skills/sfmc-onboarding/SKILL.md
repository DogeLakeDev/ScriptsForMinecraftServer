---
name: sfmc-onboarding
description: >-
  SFMC (ScriptsForMinecraftServer) 10-minute onboarding for new agents or
  contributors. Clarifies the three roots (monorepo vs SFMC_ROOT vs author
  module repo), startup order, package map, and hard don'ts. Use when starting
  work in this repo, asking how to run SFMC, confusing monorepo with runtime
  root, or needing "where do I look first".
---

# SFMC Onboarding

先读本 skill，再按需打开 `AGENTS.md`。**不要**把 AGENTS 全文抄进回复。

## 三根路径（必须先分清）

| 根 | 是什么 | 典型路径 |
|----|--------|----------|
| **monorepo** | 平台源码仓 | `…/ScriptsForMinecraftServer`（Windows 路径常含 `#`，命令里务必加引号） |
| **SFMC_ROOT** | 运行/工作目录：`configs/`、`modules/`、BDS 数据 | 本机常 `D:\WorkPlace\SFMC`；远端常 `/root/SFMC` |
| **作者仓** | 单个业务模块的独立 git 仓 | 任意路径；经 `mod install --from dir:… --link` 挂到 `SFMC_ROOT/modules/packages/` |

- 改平台代码 → 在 **monorepo**。
- 跑服 / 装模块 / 改 `configs/*.json` → 在 **SFMC_ROOT**。
- 写业务模块 → 在 **作者仓**（主仓 `modules/packages/` 默认可空，只是安装目标）。

## 10 分钟清单

```text
Onboarding:
- [ ] 确认当前 cwd 属于哪一种「根」
- [ ] 读 AGENTS.md「仓库结构」+「业务模块不在主仓」
- [ ] Node ≥ 22.13（.node-version）；npm install；npm run build --workspaces --if-present
- [ ] 本地跑服务前设 SFMC_ROOT（缺则服务写默认 configs）
- [ ] 启动顺序：db-server → qq-bridge（若用）→ BDS
- [ ] 健康检查：GET http://127.0.0.1:3001/api/health
```

### 常用命令（monorepo 根）

```powershell
npm install
npm run build
npm run lint          # 先 build eslint-plugin
npm run typecheck
npm run verify        # 平台集成自检（隔离 SFMC_ROOT）
npm start             # sfmc CLI REPL
```

### 服务（独立可启，禁止反向依赖 CLI）

| 包 | 职责 | 默认 |
|----|------|------|
| `packages/db-server` | SQLite HTTP | `:3001` |
| `packages/qq-bridge` | QQ 桥 | 见 `configs/qq_config.json` |
| `packages/bds-tools` | BDS 更新 + 行为包组装 | — |
| `packages/cli` | 编排 / REPL 壳 | — |

## 作者面 vs 运维面

| 面 | 谁做 | 典型动作 |
|----|------|----------|
| **作者** | 扩展「SFMC Module」+ `@sfmc-bds/create-module` + `@sfmc-bds/devkit` | New Module / test / link / watch / publish |
| **运维** | `sfmc` CLI（在 SFMC_ROOT） | `mod install` / `enable` / `build` / `reload` |

已移除：`sfmc mod test` / `mod watch` / `mod publish`。建仓用 `npm create @sfmc-bds/module`。

模块作者工作流细节 → skill `sfmc-module-author`。

## 配置与热更（易踩坑）

- 改 `configs/*.json` → **重启 BDS**（无整包热重载）。
- 改模块 SAPI 源码 → `sfmc mod reload`（build + deploy + 请求 reload）。
- 改 manifest / 平台配置语义 → 通常仍要重启。
- 运行中写 lock 的 REST：仅 `POST /api/sfmc/modules/:id/{enable|disable}`。

## 硬禁止（摘要）

- 服务包 **反向依赖** `@sfmc-bds/cli`
- 模块新代码用 legacy `HttpDB`（改用 `@sfmc-bds/sdk/sapi/db|service|config`）
- `player.sendMessage()`（用 `Msg.*`）
- 跨模块 import 源码 / 读他模块私有表（走 manifest + service/tx）
- 把业务模块默认提交进主仓 `modules/packages/`

## 文档索引（按需深读）

| 需求 | 路径 |
|------|------|
| 仓速查 | `AGENTS.md` |
| 架构 | `docs/zh/dev/architecture.md` |
| 约定 | `docs/zh/dev/conventions.md` |
| 模块作者 | `docs/zh/dev/module-author.mdx` |
| 测试沙箱 | `docs/zh/dev/testing.md` |
| 文档站 | `website/AGENTS.md` |

语言：与用户沟通、代码注释默认 **简体中文**。
