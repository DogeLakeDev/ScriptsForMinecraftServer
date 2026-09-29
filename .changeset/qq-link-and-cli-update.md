---
"@sfmc-bds/cli": patch
"@sfmc-bds/db-server": patch
"@sfmc-bds/sdk": patch
---

模块更新改为只在显式执行 `mod update` 时换包，开服不再自动升级；`stop all` 与守护进程退出只停本进程拉起的服务。QQ 管理去掉踢人队列，绑定模块随平台仓库分发，聊天互通不再依赖已删除的 `bridge_channel_id`。
