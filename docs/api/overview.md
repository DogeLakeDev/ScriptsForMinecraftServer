# 鉴权与约定

平台 HTTP 的鉴权、错误习惯与路由地图。模块业务请优先用 [SDK](./sdk/index.md)；本页供对照与调试。

## 鉴权

| 路由组 | 鉴权 |
| ------ | ------ |
| `GET /api/health` | 无 |
| `GET /api/sfmc/modules*` | 一般无 |
| `GET /api/sfmc/configs/all`、legacy 配置 GET | 一般无 |
| `POST /api/sfmc/db/*` | **需要**模块身份 |
| `GET /api/sfmc/services*` | **需要**模块身份 |
| `GET/POST /api/sfmc/configs/:configKey/*` | **需要**模块身份 |

模块身份：请求携带 `moduleId`，并对照该模块 manifest 的 `permissions`。实现以 `db-server` 路由为准。

平台级 `http_auth`（`configs/db_config.json` 或环境变量 `HTTP_AUTH`）对部分写操作额外要求 `Authorization: Bearer <token>`。

## 响应习惯

| 情况 | 表现 |
| ------ | ------ |
| 成功 | JSON，`200` |
| 业务错误 | `{ success: false, error: "…" }` + 4xx |
| 模块不存在 | `module_not_found` |
| 依赖未满足 | `dependency_unmet` + `unmet[]` |
| core 不可禁 | `module_cannot_disable` |

## 路由索引

| 组 | 说明 |
| ------ | ------ |
| `GET /api/health` | 健康检查 |
| [模块控制](./module-control.md) | 列表、启停 |
| [配置](./config.md) | 快照、configKey、legacy |
| [数据库](./db.md) | 全部 **POST** |
| [服务 RPC](./services.md) | 多为 **GET** |
| [消息](./messages.md) | 读写聊天记录 |

SDK 入口：[sdk/](./sdk/index.md)。跨模块业务能力：[模块服务目录](./modules/index.md)。
