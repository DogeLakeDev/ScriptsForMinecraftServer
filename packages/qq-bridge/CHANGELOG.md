# @sfmc-bds/qq-bridge

## 0.2.0-beta.4

### Minor Changes

- 89ffceb: QQ 入服审批（INTERACTION 回调按钮）+ 群 OpenAPI info/bot_state + 踢人/白名单队列（BDS 由 qq-link 模块经 server-admin 生效）
- 89ffceb: QQ 侧指令菜单（official Markdown/键盘与 llbot 编号菜单共用注册表）
- 89ffceb: QQ 官方自定义菜单/指令面板同步、C2C 指令回复、status/online 与 QQ↔MC 绑定平台 API（游戏侧见独立模块 qq-link）
- 89ffceb: 群服互通支持 QQ 开放平台官方 Bot（双后端可切回 LLBot）

### Patch Changes

- 89ffceb: llbot 指令回复优先经 reverse-WS 发 send_group_msg，避免未开 HTTP 3004 时 ECONNREFUSED
- 5712b87: QQ 主菜单收拢常用指令；踢人/待审/配置等收入「管理」子菜单（触发词仍可直达）
- f3ba416: 游戏聊天互通：MC→QQ 仅转发 `bridge_channel_id` 匹配且非 `qq_` 回环的 messages；QQ 指令「频道」只读提示；扫描 `modules/packages` 时跟随 symlink（修复 `--link` 在 Linux 下被当成非目录）
- 89ffceb: 入服开关落在 configs/qq_link.json；新增只读 treat_group_admins_as_admins（群管视作管理员，仅文件可改）
- ec728dd: CLI 对外部 db/qq 真正 stop/restart（按入口脚本杀进程，避免双实例）；QQ 主/管理菜单中文编号样式（official+llbot 共用）；频道/自检增强
- 89ffceb: Enrich GET /api/sfmc/status with host uptime, BDS/db process uptime, and memory/CPU; QQ status command shows the richer summary.
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [3c07ced]
  - @sfmc-bds/sdk@0.2.0-beta.9

## 0.1.1-beta.3

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.1.1-beta.2

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.1.1-beta.1

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3

## 0.1.1-beta.0

### Patch Changes

- 统一服务文件日志与配置/构建链路；无 QQ 协议级功能变更。
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.0
