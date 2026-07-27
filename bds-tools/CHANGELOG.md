# @sfmc-bds/bds-tools

## 0.2.0-beta.7

### Patch Changes

- c1de2a8: none
- f8cbe3b: none
- b6f8adc: none
- Updated dependencies [c1de2a8]
- Updated dependencies [f8cbe3b]
- Updated dependencies [b6f8adc]
  - @sfmc-bds/sdk@0.2.0-beta.6

## 0.2.0-beta.6

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.2.0-beta.5

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3

## 0.2.0-beta.3

### Patch Changes

- feat(sapi): 增强调试日志功能，支持 Sentry 接入，更新相关模块和文档
- feat(sapi): 增强 debug 门面（运行时开关 + DebugSink），经 @minecraft/diagnostics 可选接入 Sentry；BP manifest 声明 diagnostics/server-admin
- Updated dependencies
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.2

## 0.2.0-beta.2

### Patch Changes

- 3714053: 发版：build-publishable 拓扑 + listPublishableBuildDeps（npm-publish 应急补发不再硬编码只 build SDK）；push 缺失态 DRY 对齐 listUnpushedExistingVersionTags。世界包：readPackDirOccupancy DRY，去掉死不变式，occupancy 保留真实 kind（LSP）。
- 5ada90e: 修复 #80/#81 合并后 `scanDestOccupancy` 未赋值 `facts`、引用未声明标识符导致 tsc 构建失败；恢复经 `readPackDirOccupancy` 的 DRY 占用扫描。

## 0.2.0-beta.1

### Patch Changes

- - feat(remote-controller): 添加日志功能并更新包依赖
  - chore/fix:
  - 在 package.json 中添加 @sfmc-bds/sdk 作为依赖。
  - 引入日志模块（log.ts），用于 remote-controller 的统一日志记录。
  - 将 console.error 和 console.log 语句替换为 log 方法，以改善日志管理。
  - 更新 index.ts，使其在错误和信息提示中利用新的日志功能。
  - 增强 world-packs.ts 中各类操作（包括安装和冲突处理）的日志记录。
  - 改进中英文 i18n 本地化字符串，提升清晰度和一致性。

## 0.2.0-beta.0

### Minor Changes

- world-packs 卸载回收站与 zip-slip 防护；pack-manager 过期 BP/RP 清理；pack-lifecycle 直连 pack-manager-lib；BDS 路径 helpers 收敛。

### Patch Changes

- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.0
