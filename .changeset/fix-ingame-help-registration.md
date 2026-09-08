---
"@sfmc-bds/sdk": minor
"@sfmc-bds/create-module": patch
"@sfmc-bds/db-server": patch
---

将旧版 `!` 聊天前缀命令迁移到 Bedrock 原生自定义命令接口。平台命令统一使用
`/sfmc:<command>`，模块命令使用 `/sfmc:<moduleId>_<command>`；同时修复内置
`/sfmc:help` 及其访客权限未注册的问题。

交互式数据库事务改为互斥排队执行，避免并发 `beginSession` 清理仍在使用的会话。
