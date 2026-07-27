---
"@sfmc-bds/cli": minor
---

feat(sfmc): 新增 `debug` 顶层命令管理 BDS 调试配置

- 直接读写 `<BDS>/config/default/variables.json` 与 `secrets.json`
- 子命令：status / enable / disable / sentry on --dsn <dsn> / sentry off
- 不修改 SDK 现有 `applyDebugFromVariables()` / `initSentryIfConfigured()` 语义
- CLI = 配置入口；行为包运行时由 SDK 读取
- 变更后需 `sfmc mod reload` 或重启 BDS 生效