# @sfmc-bds/sdk

## 0.2.0-beta.6

### Patch Changes

- c1de2a8: none
- f8cbe3b: none
- b6f8adc: none

## 0.2.0-beta.5

### Patch Changes

- none

## 0.2.0-beta.4

### Patch Changes

- none

## 0.2.0-beta.3

### Patch Changes

- none

## 0.2.0-beta.2

### Minor Changes

- feat(sapi): 增强 debug 门面（运行时开关 + DebugSink），经 @minecraft/diagnostics 可选接入 Sentry；BP manifest 声明 diagnostics/server-admin

### Patch Changes

- feat(sapi): 增强调试日志功能，支持 Sentry 接入，更新相关模块和文档

## 0.2.0-beta.1

### Patch Changes

- a5ccbd3: fix(logs/config): BDS 级别解析 DRY 到 SDK；剥前缀后勿误判 Error；readJson 剥 BOM；log-filter 走 ensureSchemaConfig

## 0.2.0-beta.0

### Minor Changes

- 进度条 ProgressHandle.setTotal / 非 TTY 契约；HttpDB 按请求 token 与 DataAdapter；ModuleRegistry 鉴权注入；日志高亮；ensureCoreConfigs；contracts 精简与 cleanupModule 作用域收敛。
