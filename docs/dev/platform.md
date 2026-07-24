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
npm run sdk:build
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

路由表见 [接口指南](../api/README.md)。

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
