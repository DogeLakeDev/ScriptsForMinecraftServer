# 接口总览

## 鉴权

| 路由组 | 鉴权 |
|--------|------|
| `GET /api/health` | 无 |
| `GET /api/sfmc/modules*` | 一般无 |
| `GET /api/sfmc/configs/all`、legacy 配置 GET | 一般无 |
| `POST /api/sfmc/db/*` | **需要**模块身份 |
| `GET /api/sfmc/services*` | **需要**模块身份 |
| `GET/POST /api/sfmc/configs/:configKey/*` | **需要**模块身份 |

模块身份通过请求携带 `moduleId` 与 manifest 声明的 `permissions` 校验；具体以 `db-server/src/index.ts` 为准。

平台级 `http_auth`（`configs/db_config.json` 或环境变量 `HTTP_AUTH`）对部分写操作额外要求 `Authorization: Bearer <token>`。

## 响应习惯

- 成功：JSON，`200`
- 业务错误：`{ success: false, error: "..." }` + 4xx
- 模块未找到：`module_not_found`
- 依赖未满足：`dependency_unmet` + `unmet[]`
- core 模块不可禁：`module_cannot_disable`

## 路由索引

### 健康

| 方法 | 路径 |
|------|------|
| GET | `/api/health` |

### 模块

见 [modules.md](./modules.md)

### 配置

见 [config.md](./config.md)

### 数据库

见 [db.md](./db.md) — 全部 **POST**

### 服务

见 [services.md](./services.md) — **GET**

### 消息

见 [messages.md](./messages.md)

## SDK 入口

模块业务代码见 [sdk/](./sdk/README.md)，不必手写上述 HTTP。
