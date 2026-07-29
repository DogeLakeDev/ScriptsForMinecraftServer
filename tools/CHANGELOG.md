# @sfmc-bds/tools

## 0.2.0-beta.7

### Patch Changes

- b55557b: 纯 index 契约：`--link` 支持 `local:`；index map 支持 `npm`；拆除旁路 sfmc-modules monorepo DX；`mod publish` 写 map 并拒绝 private/非官方 `@sfmc-bds`。
- e7e7e61: // @ts-check：添加到 23 个 tools/_.mjs 脚本 + 11 个 tools/lib/_.mjs 库 + 5 个 tools/_.test.mjs + 11 个 sfmc/_.test.mjs + 5 个 changeset 系列
- Updated dependencies [c72fdc8]
- Updated dependencies [0992ab9]
  - @sfmc-bds/sdk@0.2.0-beta.6

## 0.2.0-beta.6

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.6
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.2.0-beta.5

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.5
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3
  - @sfmc-bds/bds-tools@0.2.0-beta.4

## 0.2.0-beta.3

### Patch Changes

- 3714053: 发版：build-publishable 拓扑 + listPublishableBuildDeps（npm-publish 应急补发不再硬编码只 build SDK）；push 缺失态 DRY 对齐 listUnpushedExistingVersionTags。世界包：readPackDirOccupancy DRY，去掉死不变式，occupancy 保留真实 kind（LSP）。
- Updated dependencies [3714053]
- Updated dependencies [5ada90e]
  - @sfmc-bds/bds-tools@0.2.0-beta.2

## 0.2.0-beta.2

### Patch Changes

- 61379c7: 发版编排：GitHub Release 缺失态回退复用 listPackagesWithExistingVersionTags；文档/workflow 对齐 SFMC_GITHUB_TOKEN（兼容旧名）

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
