---
"@sfmc-bds/qq-bridge": patch
---

llbot 指令回复优先经 reverse-WS 发 send_group_msg，避免未开 HTTP 3004 时 ECONNREFUSED
