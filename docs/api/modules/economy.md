# feature-economy 服务

安装 id：`economy` · npm：`@sfmc-bds/module-economy`

经济账本的**唯一推荐入口**。其它模块禁止直接读写 `sfmc_economy_*` 表。

## Typed client（推荐）

```ts
import { economy } from "@sfmc-bds/module-economy/client";

const acc = await economy.account.get({ playerId, playerName });
await economy.account.credit({ playerId, amount: 100, reason: "reward" });
await economy.account.debit({ playerId, amount: 50, reason: "buy" });
await economy.account.transfer({
  fromPlayerId: "a",
  toPlayerId: "b",
  amount: 10,
});

// 与外层 db.tx 共享同一 SQLite 事务
await db.tx(async (tx) => {
  await economy.account.inTx(tx).debit({ playerId, amount: 10, reason: "land" });
});

const { tasks } = await economy.dailyTasks.list();
await economy.dailyTasks.submit({ taskId, actorId, quantity: 1 });
const stats = await economy.stats.monthly();
```

`package.json`：

```json
{ "dependencies": { "@sfmc-bds/module-economy": "*" } }
```

## 与 SDK `Money` 的分工

| API | 用途 |
|-----|------|
| `Money.get` / `load` / `setCached` / `UNIT` | 玩家侧余额**展示与缓存** |
| `economy.account.*` / `inTx` | **写账本**、跨模块扣款、事务内转账 |

UI 可读 `Money`；扣款/转账必须走 economy client。

## Service 名（manifest `provides`）

| 名称 | 说明 |
|------|------|
| `economy.account.get` | 查询/确保账户 |
| `economy.account.credit` | 入账 |
| `economy.account.debit` | 扣款 |
| `economy.account.transfer` | 转账 |
| `economy.dailyTasks.list` | 日常任务列表 |
| `economy.dailyTasks.submit` | 提交日常任务 |
| `economy.stats.monthly` | 月度统计 |

无 client 时：

```ts
await service.get("economy.account.get", { playerId });
await tx.call("economy.account.debit", { playerId, amount, reason });
```

## 消费方须声明

```json
{
  "requires": ["feature-economy"],
  "permissions": ["service:economy.account.debit", "service:economy.account.credit"],
  "services": {
    "requires": [
      { "name": "economy.account.debit" },
      { "name": "economy.account.credit" }
    ]
  }
}
```

业务逻辑实现仍在平台 `db-server/src/domain/economy.ts`（行类型本地内联）；SAPI 通过 service 调用。
