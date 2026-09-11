# @sfmc-bds/bds-tools

## 0.2.0-beta.16

### Patch Changes

- Updated dependencies [f312e8b]
  - @sfmc-bds/sdk@0.2.0-beta.16

## 0.2.0-beta.15

### Patch Changes

- Updated dependencies [ea1e57e]
  - @sfmc-bds/sdk@0.2.0-beta.15

## 0.2.0-beta.14

### Minor Changes

- cc6a12b: feat(bds-tools,cli): 增强 packs doctor 存档实验性玩法开关诊断与自愈配置

  - `@sfmc-bds/bds-tools`: 支持检测与修改当前版本已知的全部实验性功能（测试版 API、创作者功能、创作者相机、Voxel形状、村民贸易再平衡、2026年第3次更新、Minecraft Education 功能），提供智能别名解析与安全的原子化 level.dat 修改与灾备。
  - `@sfmc-bds/cli`: `packs doctor` 命令支持 `--experiments`、`--all-experiments`、`--experiments=<list>` 开关；在诊断视图中高亮直观展示当前存档的各实验性玩法启用状态。

### Patch Changes

- Updated dependencies [f616527]
  - @sfmc-bds/sdk@0.2.0-beta.14

## 0.2.0-beta.13

### Patch Changes

- Updated dependencies [74a27c7]
  - @sfmc-bds/sdk@0.2.0-beta.13

## 0.2.0-beta.12

### Patch Changes

- 050da7f: fix: BDS 原生依赖过滤与协商、模块作用域代理及数据库表结构解耦与自愈

  - **bds-tools**: 引入 Bedrock 原生脚本模块白名单机制，过滤 npm 纯数据包；支持自动识别并启用 level.dat 中的 gametest beta 实验性玩法；增强 server.properties 中文本地化与幂等更新。
  - **cli**: 行为包打包期与各模块原生依赖严格协商，协商提升 Bedrock 原生依赖至兼容最高版本；重构 esbuild SDK resolve 插件，为所有包含 `/sapi/` 的业务模块（含跨仓 symlink/junction）自动注入专属作用域虚拟代理，杜绝全局单例状态覆盖与越权。
  - **db-server**: 精简 `initSchema`，移除非底座的业务模块表定义，实现平台核心底座表与业务模组私有表契约解耦；增强 `SchemaRegistry.createPhysical`，自动探测并安全清理历史旧版空表，支持存量表平滑自愈追加缺失列。
  - **sdk**: 优化调试日志门面，显式格式化错误名称、信息与堆栈追踪；确保 SAPI 客户端安全注入请求头；修复 host bootstrap 导出边界以保证 Node 环境引用纯净。

- Updated dependencies [050da7f]
  - @sfmc-bds/sdk@0.2.0-beta.12

## 0.2.0-beta.11

### Patch Changes

- Updated dependencies [e714f86]
  - @sfmc-bds/sdk@0.2.0-beta.11

## 0.2.0-beta.10

### Patch Changes

- Updated dependencies [d9ded8f]
  - @sfmc-bds/sdk@0.2.0-beta.10

## 0.2.0-beta.9

### Minor Changes

- 89ffceb: Linux BDS 宿主：按平台解析可执行文件与下载 URL，启动时设置 LD_LIBRARY_PATH；argv start 在 POSIX 上 daemonize；pgrep 用 -x 避免误匹配
- 89ffceb: QQ 事件推群（节流）：join/leave/death 约 1 分钟聚合；BDS 启停立即推；配置 `qq_events`；出站复用现有 MC→QQ 通道

### Patch Changes

- f3ba416: 游戏聊天互通：MC→QQ 仅转发 `bridge_channel_id` 匹配且非 `qq_` 回环的 messages；QQ 指令「频道」只读提示；扫描 `modules/packages` 时跟随 symlink（修复 `--link` 在 Linux 下被当成非目录）
- 89ffceb: 群服互通支持 QQ 开放平台官方 Bot（双后端可切回 LLBot）
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [3c07ced]
  - @sfmc-bds/sdk@0.2.0-beta.9

## 0.2.0-beta.8

### Minor Changes

- 8552772: chore: 删除已无仓内调用的公开兼容导出

  破坏性（外部若仍 import 需改用替代）：

  - `@sfmc-bds/cli`：移除 `serviceStatus`（用 `queryServicesRuntime`）、`HELP`（用 `getHelp`）、
    `resolveDefaultsDir` / `seedMissingConfigsFromDefaults`、`CommandChannel: "external"` /
    `PaletteEntry` / `listPaletteEntries` 等遗留表面。
  - `@sfmc-bds/bds-tools`：移除已不抛出的 `Utf8BomError` 类及 re-export（读 JSON 仍自动剥 BOM）。

### Patch Changes

- Updated dependencies [8552772]
- Updated dependencies [e175ed9]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
  - @sfmc-bds/sdk@0.2.0-beta.8

## 0.2.0-beta.7

### Minor Changes

- c890a95: feat(bds-tools): 将 pack-update 域逻辑迁入 `@sfmc-bds/bds-tools/pack-update`

  - 新增 `createPackUpdateApi(deps)` 依赖注入入口；版本策略 / CurseForge / 默认配置语义不变
  - sfmc 保留薄封装注入 ROOT、i18n、theme、clack、logs

- 06e0f19: \# feat/reactor：为CLI命令添加命令界面和帮助文本

  \- 实现了command-surface.ts文件，用于定义CLI命令的规范、通道及可见性规则。

  \- 创建了help-text.ts文件，根据命令在argv和REPL模式下的可见性提供帮助文档。

  \- 引入了pack-update/index.ts文件，封装了包含必要依赖项和日志记录的包更新功能。

  \- 添加了send-target.ts文件，用于在REPL中管理发送目标，包括服务状态和提示符样式。

- c890a95: feat(sfmc/bds-tools): CLI UX 分层、pack-update 迁出、OS 进程探活

  - REPL：`/` + Ctrl+P 命令面板、左右光标、quit 干净退出
  - argv：`sfmc i|install`、`sfmc -p …`；help 按通道标准化
  - pack-update 迁入 `@sfmc-bds/bds-tools/pack-update`（CLI 薄封装）
  - process-probe：外部 BDS 可识别；status 区分 managed/external

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
