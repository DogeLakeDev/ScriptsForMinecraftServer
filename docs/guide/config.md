# 配置说明

首次启动时，**各服务用代码内默认值 ensure 生成**缺失配置文件，并写入 `$schema` ，使用 IDE 时便可查看**详细的悬停说明**。

> IDE：工作区 [`.vscode/settings.json`](../../.vscode/settings.json) 已按文件名绑定 schema；也可用文件内 `$schema` 指向 `@sfmc-bds/sdk/schemas/*.schema.json`。

## 平台配置

| 文件 | 源 | 备注 |
| ------ | ------ | ------ |
| `db_config.json` | db-server | - |
| `qq_config.json` | qq-bridge、db-server | - |
| `bds_updater.json` | bds-tools | - |
| `pack-update.json` | sfmc packs/addon | CurseForge 世界包更新（详见 [pack-update 技术路线](./pack-update.md)） |
| `log-filter.json` | sfmc 日志层 | - |
| `permissions.json` | db-server | - |
| `remote.json` | sfmc remote-agent | - |
| `packs/pack-sources.json` | pack-manager | |

## 模块配置

每个模块有自己的 `configKey`（于manifest 里声明），对应 `configs/<configKey>.json`。  

> 模块缺省值由模块代码 / 首次写入提供。
>
> SAPI 启动时通过 `GET /api/sfmc/configs/all` **一次性**拉全并**缓存**，运行中不会自动刷新。

## 模块状态

| 文件 | 说明 |
| ------ | ------ |
| `modules/catalog.json` | 已装模块清单（本地 mirror） |
| `modules/module-lock.json` | 各模块 enabled 状态 |
