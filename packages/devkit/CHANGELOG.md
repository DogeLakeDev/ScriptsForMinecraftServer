# @sfmc-bds/devkit

## 2.0.0

### Major Changes

- a065cc4: 增加模块索引预览和一键 PR 提交，共用 npm、Schema、来源与依赖校验，支持重复提交更新及发布后 CI 接入；脚手架提供索引展示配置。

  为避免 CLI 与 devkit 循环依赖，devkit 不再隐式安装 CLI。使用重建部署功能的独立 devkit 消费者需另行安装 @sfmc-bds/cli，或配置 SFMC_CLI / cliPath；官方扩展继续自带 CLI。

### Patch Changes

- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
  - @sfmc-bds/sdk@0.3.0
  - @sfmc-bds/bds-tools@0.2.5

## 1.0.8

### Patch Changes

- Updated dependencies [9dd0581]
  - @sfmc-bds/cli@0.3.2
  - @sfmc-bds/sdk@0.2.4
  - @sfmc-bds/bds-tools@0.2.4

## 1.0.7

### Patch Changes

- Updated dependencies [70cf2f9]
  - @sfmc-bds/sdk@0.2.3
  - @sfmc-bds/bds-tools@0.2.3
  - @sfmc-bds/cli@0.3.1

## 1.0.6

### Patch Changes

- Updated dependencies [09f5867]
  - @sfmc-bds/cli@0.3.0

## 1.0.5

### Patch Changes

- Updated dependencies [33149b3]
  - @sfmc-bds/cli@0.2.5

## 1.0.4

### Patch Changes

- Updated dependencies [c809fc3]
  - @sfmc-bds/sdk@0.2.2
  - @sfmc-bds/cli@0.2.4
  - @sfmc-bds/bds-tools@0.2.2

## 1.0.3

### Patch Changes

- Updated dependencies [5a25300]
  - @sfmc-bds/cli@0.2.3
  - @sfmc-bds/sdk@0.2.1
  - @sfmc-bds/bds-tools@0.2.1

## 1.0.2

### Patch Changes

- Updated dependencies [a4f6857]
  - @sfmc-bds/cli@0.2.2

## 1.0.1

### Patch Changes

- Updated dependencies [b55d845]
  - @sfmc-bds/cli@0.2.1

## 1.0.0

### Major Changes

- e5b9142: 模块作者面改用 `npm create @sfmc-bds/module`（`@sfmc-bds/create-module`）为唯一建仓入口；移除 `@sfmc-bds/devkit` 的 `sfmc-new-module` / `scaffoldModule`。扩展补齐 Create→Test→Link→Watch→Publish 全周期。

### Minor Changes

- 4dd2d16: feat(devkit): 新增模块作者工具包（watch / scaffold / rebuild）

  供 VS Code 扩展直接依赖；tools 导出 new-module.mjs。

- 9dd77b4: 停发 `@sfmc-bds/tools`：`fetch-module` 迁入 `@sfmc-bds/cli`，`new-module` 迁入 `@sfmc-bds/devkit`；tools 改为 monorepo private（verify/build bins）。meta 不再依赖 tools。发版后请对已发布 beta 执行：

  `npm deprecate @sfmc-bds/tools@"*" "Moved: use @sfmc-bds/cli (mod install) and @sfmc-bds/devkit (scaffold)."`

### Patch Changes

- 533716d: 统一模块模板和公开文档的 pnpm 工作流，并将 registry 模块下载改为 pnpm，补齐公开包仓库元数据。
- 4fc6ef9: chore(devkit): new-module 不再生成脚本沙箱剧本（`.sfmc/sandbox-script.json`）；README 改为 `npm test` + Sapience + Watch
- Updated dependencies [a5ccbd3]
- Updated dependencies [e714f86]
- Updated dependencies [c890a95]
- Updated dependencies [4a9b066]
- Updated dependencies [4a9b066]
- Updated dependencies [050da7f]
- Updated dependencies [3714053]
- Updated dependencies [aadd2de]
- Updated dependencies [8552772]
- Updated dependencies [8552772]
- Updated dependencies [efa6e73]
- Updated dependencies [8552772]
- Updated dependencies [b81327a]
- Updated dependencies [74a27c7]
- Updated dependencies [5ada90e]
- Updated dependencies [06e0f19]
- Updated dependencies [847bfcb]
- Updated dependencies [89ffceb]
- Updated dependencies [efa6e73]
- Updated dependencies [89ffceb]
- Updated dependencies [aadd2de]
- Updated dependencies [466d214]
- Updated dependencies [53d7119]
- Updated dependencies [8552772]
- Updated dependencies [b55557b]
- Updated dependencies [ea1e57e]
- Updated dependencies [e7e7e61]
- Updated dependencies [e5b9142]
- Updated dependencies [cc6a12b]
- Updated dependencies [533716d]
- Updated dependencies [2a5b502]
- Updated dependencies [89ffceb]
- Updated dependencies [f3ba416]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [ec728dd]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [efa6e73]
- Updated dependencies [3465c7e]
- Updated dependencies [4a9b066]
- Updated dependencies [efa6e73]
- Updated dependencies [3c07ced]
- Updated dependencies [d933a02]
- Updated dependencies [c1de2a8]
- Updated dependencies [847bfcb]
- Updated dependencies [c72fdc8]
- Updated dependencies [d9ded8f]
- Updated dependencies [5a4eff6]
- Updated dependencies [e175ed9]
- Updated dependencies [29d6deb]
- Updated dependencies [0992ab9]
- Updated dependencies [d933a02]
- Updated dependencies [c890a95]
- Updated dependencies [c890a95]
- Updated dependencies [1f7b2c7]
- Updated dependencies [2580488]
- Updated dependencies [2c91645]
- Updated dependencies [f616527]
- Updated dependencies [b81327a]
- Updated dependencies [f312e8b]
- Updated dependencies [f8cbe3b]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [0aacac4]
- Updated dependencies [b6f8adc]
- Updated dependencies [1a4ddda]
- Updated dependencies [1a4ddda]
- Updated dependencies [16bba29]
- Updated dependencies [dc62ffc]
- Updated dependencies [1a4ddda]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [12b7dfc]
- Updated dependencies [cf3293f]
- Updated dependencies [1a4ddda]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [1a4ddda]
- Updated dependencies [1a4ddda]
- Updated dependencies [9dd77b4]
- Updated dependencies [af175bc]
- Updated dependencies [5567073]
  - @sfmc-bds/sdk@0.2.0
  - @sfmc-bds/cli@0.2.0
  - @sfmc-bds/bds-tools@0.2.0

## 1.0.0-beta.12

### Patch Changes

- Updated dependencies [4a9b066]
- Updated dependencies [4a9b066]
- Updated dependencies [aadd2de]
- Updated dependencies [efa6e73]
- Updated dependencies [efa6e73]
- Updated dependencies [aadd2de]
- Updated dependencies [efa6e73]
- Updated dependencies [3465c7e]
- Updated dependencies [4a9b066]
- Updated dependencies [efa6e73]
- Updated dependencies [1a4ddda]
- Updated dependencies [1a4ddda]
- Updated dependencies [dc62ffc]
- Updated dependencies [1a4ddda]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [1a4ddda]
- Updated dependencies [dc62ffc]
- Updated dependencies [dc62ffc]
- Updated dependencies [1a4ddda]
- Updated dependencies [1a4ddda]
  - @sfmc-bds/bds-tools@0.2.0-beta.18
  - @sfmc-bds/sdk@0.2.0-beta.18
  - @sfmc-bds/cli@0.2.0-beta.21

## 1.0.0-beta.11

### Patch Changes

- Updated dependencies [5a4eff6]
- Updated dependencies [16bba29]
- Updated dependencies [12b7dfc]
- Updated dependencies [cf3293f]
  - @sfmc-bds/sdk@0.2.0-beta.17
  - @sfmc-bds/cli@0.2.0-beta.20
  - @sfmc-bds/bds-tools@0.2.0-beta.17

## 1.0.0-beta.10

### Patch Changes

- Updated dependencies [f312e8b]
  - @sfmc-bds/sdk@0.2.0-beta.16
  - @sfmc-bds/bds-tools@0.2.0-beta.16
  - @sfmc-bds/cli@0.2.0-beta.19

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [ea1e57e]
  - @sfmc-bds/sdk@0.2.0-beta.15
  - @sfmc-bds/bds-tools@0.2.0-beta.15
  - @sfmc-bds/cli@0.2.0-beta.18

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [0aacac4]
  - @sfmc-bds/cli@0.2.0-beta.17

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [cc6a12b]
- Updated dependencies [f616527]
  - @sfmc-bds/bds-tools@0.2.0-beta.14
  - @sfmc-bds/cli@0.2.0-beta.16
  - @sfmc-bds/sdk@0.2.0-beta.14

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [74a27c7]
- Updated dependencies [d933a02]
- Updated dependencies [d933a02]
  - @sfmc-bds/sdk@0.2.0-beta.13
  - @sfmc-bds/cli@0.2.0-beta.15
  - @sfmc-bds/bds-tools@0.2.0-beta.13

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies [050da7f]
  - @sfmc-bds/sdk@0.2.0-beta.12
  - @sfmc-bds/bds-tools@0.2.0-beta.12
  - @sfmc-bds/cli@0.2.0-beta.14

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [e714f86]
  - @sfmc-bds/cli@0.2.0-beta.13
  - @sfmc-bds/sdk@0.2.0-beta.11
  - @sfmc-bds/bds-tools@0.2.0-beta.11

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [d9ded8f]
  - @sfmc-bds/sdk@0.2.0-beta.10
  - @sfmc-bds/bds-tools@0.2.0-beta.10
  - @sfmc-bds/cli@0.2.0-beta.12

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
