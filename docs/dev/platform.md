# 平台开发

改 SDK、db-server、sfmc 或 CI 时看这篇。

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

### 命令归属与运行入口（OCP 拆分判据）

| 类 | 判据 | 例子 |
|----|------|------|
| **internal**（sfmc 进程内） | 需要 REPL 状态、`runtime.json`、db-server 连接、长连接、或与其它子命令紧耦合 | `devmode` `locale` `init` `status` `logs` `start|stop|restart|send` `remote` `module list|search|info|verify|enable|disable` `packs/addon` `debug` |
| **external**（`tools/*.mjs` 或 `bds-tools/dist/*.js`） | 纯文件 / 网络操作；可在无 sfmc 二进制环境独立运行 | `module install|uninstall|link` → `tools/fetch-module.mjs`；`module create` → `tools/new-module.mjs`；`module build|reload` → `bds-tools/dist/cli-pack-manager.js` 各 verb |

命令可见性 / 派发单一权威：`module` 子命令见 `sfmc/src/module-commands.ts` 的
`BASE_MODULE_SUBCOMMANDS` / `DEV_MODULE_SUBCOMMANDS` 与
`getVisibleModuleSubcommands(devMode)` / `dispatchModuleCommand()`。`repl.ts`
的 `getHelp()` / `getCompletions()` / `main.ts` 的未知回退 全部走同一份 selector
（DRY）。开发者子命令在 `devmode on` 时可见且帮助中蓝色提示；关闭时被
dispatch 拦截并提示 `devmode on`。

模板清单（如 `module create`）的单一权威是 `tools/new-module.mjs --list-templates`
（spawn 取），sfmc 的 wizard 不应再硬编码一份。

### `sfmc debug` —— BDS 调试配置入口

读写 `<BDS>/config/default/variables.json` 与 `secrets.json`（由
`bds_updater.json#bds_path` 定位 BDS 根）：

```bash
sfmc debug status              # 查看 sfmc_debug / SENTRY_DSN 状态
sfmc debug enable|disable      # 写 sfmc_debug=true|false
sfmc debug sentry on --dsn <dsn>  # 写 SENTRY_DSN
sfmc debug sentry off          # 删除 SENTRY_DSN
```

仅改配置，不触碰 SDK `applyDebugFromVariables` / `initSentryIfConfigured` 语义
（OCP）。改完需 `sfmc mod reload` 或重启 BDS 才在行为包运行时生效。

### `sfmc devmode` —— 持久化开发模式

写 `configs/runtime.json#developer_mode`：

```bash
sfmc devmode on|off|status
```

作为 `module` 开发者子命令可见性门控的唯一权威。`isDeveloperMode()`
是 REPL/帮助/补全/分发共用入口，禁止直读 `runtime.json`。

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

行为摘要：

- `debug.d/i/w` → 控制台仅在 `sfmc_debug` 时输出；（Sentry 开启时）breadcrumb
- `debug.e` → **始终** `console.warn`；（Sentry 开启时）`captureException`（args 中的 `Error` 优先）
- ModuleRegistry / ConfigManager 失败已走 `debug.e`
- 改完后需 `sfmc behavior-pack build && deploy` 并重启 BDS
- API：`@sfmc-bds/sdk/sapi/diagnostics` 的 `initSentryIfConfigured` / `reportError`（启动链已自动调用 init）
