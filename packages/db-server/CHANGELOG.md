# @sfmc-bds/db-server

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.2.0-beta.3

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.2.0-beta.2

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3

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

- configs/all 下发 modules+tokens；模块 enable 热同步；经济行类型内聚 domain；服务文件日志统一；v2 失败信封与 SOLID 收敛。

### Patch Changes

- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.0
