# 平台核心开发指南

本文档面向希望参与 SFMC 平台核心组件（SDK、`db-server`、`qq-bridge`、`bds-tools`、CLI 或 CI 流水线）建设的架构师与贡献者。

:::tip 业务模块开发者请绕行
如果您旨在开发具体的 Minecraft 玩法功能（如领地、经济、菜单等），请直接查阅 [业务模块开发全流程手册](./module-author.mdx)，业务模块无需改动平台主仓源码。
:::

---

## 1. 核心设计原则：包的高内聚与独立性

SFMC 的底层包遵循严格的微内核与单向依赖原则：

- **能力沉淀于平台包**：持久化数据库（`db-server`）、QQ 互通（`qq-bridge`）、BDS 版本管理与附加包更新（`bds-tools`）、通用类型与运行时（`@sfmc-bds/sdk`）均具备完全独立的生命周期，必须能够在脱离 CLI 的情况下被独立引用与执行。
- **CLI 仅作交互与编排壳**：`@sfmc-bds/cli` 的定位是用户界面（REPL）与任务 Supervisor。**严禁任何服务包或 SDK 反向依赖 CLI**。
- **目录约定**：
  - `packages/*`：平台级基础核心包。
  - `modules/packages/*`：业务模块运行镜像目录（平台核心代码与业务功能物理隔离）。

---

## 2. 平台全套构建与冒烟自检

主仓基于 `pnpm` workspaces 搭建。克隆主仓后，执行全量依赖安装、编译与自检：

```bash
# 全局依赖安装与全量并行构建
pnpm install && pnpm run build

# 运行平台全套冒烟与格式一致性检验
pnpm run verify
```

### 单包针对性编译与热联调

```bash
# 仅构建指定子包
pnpm --filter @sfmc-bds/sdk run build
pnpm --filter @sfmc-bds/db-server run build
pnpm --filter @sfmc-bds/cli run build

# 进入 db-server 目录启动热重载开发服务器
cd packages/db-server && pnpm run dev
```

:::important SDK 级联变更纪律
若修改了 `@sfmc-bds/sdk` 中的导出或类型契约：
1. 先重新编译 SDK：`pnpm --filter @sfmc-bds/sdk run build`
2. 级联编译依赖它的各个工作区包（`db-server`、`cli` 等）
3. 重新运行 `pnpm run verify` 确保类型定义与 TypeDoc 生成一致
:::

---

## 3. 核心子系统剖析

### ① `packages/db-server`（持久化中枢）
- **职责**：基于 Node.js 22 内置的 `node:sqlite` 原生驱动，为原生 SAPI 与外部服务提供 HTTP REST 接口、分布式事务（`tx-runner`）与鉴权校验。
- **入口**：`packages/db-server/src/index.ts`，路由分散在 `routes/` 目录下（`db-routes.ts`、`service-routes.ts`、`config.ts`）。
- **单元测试**：`pnpm --filter @sfmc-bds/db-server test`。

### ② `packages/qq-bridge`（多端通信桥）
- **职责**：支持腾讯 QQ 开放平台 WebSocket Gateway（官方机器人）与 OneBot 11（LLBot）双后端，实现消息的双向转换与事件推群。
- **单元测试**：`pnpm --filter @sfmc-bds/qq-bridge test`。

### ③ `packages/cli`（编排主控与 REPL）
- **职责**：实现开服交互控制台、多服务进程生命周期监控、命令分发与日志多路复用。
- **命令通道分类**（`command-surface.ts`）：
  - `both`：既支持交互式 REPL，又可在宿主 Shell 直接作为子命令执行（如 `start`、`stop`、`mod`）。
  - `repl`：仅在进入 `sfmc` 交互界面后可用。
  - `external`：仅限宿主 Shell 执行（如 `debug` 底层诊断命令）。

### ④ `packages/devkit` 与 `packages/sfmc-extension`
- `@sfmc-bds/devkit`：底层封装了模块脚手架、文件监听（Watch）与 esbuild 增量构建部署逻辑。
- `sfmc-extension`：VS Code / Cursor 官方开发扩展，通过 IPC 调用 devkit 暴露的原子能力。

---

## 4. 提交 Pull Request 前的质量检查清单

在向主仓推送分支或发起 PR 前，请确保依次通过以下检查：

```bash
# 1. 编译全包制品
pnpm run build

# 2. 静态语法与代码规范扫描
pnpm run lint
pnpm run typecheck

# 3. 运行全仓自动化验证套件
pnpm run verify
```

GitHub Actions（`ootb.yml`）会在 Ubuntu 与 Windows 双平台上以 Node 22+ 运行上述自动化验证。

---

## 5. SAPI 底层调试与 Sentry 异常上报

在排查 SAPI 内部疑难异常时，可启用平台内置的 Debug 开关与 Sentry 遥测：

```bash
# 查看当前调试与上报开关状态
sfmc debug status

# 开启 SAPI 控制台底层详细调试日志
sfmc debug enable

# 绑定 Sentry DSN 实现生产环境异常捕获
sfmc debug sentry on --dsn <https://your-sentry-dsn@sentry.io/...>
```

底层实现依托 `@sfmc-bds/sdk/sapi/runtime` 中的 `debug` 模块。当检测到 `sfmc_debug: true` 时，会向控制台输出微秒级时序跟踪；当绑定了 Sentry DSN 时，未捕获的严重异常将自动上报云端便于追踪定位。
