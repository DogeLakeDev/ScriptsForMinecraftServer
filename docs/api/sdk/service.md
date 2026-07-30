# service

```ts
import { service, ServiceError } from "@sfmc-bds/sdk/sapi/service";

const land = await service.get<{ id: string; name: string } | null>("land.byId", {
  landId: "abc",
});

const names = await service.list();
```

有 typed client 时优先用 client（例：[economy](../modules/economy.md)），不要手写对方私有表。

清单：[模块服务目录](../modules/index.md)。

## 声明

提供方：

```json
"services": {
  "provides": [{ "name": "land.byId", "input": {}, "output": {} }],
  "requires": []
}
```

消费方：

```json
"services": {
  "provides": [],
  "requires": [{ "name": "land.byId" }]
}
```

并在 `permissions` 声明 `service:land.byId`（按平台规则）。

## 事务内

```ts
import { economy } from "@sfmc-bds/module-economy/client";

await db.tx(async (tx) => {
  await economy.account.inTx(tx).debit({ playerId, amount: 100, reason: "buy" });
  // 无 client：await tx.call("economy.account.debit", { … });
});
```

不要用 `service.get` 代替 `tx.call` / `inTx`。

## 错误

`ServiceError` — 服务不存在、权限不足、handler 抛错等。

HTTP 见 [服务 RPC](../services.md)。
