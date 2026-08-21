# 配置

首次启动时，各服务会用内置默认值生成缺失的配置文件，并写入 `$schema`，便于在 IDE 中悬停查看字段说明。

工作区 [`.vscode/settings.json`](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.vscode/settings.json) 已按文件名绑定 schema；也可依赖文件内 `$schema` 指向 `@sfmc-bds/sdk/schemas/*.schema.json`。

## 平台配置

| 文件 | 用途 |
| ------ | ------ |
| `db_config.json` | db-server 端口、数据路径、模块目录等 |
| `qq_config.json` | QQ 桥（官方 Bot / LLBot） |
| `bds_updater.json` | BDS 更新与备份 |
| `pack-update.json` | 附加包 CurseForge 更新（用法见 [附加包](./addons.md)） |
| `log-filter.json` | 日志过滤 |
| `permissions.json` | 权限表 |
| `packs/pack-sources.json` | 附加包更新源绑定 |

## 模块配置

每个模块在 `sapi/manifest.json` 中声明 `configKey`，对应 `configs/<configKey>.json`。缺省值由模块在首次写入时提供。读写经 `@sfmc-bds/sdk/sapi/config`（HTTP：`/api/sfmc/configs/:configKey`），与平台 `ConfigName` 解耦。

SAPI 启动时通过 `GET /api/sfmc/configs/all` **一次性**拉取并缓存平台域：`modules`、`settings`、`permissions`（及 `module_tokens`）。模块私有 JSON **不**进该缓存，按需经 `config.get` / `config.set` 访问；运行中 `set` 可即时写回。

:::warning 注意
修改平台 `configs/*.json`（或模块配置文件且未走 `config.set`）后请重启 BDS。模块启停写入 `module-lock.json` 后，一般还需 `mod reload` 或重启 BDS 才会进入行为包。

:::

## 模块状态文件

| 文件 | 说明 |
| ------ | ------ |
| `modules/catalog.json` | 已装模块清单（本地镜像） |
| `modules/module-lock.json` | 各模块 enabled 状态 |
