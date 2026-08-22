# @sfmc-bds/devkit

## 1.0.0-beta.2

### Major Changes

- e5b9142: 模块作者面改用 `npm create @sfmc-bds/module`（`@sfmc-bds/create-module`）为唯一建仓入口；移除 `@sfmc-bds/devkit` 的 `sfmc-new-module` / `scaffoldModule`。扩展补齐 Create→Test→Link→Watch→Publish 全周期。

### Patch Changes

- Updated dependencies [e5b9142]
  - @sfmc-bds/cli@0.2.0-beta.11

## 0.1.0-beta.2

### Minor Changes

- 9dd77b4: 停发 `@sfmc-bds/tools`：`fetch-module` 迁入 `@sfmc-bds/cli`，`new-module` 迁入 `@sfmc-bds/devkit`；tools 改为 monorepo private（verify/build bins）。meta 不再依赖 tools。发版后请对已发布 beta 执行：

  `npm deprecate @sfmc-bds/tools@"*" "Moved: use @sfmc-bds/cli (mod install) and @sfmc-bds/devkit (scaffold)."`

### Patch Changes

- Updated dependencies [9dd77b4]
  - @sfmc-bds/cli@0.2.0-beta.10

## 0.1.0-beta.1

### Minor Changes

- 4dd2d16: feat(devkit): 新增模块作者工具包（watch / scaffold / rebuild）

  供 VS Code 扩展直接依赖；tools 导出 new-module.mjs。

### Patch Changes

- Updated dependencies [d1331e3]
- Updated dependencies [8552772]
- Updated dependencies [4dd2d16]
- Updated dependencies [8552772]
- Updated dependencies [8552772]
- Updated dependencies [2326e6d]
- Updated dependencies [b252a35]
- Updated dependencies [e175ed9]
  - @sfmc-bds/tools@0.2.0-beta.9
  - @sfmc-bds/cli@0.2.0-beta.8
  - @sfmc-bds/bds-tools@0.2.0-beta.8
