# 平台核心开发指南

本文介绍 SFMC 平台核心包（SDK、`db-server`、`qq-bridge`、`bds-tools`、CLI 等）的架构设计、本地构建自检与核心子系统。

:::tip 业务模块开发
如果目标是开发服务器玩法模块（如经济、领地等），请直接查阅 [业务模块开发指南](./module-author.mdx)，无需修改主仓源码。
:::

## 1. 包设计原则

SFMC 的平台包遵循单向依赖与高内聚原则：

- **核心能力沉淀于平台包**：数据服务（`db-server`）、QQ 互通（`qq-bridge`）、BDS 版本管理与附加包工具（`bds-tools`）、运行时与类型（`@sfmc-bds/sdk`）均具备独立的生命周期，可在脱离 CLI 的情况下被独立引用。
- **CLI 作为编排与交互层**：`@sfmc-bds/cli` 负责用户交互（REPL）与多进程管理，底层服务包与 SDK 禁止反向依赖 CLI。
- **目录约定**：
  - `packages/*`：平台基础核心包。
  - `modules/packages/*`：运行时业务模块安装目录，与平台源码独立。

## 2. 构建与本地自检

主仓基于 pnpm workspaces 搭建。克隆主仓后，执行全量依赖安装与构建：

```bash
# 全局依赖安装与全量并行构建
pnpm install && pnpm run build

# 运行平台集成自检
pnpm run verify
```

### 单包编译与联调

```bash
# 构建指定子包
pnpm --filter @sfmc-bds/sdk run build
pnpm --filter @sfmc-bds/db-server run build
pnpm --filter @sfmc-bds/cli run build

# 进入 db-server 目录启动热重载开发服务器
cd packages/db-server && pnpm run dev
```

:::important SDK 变更注意事项
若修改了 `@sfmc-bds/sdk` 中的导出或类型定义：
1. 先重新编译 SDK：`pnpm --filter @sfmc-bds/sdk run build`
2. 重新编译依赖它的工作区包（`db-server`、`cli` 等）
3. 运行 `pnpm run verify` 确保类型检查与文档同步一致
:::

## 3. 核心子系统介绍

### `packages/db-server`（数据服务）
- **职责**：基于 Node.js 内置的 `node:sqlite` 驱动，为 SAPI 与伴生服务提供 HTTP REST 接口、分布式事务（`tx-runner`）与 Token 鉴权校验。
- **入口**：`packages/db-server/src/index.ts`，路由分散在 `routes/` 目录下（`db-routes.ts`、`service-routes.ts`、`config.ts`）。
- **验证**：运行该包的 `typecheck`，并通过 `pnpm run verify` 检查相关接口。

### `packages/qq-bridge`（QQ 互通桥接）
- **职责**：支持 QQ 开放平台 WebSocket 网关（官方机器人）与 OneBot 11（LLBot）双后端，实现群聊与游戏消息互通。
- **验证**：运行该包的 `typecheck` 与 `build`，并通过真实环境测试消息链路。

### `packages/bds-tools`（BDS 管理与更新）
- **职责**：
  - **BDS 生命周期管理**（`bds-manager.ts`）：子进程与外部进程探测、控制台输入转发、进程监控与优雅停机。
  - **版本更新与备份**（`check-update.ts`、`rollback.ts`）：Mojang 官方版本检测、增量备份、白名单保护与失败回滚。
  - **配置文件维护**（`server-properties.ts`、`server-properties-i18n.ts`）：解析 `server.properties` 注释并提供中文本地化，保持原有配置键值。
  - **附加包与依赖管理**（`world-packs.ts`、`dependency-negotiator.ts`、`pack-update/`）：行为包与资源包动态组装部署、CurseForge 上游更新检测、`level.dat` 实验性开关配置。
- **验证**：运行目标包的 `typecheck` 与 `build`，涉及 BDS 运行时需在测试世界验收。

### `packages/cli`（命令行与交互控制台）
- **职责**：提供控制台交互、多进程启停管理、命令路由与日志展示。
- **命令通道分类**（`command-surface.ts`）：
  - `both`：既支持交互控制台执行，又可在 Shell 中作为子命令执行（如 `start`、`stop`、`mod`）。
  - `repl`：仅在进入 `sfmc` 控制台后可用。
  - `external`：仅限 Shell 直接执行（如 `debug` 命令）。

### `packages/devkit` 与 `packages/sfmc-extension`
- `@sfmc-bds/devkit`：封装了模块脚手架、文件监听（Watch）与 esbuild 增量构建逻辑。
- `sfmc-extension`：VS Code / Cursor 官方开发扩展，通过 IPC 调用 devkit 提供的能力。

## 4. PR 提交前检查

在向主仓推送代码或提交 PR 前，请依次运行以下检查：

```bash
# 1. 编译全包产物
pnpm run build

# 2. 静态检查与类型检查
pnpm run lint
pnpm run typecheck

# 3. 运行集成自检
pnpm run verify
```

GitHub Actions 会在 Linux 与 Windows 环境下以 Node 22+ 运行上述检查。

## 5. 调试与日志

排查 SAPI 内部问题时，可使用内置的 Debug 开关与 Sentry 异常追踪：

```bash
# 查看当前调试与上报状态
sfmc debug status

# 开启 SAPI 控制台详细调试日志
sfmc debug enable

# 绑定 Sentry DSN 进行异常追踪
sfmc debug sentry on --dsn <https://your-sentry-dsn@sentry.io/...>
```

底层实现依托 `@sfmc-bds/sdk/sapi/runtime` 中的 `debug` 模块。当启用 `sfmc_debug: true` 时，会向控制台输出详细时序日志；绑定 Sentry DSN 后，未捕获的严重异常将自动上报。
