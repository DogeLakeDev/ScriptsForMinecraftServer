# 接口指南

db-server 的 HTTP API、`@sfmc-bds/sdk` 模块侧接口，以及 **各业务模块对外服务**。

## 阅读顺序

| 章节 | 内容 |
|------|------|
| [总览](./overview.md) | Base URL、鉴权、响应习惯 |
| [模块 API](./modules.md) | 列表、启停（HTTP） |
| [模块服务目录](./modules/README.md) | economy / land / area / … 对外 service 与 client |
| [配置 API](./config.md) | 平台配置 + 模块 configKey |
| [数据库 API](./db.md) | define-table、CRUD、tx |
| [服务 API](./services.md) | 跨模块 RPC 的 HTTP 机制 |
| [消息 API](./messages.md) | 聊天、QQ 桥 |
| [SDK 接口](./sdk/README.md) | runtime / db / config / service |

## Base URL

默认 `http://127.0.0.1:3001`，仅 loopback。端口见 `configs/db_config.json` 的 `db_port`。

## 两类配置接口

| 类型 | 路径 | 用途 |
|------|------|------|
| 启动快照 | `GET /api/sfmc/configs/all` | SAPI 一次性拉全 |
| 模块配置 | `GET/POST /api/sfmc/configs/:configKey/…` | 按 manifest configKey |
| Legacy 平台 JSON | `GET /api/sfmc/areas` 等 | 老模块只读 |

## SDK 与 HTTP 的关系

模块作者优先用 SDK 与 **模块 typed client**；SDK 内部发 HTTP 到 db-server。写 Node 服务或调试时可直调 HTTP。

## 健康检查

```bash
curl http://127.0.0.1:3001/api/health
```
