# 模块控制

平台对已装模块的列表与启停（HTTP）。基于 `modules/catalog.json` + `modules/module-lock.json`。

与 [模块服务目录](./modules/index.md) 不同：本页是**平台管模块**；服务目录是**模块对外业务 RPC**。

日常启停优先 CLI：`sfmc mod enable|disable`（**本地写 lock**，db 在线时再 best-effort 热同步）。HTTP 下列路由由 **db-server** 提供，适合自动化与已起 db 的环境。运维说明见 [使用指南 · 模块](../guide/modules.md)。

## GET /api/sfmc/modules

合并后的模块列表（含 `enabled` 等运行态）。

```bash
curl http://127.0.0.1:3001/api/sfmc/modules
```

## GET /api/sfmc/modules/catalog

catalog 原始镜像。

## GET /api/sfmc/modules/:key

单个模块。`:key` 可为 manifest id 或 catalog 别名（以实现为准）。

## PATCH / PUT /api/sfmc/modules/:key

```json
{ "enabled": true }
```

## POST …/enable · …/disable

```bash
curl -X POST http://127.0.0.1:3001/api/sfmc/modules/feature-afk/enable
curl -X POST http://127.0.0.1:3001/api/sfmc/modules/feature-afk/disable
```

`type: core` 禁用会返回 `module_cannot_disable`。

## 错误

| error | 含义 |
| ------ | ------ |
| `module_not_found` | key 不存在 |
| `module_cannot_disable` | core 模块 |
| `dependency_unmet` | 启用时依赖未满足 |

## 与游戏的关系

改 lock 或模块代码后，需重新装载行为包：

```bash
sfmc> mod reload
```

改 `configs/*.json` 仍需重启 BDS（配置启动缓存）。

```bash
sfmc> mod enable feature-afk
sfmc> mod disable feature-afk
```
