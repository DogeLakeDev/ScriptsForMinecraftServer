# 模块 API

基于 `modules/catalog.json` + `modules/module-lock.json`。

## GET /api/sfmc/modules

返回合并后的模块列表（含 `enabled` 等运行态字段）。

```bash
curl http://127.0.0.1:3001/api/sfmc/modules
```

## GET /api/sfmc/modules/catalog

返回 catalog 原始条目（mirror）。

## GET /api/sfmc/modules/:key

单个模块。`:key` 可以是 manifest id 或 catalog 里的别名，以实现为准。

## PATCH / PUT /api/sfmc/modules/:key

Body：

```json
{ "enabled": true }
```

## POST /api/sfmc/modules/:key/enable

启用模块。

## POST /api/sfmc/modules/:key/disable

禁用模块。`type: core` 的模块会返回 `module_cannot_disable`。

## 错误

| error | 含义 |
|-------|------|
| `module_not_found` | key 不存在 |
| `module_cannot_disable` | core 模块 |
| `dependency_unmet` | 启用时依赖未满足 |

## 与游戏的关系

改 lock / 模块代码后需 **build + deploy**，再让 BDS 加载新脚本：

- 推荐：`sfmc reload`（自动向 BDS 发 `reload`）
- 或：`pack deploy` 后在 BDS/游戏内输入 `reload`

改 `configs/*.json` 仍需重启 BDS（配置启动缓存）。

CLI：

```bash
node sfmc/dist/main.js module enable feature-afk
node sfmc/dist/main.js module disable feature-afk
node sfmc/dist/main.js reload
```

各模块对外服务见 [模块服务目录](./modules/README.md)。
