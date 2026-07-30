---
"@sfmc-bds/cli": minor
---

feat(sfmc): mod enable/disable 本地写 lock，db 在线时 best-effort 热同步

启停不再强依赖 db-server：先写 `module-lock.json`，再尝试 POST；通知失败仍成功并警告。
