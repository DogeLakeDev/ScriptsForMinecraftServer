---
"@sfmc-bds/db-server": patch
---

将 `TxRunner` 的批量事务与交互式事务会话纳入同一个 SQLite 单连接队列，避免并发备份与查询触发嵌套 `BEGIN` 失败。
