# 平台开发

改 SDK、db-server、sfmc CLI 或 CI 时看这篇。业务模块请走 [模块开发](./module-author.md)。

**包独立性：** pack-update、探活、附加包装载、BDS 更新等能力落在 `@sfmc-bds/bds-tools` / `db-server` / `qq-bridge` / `@sfmc-bds/sdk` 等包内，须能不经 CLI 独立调用。`@sfmc-bds/cli` 只做编排与交互壳，禁止服务包反向依赖 cli。

**目录约定：** `packages/*` = 平台包；`modules/packages/*` = 业务模块（不变）。

## 环境

```bash
npm install
npm run build --workspaces --if-present
npm run verify
```

```bash
npm run build -w @sfmc-bds/sdk
npm run build -w @sfmc-bds/db-server
npm run build -w @sfmc-bds/cli
cd packages/db-server && npm run dev
```

改 SDK 后：先 build SDK，再 build 依赖它的 workspace，并重打模块行为包（`mod reload` 或装载闸门）。

## db-server

入口 `packages/db-server/src/index.ts`，路由在 `routes/`。

```bash
cd packages/db-server
npm run test
```

| 扩展点 | 位置 |
| ------ | ------ |
| 平台 JSON 配置 | `routes/config.ts` |
| 模块 API | `routes/modules.ts` |
| DB | `routes/db-routes.ts`、`tx-runner.ts` |
| 跨模块 service | `routes/service-routes.ts`、`service-registry.ts` |

路由说明见 [接口指南](../api/index.md)。

## sfmc CLI

源码 `packages/cli/src/`（npm `@sfmc-bds/cli`）。改完：`npm run build -w @sfmc-bds/cli`。根入口：`npm start` → `packages/cli/dist/main.js`。

工作根：monorepo 内为仓根；npm 聚合包安装后为 **cwd**（`SFMC_ROOT` 可覆盖）。首次初始化看 `configs/runtime.json#initialized_at`。

命令按通道：`both` / `repl` / `external`（见 `command-surface.ts`）。运维向 `mod build|reload|install|enable` 等仍在 CLI；**作者向** `mod test|watch|publish` 已迁出——改用扩展「SFMC Module」与 `@sfmc-bds/devkit`（调用旧子命令会提示迁移）。`debug` 仍仅外部 argv。

## 作者工具包与扩展

| 路径 | 职责 |
| ------ | ------ |
| `packages/devkit/`（`@sfmc-bds/devkit`） | scaffold、watch、rebuildAndDeploy；供扩展 import |
| `packages/sfmc-extension/` | VS Code/Cursor「SFMC Module」 |

作者流程见 [模块开发](./module-author.md)、[测试沙箱](./testing.md)。

## 工具与 CI

新脚本放 `packages/tools/*.mjs`（仓内私有），模块 install 逻辑在 `packages/cli/scripts/module-install/`。见 [工具脚本](./tools.md)。

`ootb.yml`：`npm ci` → build → `npm run verify`。Node ≥ 22.13。

## PR 前

1. `npm run build --workspaces --if-present`
2. `npm run verify`
3. SDK 导出变更 → 相关 typecheck / TypeDoc
4. 文档与代码同步改

## SAPI debug 与 Sentry

```ts
import { debug } from "@sfmc-bds/sdk/sapi/runtime";
```

| 开关 | 位置 | 作用 |
| ------ | ------ | ------ |
| 控制台 debug | BDS `config/.../variables.json` → `sfmc_debug: true` | 打开 console 输出 |
| Sentry | `secrets.json` → `SENTRY_DSN` | 挂到 debug sink |

CLI（仅外部 argv，不进 REPL）：

| 命令 | 作用 |
| ------ | ------ |
| `sfmc debug status` | 查看开关 |
| `sfmc debug enable \| disable` | 开关 `sfmc_debug` |
| `sfmc debug sentry on --dsn <url>` | 写入 DSN |
| `sfmc debug sentry off` | 删除 DSN |

改 BDS 配置后需 `mod reload` 或重启 BDS。`debug.e` 始终 `console.warn`；Sentry 开启时 `captureException`。
