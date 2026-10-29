---
"@sfmc-bds/db-server": patch
"@sfmc-bds/mp-gateway": patch
"@sfmc-bds/cli": patch
---

修复排行榜：未传 limit 时不再被夹成 1 行（在线时长本月/总计只显示自己）；财富排行改读经济账户表 sfmc_economy_accounts，与「我的」余额同源，并合并同一玩家的 xuid / 玩家名重复账户，不再出现计分板离线占位名。
