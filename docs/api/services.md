# 服务 API

跨模块 RPC：提供方在 manifest `services.provides` 声明，消费方在 `services.requires` 声明。

## GET /api/sfmc/services

列出已注册服务：

```json
{ "services": [{ "name": "land.byId", "moduleId": "feature-land" }] }
```

## GET /api/sfmc/services/:name

Query：`input=<urlencoded-json>`

示例：

```bash
curl "http://127.0.0.1:3001/api/sfmc/services/land.byId?input=%7B%22landId%22%3A%22abc%22%7D"
```

需要模块身份；调用方 manifest 需声明 `service:<name>` 或在 requires 里引用。

## 与 tx 的关系

事务内调其它模块：**不要** `service.get`，用 `tx.call(name, input)`。

## SDK

```ts
import { service } from "@sfmc-bds/sdk/sapi/service";

const land = await service.get("land.byId", { landId: "abc" });
const all = await service.list();
```

详见 [SDK → service](./sdk/service.md)。各模块提供的服务名与 typed client 见 [模块服务目录](./modules/README.md)。
