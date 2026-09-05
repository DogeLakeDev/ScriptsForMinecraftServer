---
name: sfmc-onboarding
description: >-
  SFMC 平台上手与环境架构指引：三根路径（monorepo、SFMC_ROOT 工作目录、作者仓）、
  包结构拓扑、作者面与运维面分工、热重载配置模型与标准启动清单。
  适用于初次接入、运行服务栈或确认代码与数据归属边界时。
---

# SFMC 平台上手指引（Onboarding）

核心架构速查优先查阅 `AGENTS.md`；本技能聚焦初次介入、工作流切换与环境准备。

## 三根路径

| 路径标识      | 承载内容                                               | 典型路径示例                                                              |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| **monorepo**  | 平台底层源码与核心 SDK                                 | `…/ScriptsForMinecraftServer`（路径包含 `#` 时命令加引号）                |
| **SFMC_ROOT** | 运行时工作目录：`configs/`、`modules/`、运行日志与数据 | 本地开发如 `D:\WorkPlace\SFMC`；生产部署如 `/root/SFMC`                   |
| **作者仓**    | 单个业务模块的独立代码仓                               | 经 `mod install --from dir:… --link` 挂载至 `SFMC_ROOT/modules/packages/` |

### 任务与环境映射

| 任务类型                                            | 执行位置              |
| --------------------------------------------------- | --------------------- |
| 修改平台基础能力 / SDK 核心                         | monorepo              |
| 启动服务 / 运行服务器 / 安装业务模块 / 调整平台配置 | SFMC_ROOT（工作目录） |
| 开发与调试具体业务功能模块                          | 作者仓                |

`modules/packages/<id>/` 为工作目录（SFMC_ROOT）下的模块安装与软链接挂载目标；平台源码仓专注于核心底座与 SDK 维护。

## 上手清单

```text
- [ ] 1. 确认当前终端工作目录所属根（monorepo vs SFMC_ROOT vs 作者仓）
- [ ] 2. 检查 Node.js 环境（要求 Node ≥ 22.13，参考 .node-version）
- [ ] 3. monorepo 编译准备：pnpm install && pnpm run build
- [ ] 4. 设置环境变量 SFMC_ROOT 指向工作目录（服务首次启动将自动补全默认 configs）
- [ ] 5. 按序启动底层依赖与服务：db-server → qq-bridge（若使用）→ BDS
- [ ] 6. 健康检查：访问 GET http://127.0.0.1:3001/api/health
```

### monorepo 常用命令

```powershell
pnpm run build          # 构建所有 workspace 包（或 npm run build --workspaces --if-present）
pnpm run lint           # 代码规范检查（先编译 eslint-plugin）
pnpm run typecheck      # 全局 TypeScript 类型检查
pnpm run verify         # 自动化完整性校验
pnpm start              # 启动 sfmc CLI REPL
```

## 平台包地图

| 包路径                            | 职责与包名                 | 说明                                            |
| --------------------------------- | -------------------------- | ----------------------------------------------- |
| `modules/sdk/@sfmc-sdk`           | `@sfmc-bds/sdk`            | 提供 SAPI 运行时与 Node.js 核心能力接口         |
| `modules/sdk/@sfmc-eslint-plugin` | `@sfmc-bds/eslint-plugin`  | 模块与平台定制 ESLint 规则集                    |
| `packages/db-server`              | `@sfmc-bds/db-server`      | SQLite HTTP 数据服务，默认监听 `:3001`          |
| `packages/qq-bridge`              | `@sfmc-bds/qq-bridge`      | 消息网桥服务（支持 official 与 llbot 协议）     |
| `packages/bds-tools`              | `@sfmc-bds/bds-tools`      | BDS 管理、更新与行为包自动化组装                |
| `packages/cli`                    | `@sfmc-bds/cli`            | 统一运维编排工具与交互式 REPL                   |
| `packages/create-module`          | `@sfmc-bds/create-module`  | 模块脚手架引擎（`npm create @sfmc-bds/module`） |
| `packages/devkit`                 | `@sfmc-bds/devkit`         | 模块开发 Watch 监听与动态重构工具集             |
| `packages/sfmc-extension`         | `@sfmc-bds/sfmc-extension` | IDE 扩展「SFMC Module」源码                     |
| `packages/tools`                  | `@sfmc-bds/tools`          | 仓内自动化自检、文档构建与发布私有工具集        |

`bds-tools`、`db-server`、`qq-bridge` 及 SDK 均具备独立能力；`cli` 仅负责流程编排。

## 作者面与运维面分工

| 关注面     | 核心工具                              | 核心职责                                                                |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------- |
| **作者面** | IDE 扩展 + `create-module` + `devkit` | 脚手架初始化、单测验证、本地 link 挂载、实时 watch 构建、打包发布       |
| **运维面** | `sfmc` CLI（在 SFMC_ROOT 执行）       | 模块生命周期（`mod install` / `enable` / `build` / `reload`）与服务控制 |

业务模块完整开发流程参见：`sfmc-module-author`。

## 配置模型与生效边界

| 变更范围                              | 生效机制                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `configs/*.json`、manifest 元数据契约 | 重启 BDS 进程后加载生效                                                   |
| 业务模块 `sapi/src` 源码变更          | 执行 `sfmc mod reload`（或借助扩展 Watch 自动同步）                       |
| 模块启停状态                          | 调用 `POST /api/sfmc/modules/:id/{enable\|disable}` 写入 module-lock.json |

## 现行核心契约摘要

- **依赖范围**：业务模块仅依赖 `@sfmc-bds/sdk` 与 `@minecraft/*`；跨模块协作经由 manifest 声明服务与 `service` / `tx` 调用。
- **消息发送**：统一调用 `@sfmc-bds/sdk/sapi/runtime` 中的 `Msg.*`。
- **服务调用**：通过 `@sfmc-bds/sdk/sapi/db|config|service` 提供的标准化客户端访问底层能力。
- **字符编码**：所有源码、注释与文档严格采用 UTF-8 编码，默认使用简体中文。

## 关联文档索引

| 主题               | 路径                                            |
| ------------------ | ----------------------------------------------- |
| 平台速查知识库     | `AGENTS.md`                                     |
| 架构设计与编码约定 | `docs/zh/dev/architecture.md`、`conventions.md` |
| 模块开发与测试规范 | `docs/zh/dev/module-author.mdx`、`testing.md`   |
| 文档站维护规范     | `website/AGENTS.md`                             |
