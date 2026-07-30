# 数据库

前缀 `/api/sfmc/db/`，**全部 POST**，需要模块身份。manifest 声明 `db:read:<table>` / `db:write:<table>` 等。

模块侧封装见 [SDK · db](./sdk/db.md)。

## POST /api/sfmc/db/define-table

仅在模块 `init` 调用，不要放进 tx。

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

响应：`{ success, table, created }`。

## 单步 CRUD

| 路径 | Body 要点 | 响应 |
| ------ | ------ | ------ |
| `/query` | `{ table, opts? }` | `{ rows }` |
| `/get` | `{ table, id }` | `{ row }` |
| `/insert` | `{ table, row }` | `{ row }` |
| `/update` | `{ table, id, patch }` | `{ row }` |
| `/delete` | `{ table, id, hard? }` | `{ changes }` |
| `/audit` | `{ table, rowId, action, data? }` | `{ ok }` |

`opts` 使用 `WhereExpr` 表达式树，**不要**传 SQL 字符串。

## 事务

### 交互会话（SDK `db.tx` 默认）

| 路径 | Body | 响应要点 |
| ------ | ------ | ------ |
| `/tx/begin` | `{}` | `{ ok, txId }` |
| `/tx/step` | `{ txId, step }` | `{ ok, result }` |
| `/tx/commit` | `{ txId }` | `{ ok, results }` |
| `/tx/rollback` | `{ txId }` | `{ ok }` |

### 批量（工具 / 测试）

`POST /api/sfmc/db/tx`，body `{ steps: TxStep[] }` → `{ ok, results }`。

步骤类型：query、get、insert、update、delete、audit、**service**（对应 SDK `tx.call`）。

tx 内只用 `tx.*`，不要混用外面的单步 CRUD。

## 幂等

| 路径 | 作用 |
| ------ | ------ |
| `/idempotent/probe` | `{ action, key }` → 是否已执行 |
| `/idempotent/commit` | 提交幂等结果 |

SDK：`db.idempotent(action, key, fn)`。
