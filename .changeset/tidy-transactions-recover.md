---
"@sfmc-bds/db-server": patch
---

为交互式数据库事务增加空闲租约回收，并为事务槽排队增加超时和 `transaction_busy` 错误，防止孤儿事务永久阻塞所有模块。
