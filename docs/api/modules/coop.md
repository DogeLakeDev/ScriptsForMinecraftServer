# coop 服务（manifest.id: feature-coop）

安装 id：`coop` · npm：`@sfmc-bds/module-coop`

依赖：`feature-economy`（钱包展示 / 缓存刷新）。

## Service 名

| 名称 | 说明 |
|------|------|
| `coop.byId` | 按合作社 id 查询 |
| `coop.list` | 列表 |
| `coop.byPlayer` | 玩家所属合作社 |

自有表前缀 `sfmc_coop_*`；域类型见包内 `sapi/src/coop-api.ts`。玩家钱包勿直读经济表，用 `@sfmc-bds/module-economy/client` 或 `Money`。
