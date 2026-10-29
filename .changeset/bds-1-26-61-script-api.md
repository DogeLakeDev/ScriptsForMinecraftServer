---
"@sfmc-bds/sdk": minor
"@sfmc-bds/create-module": patch
"@sfmc-bds/bds-tools": patch
---

适配 BDS 1.26.61：Script API 依赖升级到 `@minecraft/server` 2.12.0-beta、`@minecraft/server-ui` 2.4.0-beta（1.26.61-stable），`@minecraft/vanilla-data` 升级到 1.26.60；新模块模板同步更新。旧版 2.11.0-beta 在 BDS 1.26.60+ 上无法加载，模块需随之升级。

修复 BDS 更新下载失败并自动回滚成功后未清除回滚标记的问题，避免之后手动 recovery 用旧备份覆盖新存档。
