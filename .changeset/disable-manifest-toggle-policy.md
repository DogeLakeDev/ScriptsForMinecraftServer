---
"@sfmc-bds/sdk": minor
"@sfmc-bds/db-server": minor
"@sfmc-bds/cli": minor
---

停用模块 manifest 的 `canDisable` 与 `enabledByDefault`：从 JSON Schema 和 TypeScript 契约移除，SDK v2/v3 校验及 DB 加载器拒绝包含这些字段的声明。模块作者需删除旧字段；安装目录投影统一默认启用、允许服主禁用，已有启停状态仍由 module-lock 管理，升级继续保留。
