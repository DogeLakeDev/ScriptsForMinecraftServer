# service

```ts
import { service, ServiceError } from "@sfmc-bds/sdk/sapi/service";

const land = await service.get<{ id: string; name: string } | null>(
  "land.byId",
  { landId: "abc" }
);

const names = await service.list();
```

有 typed client 的模块优先用 client（例：[`@sfmc-bds/module-economy/client`](../modules/economy.md)），不要手写对方私有表。

完整服务清单：[模块服务目录](../modules/README.md)。

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
import { economy } from "@sfmc-bds/module-economy/client";

await db.tx(async (tx) => {
  await economy.account.inTx(tx).debit({ playerId, amount: 100, reason: "buy" });
  // 无 client 时：await tx.call("economy.account.debit", { … });
});
```

不要用 `service.get` 代替事务内的 `tx.call` / `inTx`。

## 错误

`ServiceError` — 服务不存在、权限不足、handler 抛错等。

HTTP 见 [服务 API](../services.md)。
