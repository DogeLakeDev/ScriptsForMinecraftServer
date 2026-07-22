# 配置 API

## 启动快照（SAPI 用）

### GET /api/sfmc/configs/all

SAPI `ConfigManager.init()` 调用，一次返回平台需要的全部 JSON 配置。运行中不刷新。

## 模块级配置（v2）

路径中的 `:configKey` 来自 manifest，如 `afk`、`land`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sfmc/configs/:configKey` | 读整份 `{ config: … }` |
| POST | `/api/sfmc/configs/:configKey/set` | 写单个 key |
| GET | `/api/sfmc/configs/:configKey/notify` | SSE，配置变更推送 |

需要模块身份鉴权。

SDK 封装：`@sfmc-bds/sdk/sapi/config` 的 `config.get` / `config.set` / `config.onChange`（onChange 为进程内，非 SSE）。

## Legacy 平台 JSON（只读 GET）

| 路径 | 文件 |
|------|------|
| `/api/sfmc/settings` | settings 扁平视图 |
| `/api/sfmc/settings/:key` | 单 key；`bridge_channel_id` 可回退 qq_config；`land:*` 可回退 land.json |
| `/api/sfmc/areas` | areas.json |
| `/api/sfmc/permissions` | permissions.json |
| `/api/sfmc/banned_items` | banned_items.json |
| `/api/sfmc/clean` | clean.json |
| `/api/sfmc/grids` | grids.json |
| `/api/sfmc/peace_filters` | peace_filters.json |
| `/api/sfmc/qa` | questions.json |

新模块优先用 `:configKey` 体系，legacy 路由留给旧包。

## 文件位置

运行时：`configs/<name>.json`  
默认模板：`configs-default/` 或 `modules/packages/<id>/configs-default/`

运维说明见 [使用指南 → 配置](../guide/config.md)。
