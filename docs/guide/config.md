# 配置说明

配置全是 JSON 文件，放在 `configs/`。改完需要**重启对应进程**；SAPI 侧改完还要**重启 BDS**。

## 平台配置

| 文件 | 谁读 | 说明 |
|------|------|------|
| `db_config.json` | db-server | 端口、`dbDir`、`modulesDir`、`http_auth` |
| `qq_config.json` | qq-bridge、db-server | QQ / LLBot |
| `bds_updater.json` | bds-tools | BDS 路径、备份、更新频道 |
| `permissions.json` | db-server | 玩家权限种子 |

## 模块配置

每个模块有自己的 `configKey`（manifest 里声明），对应 `configs/<configKey>.json`。  
默认值在 `modules/packages/<id>/configs-default/`。

SAPI 启动时通过 `GET /api/sfmc/configs/all` **一次性**拉全并缓存，运行中不会自动刷新。

## 模块状态

| 文件 | 说明 |
|------|------|
| `modules/catalog.json` | 已装模块清单（本地 mirror） |
| `modules/module-lock.json` | 各模块 enabled 状态 |

## settings 与 legacy 路由

部分老模块仍走平台级 JSON，例如 `areas.json`、`land.json` 等，由 db-server 的 `/api/sfmc/areas` 等路由读出。新模块优先用 `configs/:configKey` 体系。

## 生效方式小结

| 改了什么 | 要重启什么 |
|----------|------------|
| `db_config.json` | db-server |
| `qq_config.json` | qq-bridge、相关读方 |
| 模块 JSON / lock | BDS（+ 可能需要 rebuild BP） |

详细 HTTP 接口见 [接口指南 → 配置](../api/config.md)。
