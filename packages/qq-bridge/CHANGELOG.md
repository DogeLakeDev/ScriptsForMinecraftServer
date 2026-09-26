# @sfmc-bds/qq-bridge

## 0.2.0-beta.13

### Minor Changes

- efa6e73: 官方 QQ 机器人可选择 Webhook 接收事件；官方与 LLBot 配置改为分组对象。Webhook 模式自动跳过游戏机的桥进程，并安全同步共享配置到云端。群全量事件中的 `<@…>` 机器人提及也能正确触发指令面板命令。官方回复不再附带 LLBot 风格的编号和“发送：”列表。
- 4a9b066: 统一 QQ 双后端玩家服务菜单、权限核验、敏感操作确认及错误反馈，修复编号菜单与长名单发送，保留查服、版本和 ip 指令习惯。

  新增 public_server 公开连接配置；版本优先使用 CLI 捕获并经状态接口核验的当前 BDS 启动版本。移除在线状态接口的 64 人上限，不改变入服业务状态与审批策略。

### Patch Changes

- aadd2de: Use each chat channel's prefix and QQ forwarding switch for MC messages. Route QQ group messages into the read-only game channel and remove the former bridge channel and MC prefix configuration fields.
- efa6e73: 优化 QQ 玩家菜单和信息卡：简化标题与说明，移除 Markdown 正文中重复的按钮列表，统一操作名称并增加状态刷新入口，保留原有命令和纯文本编号操作。
- efa6e73: 修正官方群指令面板同步：全局面板不再请求关联群，指定群面板仅在缺少目标群时追加关联。
- efa6e73: QQ 查服改用游戏实时在线玩家及世界信息，CLI 托管的 BDS 启停和异常退出现在上报事件。
- efa6e73: 官方 QQ 机器人接收群全量消息时，可直接识别无需 @ 的指令，并避免与群 @ 事件重复处理。
- 3465c7e: 更新 QQ 账号和服务器信息面板、频道来源控制及模块和世界包查询；移除 QQ 踢人指令，完善 CLI 服务窗口提示与模块配置行为。
- efa6e73: 为 QQ 管理菜单增加可即时生效的服务器事件推送开关，并补充 BDS 正常停服通知。
- Updated dependencies [4a9b066]
- Updated dependencies [aadd2de]
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
  - @sfmc-bds/sdk@0.2.0-beta.18

## 0.2.0-beta.12

### Patch Changes

- Updated dependencies [5a4eff6]
- Updated dependencies [16bba29]
- Updated dependencies [12b7dfc]
- Updated dependencies [cf3293f]
  - @sfmc-bds/sdk@0.2.0-beta.17

## 0.2.0-beta.11

### Patch Changes

- Updated dependencies [f312e8b]
  - @sfmc-bds/sdk@0.2.0-beta.16

## 0.2.0-beta.10

### Patch Changes

- Updated dependencies [ea1e57e]
  - @sfmc-bds/sdk@0.2.0-beta.15

## 0.2.0-beta.9

### Patch Changes

- Updated dependencies [f616527]
  - @sfmc-bds/sdk@0.2.0-beta.14

## 0.2.0-beta.8

### Patch Changes

- Updated dependencies [74a27c7]
  - @sfmc-bds/sdk@0.2.0-beta.13

## 0.2.0-beta.7

### Patch Changes

- Updated dependencies [050da7f]
  - @sfmc-bds/sdk@0.2.0-beta.12

## 0.2.0-beta.6

### Patch Changes

- Updated dependencies [e714f86]
  - @sfmc-bds/sdk@0.2.0-beta.11

## 0.2.0-beta.5

### Patch Changes

- Updated dependencies [d9ded8f]
  - @sfmc-bds/sdk@0.2.0-beta.10

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
