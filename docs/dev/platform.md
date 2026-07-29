# 平台开发

改 SDK、db-server、sfmc 或 CI 时看这篇。

**包独立性：** 业务能力（pack-update、进程探活、world-packs、BDS 更新等）落在 `@sfmc-bds/bds-tools` / `db-server` / `qq-bridge` / `@sfmc-bds/sdk` 等包内，须能不经 CLI/REPL 独立调用；`@sfmc-bds/cli` 只做编排与交互壳，禁止服务包反向依赖 cli。

## 开发环境

```bash
npm install
npm run build --workspaces --if-present
npm run check-ootb
```

单 workspace：

```bash
npm run build --workspace @sfmc-bds/sdk
npm run build --workspace @sfmc-bds/db-server
npm run build --workspace @sfmc-bds/cli
cd db-server && npm run dev    # tsx 热跑
```

## 改 SDK 后

```bash
npm run build --workspace @sfmc-bds/sdk
# 再 build 依赖它的 workspace + 重打 BP
```

## db-server

入口 `db-server/src/index.ts`，路由分散在 `routes/`。

```bash
cd db-server
npm run test    # node --test
```

常用扩展点：

- 新平台级 JSON 配置 → `routes/config.ts`
- 模块 API → `routes/modules.ts`
- DB 能力 → `routes/db-routes.ts`、`tx-runner.ts`
- 跨模块服务 → `routes/service-routes.ts`、`service-registry.ts`

路由表见 [接口指南](../api/index.md)。

## sfmc CLI

源码 `sfmc/src/`。改完：

```bash
npm run build --workspace @sfmc-bds/cli
```

工作根：monorepo 内为仓根；npm 聚合包安装后为 **cwd**（可用 `SFMC_ROOT` 覆盖）。首次初始化看 `configs/runtime.json#initialized_at`，不是 `db_config.json` 是否存在。

## 工具链

新脚本优先放 `tools/*.mjs`，共享逻辑用 `tools/lib/`。不要复制 catalog/lock 读写。

详见 [工具脚本](./tools.md)。

## CI

`.github/workflows/ootb.yml`：

1. `npm install`
2. `node tools/check-ootb.mjs`
3. 起 db-server → `smoke-modules.mjs`

Node 必须 ≥ 22.13。

## PR 前自查

1. `npm run build --workspaces --if-present`
2. `npm run check-ootb` 或至少 `check-modules` + 相关 smoke
3. SDK export 变更 → `sdk:typecheck`
4. 文档与代码一起改

业务模块 PR 优先提 sfmc-modules；本仓只留联调用的 packages 快照。

## SAPI debug 与 Sentry（BDS）

统一日志门面：`import { debug, setDebugEnabled } from "@sfmc-bds/sdk/sapi/runtime"`。

| 开关 | 位置 | 作用 |
|------|------|------|
| 控制台 debug | `<BDS>/config/default/variables.json` → `"sfmc_debug": true` | 打开 `console` 输出（默认关） |
| Sentry | `<BDS>/config/default/secrets.json` → `"SENTRY_DSN": "https://...@....ingest.sentry.io/..."` | `init` 并挂到 `debug` sink（默认关） |

也可写在 `<BDS>/config/<sfmc-modules-uuid>/` 下对应文件。两者可单独启用。

CLI 命令按通道分层（`sfmc/src/command-surface.ts`）：`external` 仅 `sfmc <cmd>`、`repl` 仅交互 REPL、`both` 两边可用。例如 `module install|create|dev`、`debug`、多数 `packs` 部署子命令为仅外部；`send` / `logs -f` 为仅 REPL。外部 `--help` 只列 external|both。

CLI 管理 debug（直接写 BDS 配置，改完后需 `sfmc mod reload` 或重启 BDS；**仅外部**，不进 REPL）：

| 命令 | 作用 |
|------|------|
| `sfmc debug status` | 查看 `sfmc_debug` / `SENTRY_DSN` |
| `sfmc debug enable\|disable` | 开关 `sfmc_debug`（默认 enable 打开控制台 debug 日志） |
| `sfmc debug sentry on --dsn <url>` | 写入 `SENTRY_DSN` |
| `sfmc debug sentry off` | 删除 `SENTRY_DSN` |

开发类命令（`module build|reload`、`module watch|test|publish`、`debug`）在对应通道的 `help` 中以蓝色标出；无独立 `devmode` 开关。`module create` / `module link` / `module dev` 已被移除。

行为摘要：

- `debug.d/i/w` → 控制台仅在 `sfmc_debug` 时输出；（Sentry 开启时）breadcrumb
- `debug.e` → **始终** `console.warn`；（Sentry 开启时）`captureException`（args 中的 `Error` 优先）
- ModuleRegistry / ConfigManager 失败已走 `debug.e`
- 改完后需 `sfmc behavior-pack build && deploy` 并重启 BDS
- API：`@sfmc-bds/sdk/sapi/diagnostics` 的 `initSentryIfConfigured` / `reportError`（启动链已自动调用 init）
