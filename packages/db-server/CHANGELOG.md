# @sfmc-bds/db-server

## 0.2.0-beta.10

### Patch Changes

- 8d71b80: 为交互式数据库事务增加空闲租约回收，并为事务槽排队增加超时和 `transaction_busy` 错误，防止孤儿事务永久阻塞所有模块。
- Updated dependencies [f616527]
  - @sfmc-bds/sdk@0.2.0-beta.14

## 0.2.0-beta.9

### Patch Changes

- 74a27c7: 将旧版 `!` 聊天前缀命令迁移到 Bedrock 原生自定义命令接口。平台命令统一使用
  `/sfmc:<command>`，模块命令使用 `/sfmc:<moduleId>_<command>`；同时修复内置
  `/sfmc:help` 及其访客权限未注册的问题。

  交互式数据库事务改为互斥排队执行，避免并发 `beginSession` 清理仍在使用的会话。

- 349b070: 将 `TxRunner` 的批量事务与交互式事务会话纳入同一个 SQLite 单连接队列，避免并发备份与查询触发嵌套 `BEGIN` 失败。
- Updated dependencies [74a27c7]
  - @sfmc-bds/sdk@0.2.0-beta.13

## 0.2.0-beta.8

### Patch Changes

- 050da7f: fix: BDS 原生依赖过滤与协商、模块作用域代理及数据库表结构解耦与自愈

  - **bds-tools**: 引入 Bedrock 原生脚本模块白名单机制，过滤 npm 纯数据包；支持自动识别并启用 level.dat 中的 gametest beta 实验性玩法；增强 server.properties 中文本地化与幂等更新。
  - **cli**: 行为包打包期与各模块原生依赖严格协商，协商提升 Bedrock 原生依赖至兼容最高版本；重构 esbuild SDK resolve 插件，为所有包含 `/sapi/` 的业务模块（含跨仓 symlink/junction）自动注入专属作用域虚拟代理，杜绝全局单例状态覆盖与越权。
  - **db-server**: 精简 `initSchema`，移除非底座的业务模块表定义，实现平台核心底座表与业务模组私有表契约解耦；增强 `SchemaRegistry.createPhysical`，自动探测并安全清理历史旧版空表，支持存量表平滑自愈追加缺失列。
  - **sdk**: 优化调试日志门面，显式格式化错误名称、信息与堆栈追踪；确保 SAPI 客户端安全注入请求头；修复 host bootstrap 导出边界以保证 Node 环境引用纯净。

- Updated dependencies [050da7f]
  - @sfmc-bds/sdk@0.2.0-beta.12

## 0.2.0-beta.7

### Patch Changes

- Updated dependencies [e714f86]
  - @sfmc-bds/sdk@0.2.0-beta.11

## 0.2.0-beta.6

### Patch Changes

- Updated dependencies [d9ded8f]
  - @sfmc-bds/sdk@0.2.0-beta.10

## 0.2.0-beta.5

### Minor Changes

- 89ffceb: QQ 入服审批（INTERACTION 回调按钮）+ 群 OpenAPI info/bot_state + 踢人/白名单队列（BDS 由 qq-link 模块经 server-admin 生效）
- 89ffceb: QQ 事件推群（节流）：join/leave/death 约 1 分钟聚合；BDS 启停立即推；配置 `qq_events`；出站复用现有 MC→QQ 通道
- 89ffceb: QQ 官方自定义菜单/指令面板同步、C2C 指令回复、status/online 与 QQ↔MC 绑定平台 API（游戏侧见独立模块 qq-link）
- 89ffceb: 群服互通支持 QQ 开放平台官方 Bot（双后端可切回 LLBot）
- 89ffceb: Enrich GET /api/sfmc/status with host uptime, BDS/db process uptime, and memory/CPU; QQ status command shows the richer summary.

### Patch Changes

- 89ffceb: Linux BDS 宿主：按平台解析可执行文件与下载 URL，启动时设置 LD_LIBRARY_PATH；argv start 在 POSIX 上 daemonize；pgrep 用 -x 避免误匹配
- f3ba416: 游戏聊天互通：MC→QQ 仅转发 `bridge_channel_id` 匹配且非 `qq_` 回环的 messages；QQ 指令「频道」只读提示；扫描 `modules/packages` 时跟随 symlink（修复 `--link` 在 Linux 下被当成非目录）
- 89ffceb: 入服开关落在 configs/qq_link.json；新增只读 treat_group_admins_as_admins（群管视作管理员，仅文件可改）
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [3c07ced]
  - @sfmc-bds/sdk@0.2.0-beta.9

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
