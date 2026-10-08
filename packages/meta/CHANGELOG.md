# @sfmc-bds/sfmc

## 0.2.16

### Patch Changes

- Updated dependencies [d18e066]
- Updated dependencies [d18e066]
- Updated dependencies [d18e066]
- Updated dependencies [d18e066]
  - @sfmc-bds/cli@0.5.1
  - @sfmc-bds/db-server@0.5.1

## 0.2.15

### Patch Changes

- Updated dependencies [d538524]
  - @sfmc-bds/sdk@0.4.0
  - @sfmc-bds/db-server@0.5.0
  - @sfmc-bds/cli@0.5.0
  - @sfmc-bds/bds-tools@0.2.8
  - @sfmc-bds/qq-bridge@0.3.1

## 0.2.14

### Patch Changes

- Updated dependencies [fe9ab2e]
- Updated dependencies [fe9ab2e]
  - @sfmc-bds/cli@0.4.5
  - @sfmc-bds/db-server@0.4.0
  - @sfmc-bds/qq-bridge@0.3.0
  - @sfmc-bds/sdk@0.3.2
  - @sfmc-bds/bds-tools@0.2.7

## 0.2.13

### Patch Changes

- Updated dependencies [7b601f6]
- Updated dependencies [1946e4c]
  - @sfmc-bds/db-server@0.3.2
  - @sfmc-bds/cli@0.4.4

## 0.2.12

### Patch Changes

- Updated dependencies [21a5efd]
  - @sfmc-bds/sdk@0.3.1
  - @sfmc-bds/bds-tools@0.2.6
  - @sfmc-bds/cli@0.4.3
  - @sfmc-bds/db-server@0.3.1
  - @sfmc-bds/qq-bridge@0.2.6

## 0.2.11

### Patch Changes

- Updated dependencies [6bc2e42]
- Updated dependencies [6bc2e42]
  - @sfmc-bds/cli@0.4.2

## 0.2.10

### Patch Changes

- @sfmc-bds/cli@0.4.1

## 0.2.9

### Patch Changes

- a065cc4: 增加版本化桌面管理协议、非交互 stdio 入口、持久化任务和跨进程维护锁；守护进程可由独立 Node 与显式 CLI 入口启动，保持原 CLI 协议兼容。
- Updated dependencies [7aa43b0]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
  - @sfmc-bds/cli@0.4.0
  - @sfmc-bds/sdk@0.3.0
  - @sfmc-bds/db-server@0.3.0
  - @sfmc-bds/bds-tools@0.2.5
  - @sfmc-bds/qq-bridge@0.2.5

## 0.2.8

### Patch Changes

- Updated dependencies [9dd0581]
  - @sfmc-bds/cli@0.3.2
  - @sfmc-bds/db-server@0.2.4
  - @sfmc-bds/sdk@0.2.4
  - @sfmc-bds/bds-tools@0.2.4
  - @sfmc-bds/qq-bridge@0.2.4

## 0.2.7

### Patch Changes

- Updated dependencies [70cf2f9]
  - @sfmc-bds/sdk@0.2.3
  - @sfmc-bds/db-server@0.2.3
  - @sfmc-bds/qq-bridge@0.2.3
  - @sfmc-bds/bds-tools@0.2.3
  - @sfmc-bds/cli@0.3.1

## 0.2.6

### Patch Changes

- Updated dependencies [09f5867]
  - @sfmc-bds/cli@0.3.0

## 0.2.5

### Patch Changes

- Updated dependencies [33149b3]
  - @sfmc-bds/cli@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies [c809fc3]
  - @sfmc-bds/sdk@0.2.2
  - @sfmc-bds/cli@0.2.4
  - @sfmc-bds/bds-tools@0.2.2
  - @sfmc-bds/db-server@0.2.2
  - @sfmc-bds/qq-bridge@0.2.2

## 0.2.3

### Patch Changes

- 5a25300: 新增 CLI 守护进程监管：退出 CLI 不停服，经命名管道 RPC 连接；移除 bds_updater 崩溃自启配置项，改由 daemon 固定拉起。正式版补丁 0.2.3。
- Updated dependencies [5a25300]
  - @sfmc-bds/cli@0.2.3
  - @sfmc-bds/sdk@0.2.1
  - @sfmc-bds/bds-tools@0.2.1
  - @sfmc-bds/db-server@0.2.1
  - @sfmc-bds/qq-bridge@0.2.1

## 0.2.2

### Patch Changes

- a4f6857: 修正正式版包内安装说明，并明确 pnpm 新发布版本的默认等待期和精确版本安装方式。
- Updated dependencies [a4f6857]
  - @sfmc-bds/cli@0.2.2

## 0.2.1

### Patch Changes

- b55d845: 修正官方模块索引的 npm 来源显示，并按索引的精确版本安装模块。
- Updated dependencies [b55d845]
  - @sfmc-bds/cli@0.2.1

## 0.2.0

### Patch Changes

- c1de2a8: none
- f8cbe3b: none
- b6f8adc: none
- 9dd77b4: 停发 `@sfmc-bds/tools`：`fetch-module` 迁入 `@sfmc-bds/cli`，`new-module` 迁入 `@sfmc-bds/devkit`；tools 改为 monorepo private（verify/build bins）。meta 不再依赖 tools。发版后请对已发布 beta 执行：

  `npm deprecate @sfmc-bds/tools@"*" "Moved: use @sfmc-bds/cli (mod install) and @sfmc-bds/devkit (scaffold)."`

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
- Updated dependencies [efa6e73]
- Updated dependencies [efa6e73]
- Updated dependencies [847bfcb]
- Updated dependencies [89ffceb]
- Updated dependencies [efa6e73]
- Updated dependencies [89ffceb]
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
- Updated dependencies [0da9c98]
- Updated dependencies [533716d]
- Updated dependencies [2a5b502]
- Updated dependencies [5712b87]
- Updated dependencies [89ffceb]
- Updated dependencies [f3ba416]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [efa6e73]
- Updated dependencies [89ffceb]
- Updated dependencies [ec728dd]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [efa6e73]
- Updated dependencies [3465c7e]
- Updated dependencies [4a9b066]
- Updated dependencies [349b070]
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
- Updated dependencies [89ffceb]
- Updated dependencies [f312e8b]
- Updated dependencies [f8cbe3b]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [8d71b80]
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
  - @sfmc-bds/db-server@0.2.0
  - @sfmc-bds/qq-bridge@0.2.0

## 0.2.0-beta.16

### Patch Changes

- Updated dependencies [4a9b066]
- Updated dependencies [4a9b066]
- Updated dependencies [aadd2de]
- Updated dependencies [efa6e73]
- Updated dependencies [efa6e73]
- Updated dependencies [efa6e73]
- Updated dependencies [efa6e73]
- Updated dependencies [aadd2de]
- Updated dependencies [efa6e73]
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
  - @sfmc-bds/db-server@0.2.0-beta.15
  - @sfmc-bds/qq-bridge@0.2.0-beta.13

## 0.2.0-beta.15

### Patch Changes

- Updated dependencies [5a4eff6]
- Updated dependencies [16bba29]
- Updated dependencies [12b7dfc]
- Updated dependencies [cf3293f]
  - @sfmc-bds/sdk@0.2.0-beta.17
  - @sfmc-bds/cli@0.2.0-beta.20
  - @sfmc-bds/bds-tools@0.2.0-beta.17
  - @sfmc-bds/db-server@0.2.0-beta.14
  - @sfmc-bds/qq-bridge@0.2.0-beta.12

## 0.2.0-beta.14

### Patch Changes

- Updated dependencies [f312e8b]
  - @sfmc-bds/sdk@0.2.0-beta.16
  - @sfmc-bds/bds-tools@0.2.0-beta.16
  - @sfmc-bds/cli@0.2.0-beta.19
  - @sfmc-bds/db-server@0.2.0-beta.13
  - @sfmc-bds/qq-bridge@0.2.0-beta.11

## 0.2.0-beta.13

### Patch Changes

- Updated dependencies [ea1e57e]
- Updated dependencies [0da9c98]
  - @sfmc-bds/sdk@0.2.0-beta.15
  - @sfmc-bds/db-server@0.2.0-beta.12
  - @sfmc-bds/bds-tools@0.2.0-beta.15
  - @sfmc-bds/cli@0.2.0-beta.18
  - @sfmc-bds/qq-bridge@0.2.0-beta.10

## 0.2.0-beta.12

### Patch Changes

- Updated dependencies [0aacac4]
  - @sfmc-bds/cli@0.2.0-beta.17
  - @sfmc-bds/db-server@0.2.0-beta.11

## 0.2.0-beta.11

### Patch Changes

- Updated dependencies [cc6a12b]
- Updated dependencies [f616527]
- Updated dependencies [8d71b80]
  - @sfmc-bds/bds-tools@0.2.0-beta.14
  - @sfmc-bds/cli@0.2.0-beta.16
  - @sfmc-bds/sdk@0.2.0-beta.14
  - @sfmc-bds/db-server@0.2.0-beta.10
  - @sfmc-bds/qq-bridge@0.2.0-beta.9

## 0.2.0-beta.10

### Patch Changes

- Updated dependencies [74a27c7]
- Updated dependencies [349b070]
- Updated dependencies [d933a02]
- Updated dependencies [d933a02]
  - @sfmc-bds/sdk@0.2.0-beta.13
  - @sfmc-bds/db-server@0.2.0-beta.9
  - @sfmc-bds/cli@0.2.0-beta.15
  - @sfmc-bds/bds-tools@0.2.0-beta.13
  - @sfmc-bds/qq-bridge@0.2.0-beta.8

## 0.2.0-beta.9

### Patch Changes

- Updated dependencies [050da7f]
  - @sfmc-bds/sdk@0.2.0-beta.12
  - @sfmc-bds/bds-tools@0.2.0-beta.12
  - @sfmc-bds/cli@0.2.0-beta.14
  - @sfmc-bds/db-server@0.2.0-beta.8
  - @sfmc-bds/qq-bridge@0.2.0-beta.7

## 0.2.0-beta.8

### Patch Changes

- Updated dependencies [e714f86]
  - @sfmc-bds/cli@0.2.0-beta.13
  - @sfmc-bds/sdk@0.2.0-beta.11
  - @sfmc-bds/bds-tools@0.2.0-beta.11
  - @sfmc-bds/db-server@0.2.0-beta.7
  - @sfmc-bds/qq-bridge@0.2.0-beta.6

## 0.2.0-beta.7

### Patch Changes

- Updated dependencies [d9ded8f]
  - @sfmc-bds/sdk@0.2.0-beta.10
  - @sfmc-bds/bds-tools@0.2.0-beta.10
  - @sfmc-bds/cli@0.2.0-beta.12
  - @sfmc-bds/db-server@0.2.0-beta.6
  - @sfmc-bds/qq-bridge@0.2.0-beta.5

## 0.2.0-beta.6

### Patch Changes

- 9dd77b4: 停发 `@sfmc-bds/tools`：`fetch-module` 迁入 `@sfmc-bds/cli`，`new-module` 迁入 `@sfmc-bds/devkit`；tools 改为 monorepo private（verify/build bins）。meta 不再依赖 tools。发版后请对已发布 beta 执行：

  `npm deprecate @sfmc-bds/tools@"*" "Moved: use @sfmc-bds/cli (mod install) and @sfmc-bds/devkit (scaffold)."`

- Updated dependencies [9dd77b4]
  - @sfmc-bds/cli@0.2.0-beta.10

## 0.2.0-beta.5

### Patch Changes

- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [5712b87]
- Updated dependencies [89ffceb]
- Updated dependencies [f3ba416]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [ec728dd]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [4fc6ef9]
- Updated dependencies [3c07ced]
- Updated dependencies [89ffceb]
  - @sfmc-bds/bds-tools@0.2.0-beta.9
  - @sfmc-bds/cli@0.2.0-beta.9
  - @sfmc-bds/db-server@0.2.0-beta.5
  - @sfmc-bds/qq-bridge@0.2.0-beta.4
  - @sfmc-bds/sdk@0.2.0-beta.9
  - @sfmc-bds/tools@0.2.0-beta.10

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.6
  - @sfmc-bds/db-server@0.2.0-beta.4
  - @sfmc-bds/sdk@0.2.0-beta.5
  - @sfmc-bds/qq-bridge@0.1.1-beta.3
  - @sfmc-bds/cli@0.2.0-beta.4
  - @sfmc-bds/tools@0.2.0-beta.6

## 0.2.0-beta.3

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.5
  - @sfmc-bds/db-server@0.2.0-beta.3
  - @sfmc-bds/sdk@0.2.0-beta.4
  - @sfmc-bds/qq-bridge@0.1.1-beta.2
  - @sfmc-bds/cli@0.2.0-beta.3
  - @sfmc-bds/tools@0.2.0-beta.5

## 0.2.0-beta.2

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3
  - @sfmc-bds/tools@0.2.0-beta.4
  - @sfmc-bds/bds-tools@0.2.0-beta.4
  - @sfmc-bds/db-server@0.2.0-beta.2
  - @sfmc-bds/qq-bridge@0.1.1-beta.1
  - @sfmc-bds/cli@0.2.0-beta.2

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
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.1
  - @sfmc-bds/db-server@0.2.0-beta.1

## 0.2.0-beta.0

### Minor Changes

- 聚合包依赖对齐平台 0.2 beta；安装说明改为 @beta；SEA 相关说明清理。

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.0
  - @sfmc-bds/cli@0.2.0-beta.0
  - @sfmc-bds/db-server@0.2.0-beta.0
  - @sfmc-bds/qq-bridge@0.1.1-beta.0
  - @sfmc-bds/sdk@0.2.0-beta.0
  - @sfmc-bds/tools@0.2.0-beta.0
