# @sfmc-bds/tools

## 0.2.0-beta.1

### Patch Changes

- 44ca909: 修复发版编排：浅克隆不再误打全量 tag；CHANGELOG 摘录正则；release-tags 状态 DRY
- listPendingChangesetFiles：pre mode 下排除已写入 pre.json 的 id，避免误判待消费（LSP）
- tag-packages：CI 不再默认 --from-existing；空 RELEASE_TAGS_STATE 禁止 push/gh 全量回退

## 0.2.0-beta.0

### Minor Changes

- tsc7 双轨入口；sdk-lint / manifest schema / 模块脚手架；zipx DRY；pack:verify 从 NPM_PUBLISH_PACKAGES 派生；ootb 断言对齐。

### Patch Changes

- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.0
