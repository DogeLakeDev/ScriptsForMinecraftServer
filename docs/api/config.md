# 配置

平台与模块配置的 HTTP 面。模块侧请用 `@sfmc-bds/sdk/sapi/config`，见 [SDK · config](./sdk/config.md)。运维文件说明见 [使用指南 · 配置](../guide/config.md)。

## 启动快照

### GET /api/sfmc/configs/all

SAPI `ConfigManager.init()` 调用。返回平台域：`modules`、`module_tokens`、`settings`、`permissions`。进程内不刷新。

模块私有配置不在此接口。

## 模块级配置（v2）

`:configKey` 来自 manifest（如 `afk`、`land`）。

| 方法 | 路径 | 说明 |
| ------ | ------ | ------ |
| GET | `/api/sfmc/configs/:configKey` | 读整份 `{ config: … }` |
| POST | `/api/sfmc/configs/:configKey/set` | 写单个 key |
| GET | `/api/sfmc/configs/:configKey/notify` | SSE，配置变更推送 |

需要模块身份。SDK：`config.get` / `set` / `onChange`（`onChange` 为进程内，非 SSE）。


## 文件位置

运行时：`configs/<name>.json`。缺文件时由服务用内置默认值 ensure（含 `$schema`）。Schema：`@sfmc-bds/sdk/schemas/`。
