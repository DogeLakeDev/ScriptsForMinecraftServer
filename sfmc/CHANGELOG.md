# @sfmc-bds/cli

## 0.2.0-beta.5

### Minor Changes

- 06e0f19: \# feat/reactor：为CLI命令添加命令界面和帮助文本

  \- 实现了command-surface.ts文件，用于定义CLI命令的规范、通道及可见性规则。

  \- 创建了help-text.ts文件，根据命令在argv和REPL模式下的可见性提供帮助文档。

  \- 引入了pack-update/index.ts文件，封装了包含必要依赖项和日志记录的包更新功能。

  \- 添加了send-target.ts文件，用于在REPL中管理发送目标，包括服务状态和提示符样式。

- c890a95: feat(sfmc-cli): 命令通道分层（external / repl / both）

  - 单一权威 `command-surface`：部署类（install/create/debug 等）仅外部；send / logs -f 仅 REPL
  - help 按通道过滤；dev 类命令蓝色展示（无独立 devmode 开关）
  - 去掉 `devmode` / `runtime.json#developer_mode` 门禁

- c890a95: feat(sfmc/bds-tools): CLI UX 分层、pack-update 迁出、OS 进程探活

  - REPL：`/` + Ctrl+P 命令面板、左右光标、quit 干净退出
  - argv：`sfmc i|install`、`sfmc -p …`；help 按通道标准化
  - pack-update 迁入 `@sfmc-bds/bds-tools/pack-update`（CLI 薄封装）
  - process-probe：外部 BDS 可识别；status 区分 managed/external

- 1f7b2c7: feat(sfmc): 新增 `debug` 顶层命令管理 BDS 调试配置

  - 直接读写 `<BDS>/config/default/variables.json` 与 `secrets.json`
  - 子命令：status / enable / disable / sentry on --dsn <dsn> / sentry off
  - 不修改 SDK 现有 `applyDebugFromVariables()` / `initSentryIfConfigured()` 语义
  - CLI = 配置入口；行为包运行时由 SDK 读取
  - 变更后需 `sfmc mod reload` 或重启 BDS 生效

- 2c91645: feat(sfmc): module build / reload 改走 spawn bds-tools/cli-pack-manager.ts

  - 新增 sfmc/src/module-pack-build.ts：spawn assemble-bp / assemble-rp / deploy / enable-pack / disable-pack / ensure-permission 各 verb
  - dispatchModuleCommand 的 build / reload case 改为 import 此文件
  - pack-lifecycle.ts 保留 ensurePacksReady 启动钩子与 wizard 内部消费
  - 模块 build 唯一权威派发入口收敛（与 install/uninstall/create 同架构：CLI = thin wrapper）

### Patch Changes

- c890a95: feat(bds-tools): 将 pack-update 域逻辑迁入 `@sfmc-bds/bds-tools/pack-update`

  - 新增 `createPackUpdateApi(deps)` 依赖注入入口；版本策略 / CurseForge / 默认配置语义不变
  - sfmc 保留薄封装注入 ROOT、i18n、theme、clack、logs

- Updated dependencies [c890a95]
- Updated dependencies [06e0f19]
- Updated dependencies [c890a95]
  - @sfmc-bds/bds-tools@0.2.0-beta.7

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.6
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.2.0-beta.3

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.5
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.2.0-beta.2

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3
  - @sfmc-bds/bds-tools@0.2.0-beta.4

## 0.2.0-beta.1

### Patch Changes

- a5ccbd3: fix(logs/config): BDS 级别解析 DRY 到 SDK；剥前缀后勿误判 Error；readJson 剥 BOM；log-filter 走 ensureSchemaConfig
- Updated dependencies [a5ccbd3]
  - @sfmc-bds/sdk@0.2.0-beta.1

## 0.2.0-beta.0

### Minor Changes

- 资源包管理强化与批量卸载/回收站；pack-update（CurseForge）；多语言 i18n；log 高亮；`mod` 别名；弃用 SEA；初始化与聚合包路径对齐。

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.0
  - @sfmc-bds/sdk@0.2.0-beta.0
