# service

```ts
import { service, ServiceError } from "@sfmc-bds/sdk/sapi/service";

const land = await service.get<{ id: string; name: string } | null>(
  "land.byId",
  { landId: "abc" }
);

const names = await service.list();
```

## 声明

提供方 manifest：

```json
"services": {
  "provides": [{ "name": "land.byId", "input": {}, "output": {} }],
  "requires": []
}
```

消费方 manifest：

```json
"services": {
  "provides": [],
  "requires": [{ "name": "land.byId" }]
}
```

并在 `permissions` 里声明 `service:land.byId`（按平台校验规则）。

## 事务内

```ts
await db.tx(async (tx) => {
  await tx.call("economy.debit", { playerId, amount: 100 });
});
```

不要用 `service.get` 代替 `tx.call`。

## 错误

`ServiceError` — 服务不存在、权限不足、handler 抛错等。

HTTP 见 [服务 API](../services.md)。
