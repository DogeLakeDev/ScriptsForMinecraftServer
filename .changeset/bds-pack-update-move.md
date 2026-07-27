---
"@sfmc-bds/bds-tools": minor
"@sfmc-bds/cli": patch
---

feat(bds-tools): 将 pack-update 域逻辑迁入 `@sfmc-bds/bds-tools/pack-update`

- 新增 `createPackUpdateApi(deps)` 依赖注入入口；版本策略 / CurseForge / 默认配置语义不变
- sfmc 保留薄封装注入 ROOT、i18n、theme、clack、logs
