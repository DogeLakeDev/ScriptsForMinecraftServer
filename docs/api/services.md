# 服务 RPC

跨模块 RPC 的 HTTP 面。提供方在 manifest `services.provides` 声明，消费方在 `services.requires` 声明。

模块侧见 [SDK · service](./sdk/service.md)；具体服务名与 client 见 [模块服务目录](./modules/index.md)。

## GET /api/sfmc/services

列出已注册服务：

```json
{ "services": [{ "name": "land.byId", "moduleId": "feature-land" }] }
```

## GET /api/sfmc/services/:name

Query：`input=<urlencoded-json>`。

```bash
curl "http://127.0.0.1:3001/api/sfmc/services/land.byId?input=%7B%22landId%22%3A%22abc%22%7D"
```

需要模块身份；调用方须具备对应 `service:<name>` 权限（或平台认可的 requires 声明）。

## 与 tx 的关系

事务内调其它模块：**不要** `service.get`，用 `tx.call(name, input)`（或对方 client 的 `inTx`）。
