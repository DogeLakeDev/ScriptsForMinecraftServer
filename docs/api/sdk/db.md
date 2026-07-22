# db

```ts
import { db, DbError, type TxContext } from "@sfmc-bds/sdk/sapi/db";
```

HTTP 映射见 [数据库 API](../db.md)。

## defineTable

只在 `init` 里调用，不要放进 tx：

```ts
await db.defineTable("lands", [
  { name: "id", type: "TEXT", primaryKey: true },
  { name: "owner_player_id", type: "TEXT" },
], { softDelete: true });
```

## 单步 CRUD（tx 外）

```ts
const rows = await db.query("lands", { where: { /* WhereExpr */ } });
const row = await db.get("lands", id);
await db.insert("lands", { id, owner_player_id: "..." });
await db.update("lands", id, { version: 2 });
await db.delete("lands", id);
await db.audit("lands", id, "transfer", { to: "..." });
```

## 事务

`db.tx` 走交互会话（begin → step* → commit）：回调里 `await tx.query/get/call` 返回**真实**服务端结果，可据此分支。

```ts
await db.tx(async (tx: TxContext) => {
  const row = await tx.get("lands", landId);
  if (!row) throw new Error("missing");
  await tx.update("lands", landId, { owner_player_id: newOwner });
  await tx.audit("lands", landId, "transfer", { from, to });
  const debit = await tx.call<{ ok: boolean }>("economy.debit", { playerId, amount: 100 });
  return { ok: true, debit };
});
```

tx 内用 `tx.query/get/insert/update/delete/audit/call`，不要混用外面的 `db.query` 等。

## 幂等

```ts
await db.idempotent("pay:order-123", async () => {
  // 只执行一次的业务
});
```

## WhereExpr

表达式树，例如 `{ field: "owner_player_id", op: "eq", value: "uuid" }`。禁止 SQL 字符串。

## 错误

`DbError` 含平台错误码；权限不足、表冲突等会在 HTTP 层返回 4xx。
