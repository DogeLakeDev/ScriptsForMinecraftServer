# 配置

首次启动时，各服务会用内置默认值生成缺失的配置文件，并写入 `$schema`，可在 IDE 中悬停查看字段说明。

## 平台配置

| 文件                      | 用途             |
| ------------------------- | ---------------- |
| `db_config.json`          | db-server        |
| `qq_config.json`          | -                |
| `bds_updater.json`        | BDS 更新与备份   |
| `pack-update.json`        | -                |
| `log-filter.json`         | 日志过滤         |
| `permissions.json`        | 权限             |
| `packs/pack-sources.json` | 附加包更新源绑定 |

## 模块配置

以对应模块声明为准。

## 模块状态文件

| 文件                       | 说明     |
| -------------------------- | -------- |
| `modules/catalog.json`     | 模块清单 |
| `modules/module-lock.json` | 模块状态 |

