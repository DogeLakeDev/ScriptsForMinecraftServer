---
"@sfmc-bds/sdk": patch
"@sfmc-bds/tools": patch
---

fix(sdk/testing): minecraft-loader 钉死同一 `@sfmc-bds/sdk` 实例，避免模块仓 node_modules 与宿主双包导致 Command/Permission 空清单；脚手架 Command.register 传入 MODULE_ID。
