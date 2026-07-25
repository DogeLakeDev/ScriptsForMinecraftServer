# @sfmc-bds/tools

## 0.2.0-beta.1

### Patch Changes

- 44ca909: 修复发版编排：浅克隆不再误打全量 tag；CHANGELOG 摘录正则；release-tags 状态 DRY
- tag-packages 默认 HEAD~1 版本 diff（不再因 CI=true 强制 from-existing）；空 `.sfmc-release-tags.json` 下游一律信任，禁止回退扫全仓 tag

## 0.2.0-beta.0

### Minor Changes

- tsc7 双轨入口；sdk-lint / manifest schema / 模块脚手架；zipx DRY；pack:verify 从 NPM_PUBLISH_PACKAGES 派生；ootb 断言对齐。

### Patch Changes

- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.0
