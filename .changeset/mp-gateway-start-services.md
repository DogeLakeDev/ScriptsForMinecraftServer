---
"@sfmc-bds/mp-gateway": minor
---

网关启动后在后台确保依赖的实例服务在运行（默认 db），服务器重启后不再出现“健康检查正常、却登录不上”；可用 `--start-services` / `SFMC_MP_START_SERVICES` 调整，`none` 关闭。
