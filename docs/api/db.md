# 数据库 API

前缀 `/api/sfmc/db/`，**全部 POST**，需要模块身份。

模块在 manifest 里声明 `db:read:<table>` / `db:write:<table>` 等权限。

## POST /api/sfmc/db/define-table

初始化表结构（只在模块 init 阶段调，不要放在 tx 里）。

```json
{
  "name": "lands",
  "columns": [
    { "name": "id", "type": "TEXT", "primaryKey": true },
    { "name": "owner_player_id", "type": "TEXT" }
  ],
  "softDelete": true
}
```

响应：`{ success, table, created }`

## 单步 CRUD

| 路径 | Body 要点 | 响应 |
|------|-----------|------|
| `/query` | `{ table, opts? }` | `{ rows }` |
| `/get` | `{ table, id }` | `{ row }` |
| `/insert` | `{ table, row }` | `{ row }` |
| `/update` | `{ table, id, patch }` | `{ row }` |
| `/delete` | `{ table, id, hard? }` | `{ changes }` |
| `/audit` | `{ table, rowId, action, data? }` | `{ ok }` |

`opts` 使用表达式树 `WhereExpr`，**不要**传 SQL 字符串。

## POST /api/sfmc/db/tx

事务，body `{ steps: TxStep[] }`。步骤类型包括 query、get、insert、update、delete、audit、**call**（调 service）。

在 tx 内用 `tx.*`，不要混用外面的单步 CRUD。

## 幂等

| 路径 | 作用 |
|------|------|
| `/idempotent/probe` | `{ action, key }` → 是否已执行 |
| `/idempotent/commit` | 提交幂等结果 |

SDK：`db.idempotent(action, key, fn)`。

## SDK 封装

```ts
import { db, type TxContext } from "@sfmc-bds/sdk/sapi/db";

await db.defineTable("my_table", [/* columns */]);

const rows = await db.query("my_table", { where: { /* WhereExpr */ } });

await db.tx(async (tx: TxContext) => {
  await tx.update("lands", id, { version: 2 });
  await tx.call("economy.debit", { playerId, amount: 100 });
});
```

详见 [SDK → db](./sdk/db.md)。
