# @sfmc-bds/qq-bridge

SFMC QQ ↔ MC 桥接，支持双后端：

- **official**（默认）：QQ 开放平台 WebSocket Gateway 或 Webhook；开启「接收所有消息」后，群内指令无需 @，普通聊天仍需 @ 才转发游戏
- **llbot**：LLBot OneBot 11 reverse-WS（端口 3002）

消息统一 POST 到 db-server `/api/sfmc/messages`。MC→QQ 出站由 db-server 按同一 `qq_backend` 处理。

QQ 侧指令（`菜单` / `ping` / `whoami`）在桥内拦截，不依赖 MC；official 用 Markdown+键盘，llbot 用编号菜单。

配置见 `configs/qq_config.json` 与文档 [QQ 互通](../../docs/zh/guide/qq-bridge.md)。

## 安装

```bash
npm install @sfmc-bds/qq-bridge
node node_modules/@sfmc-bds/qq-bridge/dist/index.js
```

通常由 `@sfmc-bds/sfmc` / `@sfmc-bds/cli` 统一拉起。

## 官方机器人 Webhook 云端部署

Webhook 模式只改变 QQ→桥的事件接收。MC→QQ 仍由游戏机上的 db-server 调用 QQ OpenAPI。云端仅运行 `qq-bridge`，不需要复制游戏世界或数据库。

游戏机 `configs/qq_config.json` 中设置 `qq_backend: "official"`、`qq_enabled: true` 和 `official.transport: "webhook"`。官方凭据、目标群、管理员及回调参数集中放在 `official` 对象；LLBot 参数集中放在 `llbot` 对象。CLI 看到 Webhook 模式后跳过游戏机上的 QQ 桥进程，保留 db-server 与 BDS。

```json
{
  "qq_enabled": true,
  "qq_backend": "official",
  "official": {
    "transport": "webhook",
    "app_id": "填入 AppID",
    "app_secret": "填入 AppSecret",
    "group_openid": "填入目标群 OpenID",
    "admin_openids": [],
    "webhook": { "port": 3005, "path": "/qqbot/webhook" }
  },
  "llbot": { "enabled": false }
}
```

`deploy/qq-config-sync.ps1` 在游戏机登录后持续检查配置。仅当 `official.transport` 为 `webhook` 时，它经 SSH 标准输入同步官方凭据、目标群、管理员、频道和公开服务器信息；云端保留自己的 Webhook 监听、隧道端口与面板 ID。切回 `websocket` 或禁用 QQ 时，同步任务停止云端桥；切换接收方式后还需重启游戏机上的 SFMC CLI，并在 QQ 开放平台修改消息接收方式。同步失败时云端保留上一版配置。

当前阿里云部署使用 SSH 别名 `aliyun`、云端同步程序 `/opt/sfmc-qq-bridge/deploy/sync-qq-config.mjs`，游戏机任务名为 `SFMC QQ Config Sync`。同步任务登录后启动，每 30 秒检查一次；游戏机重启后需先登录该用户。日志在运行目录的 `qq-config-sync.log`，只记录状态。回调端口与路径在此部署中固定为 `3005` 和 `/qqbot/webhook`；修改这两个值须同步调整 Nginx 和 QQ 开放平台回调地址。

Webhook 进程仅监听云机 `127.0.0.1:3005`。用同机 HTTPS 反向代理把 `https://你的域名/qqbot/webhook` 转给它，然后在 QQ 开放平台「消息接收方式」选择 HTTP 回调，填写同一 URL。回调先完成平台 `op:13` 地址验证，正式事件再校验签名；反向代理须保留请求体原始字节与 `X-Bot-Appid`、`X-Signature-Timestamp`、`X-Signature-Ed25519` 请求头。

云端桥需要访问游戏机 db-server 的多个本地 API。db-server 固定只监听游戏机 `127.0.0.1:3001`，不要开放其端口。可由游戏机主动维持 SSH 反向隧道，将云机 `127.0.0.1:13001` 转发到游戏机 `127.0.0.1:3001`；云端配置 `db_host: "127.0.0.1"`、`db_port: 13001`。隧道应在游戏服务运行期间自动重连，并确保只有云机本地进程可访问转发端口；若使用登录时启动的计划任务，重启游戏机后需先登录该用户。

回调成功接收后会尽快确认，事件在单进程内按序处理并限制待处理数量。当前待处理队列位于内存中，进程在确认后立即崩溃时，尚未处理的事件可能丢失；如需跨进程故障恢复，应再增加持久化队列。

## 依赖

- `@sfmc-bds/sdk`
- `ws`
- Node.js >= 22.13

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/packages/qq-bridge>

## 玩家服务交互（第一期）

首页分为「服务器」「我的账号」「入服」「帮助」，管理权限核验成功才显示「管理」。两端保留原有文字命令和斜杠别名，子菜单均可返回首页。官方机器人开启「接收所有消息」后，群内可直接发送指令；未开启时仍需 @机器人。LLBot 菜单编号只对打开菜单的本人有效，60 秒过期，错误编号不会消费菜单。

- `查服` / `状态` / `/status`：玩家可见的运行、在线与世界摘要；主机与进程信息位于管理员「自检」。
- `版本` / `/version`：优先显示 SFMC CLI 捕获的本次 BDS 启动日志版本。须部署新版 CLI 并重启 BDS 才能产生记录；外部启动、停止运行或启动记录无法核验时，不冒充当前版本。
- `ip` / `地址`：只显示 `qq_config.json` 的公开连接配置，不使用数据库地址或主机名。
- `绑定`：获取验证码后，在游戏内执行 `/c:bind`，随后发送纯数字验证码。
- 解绑、踢人、关闭白名单功能或关闭审批：先显示对象与影响，60 秒内本人确认；取消、新命令或超时后失效。确认时重新核验权限，重复确认不重复提交。
- 管理员在「管理 → 事件推送」中可切换事件总开关、BDS 启停与异常退出、玩家进出和死亡通知，并设置 5–600 秒的聚合间隔；关闭总开关需本人确认。设置写入 `configs/qq_config.json` 并用于后续推送。
- 在线名单自动连续分段。官方富文本发送失败时，降级文本保留可直接发送的完整命令。

公开信息配置示例（域名仅为占位，请填写自己的公开地址）：

```json
{
  "public_server": {
    "address": "play.example.com",
    "port": 19132,
    "version": ""
  }
}
```

`version` 是无法获取实际版本时的备用入服说明，回复会明确标注来源；留空时提示联系管理员。修改后重启 QQ 桥接服务。权限仍由 db-server 最终校验，群管理员是否具有管理权限取决于现有 `treat_group_admins_as_admins` 设置；查询失败时隐藏受限入口。

本期不改变入服规则。申请提交、审核通过和 BDS 写入白名单分别提示，不将审核通过视作已生效。下一阶段再完善自助入服进度和玩家数据服务。


### 本次验证记录（2026-09-23）

- QQ 桥接、db-server、CLI 与 SDK 类型检查通过；前三个包构建通过，SDK 配置入口与类型产物已更新。
- 基于构建产物的 73 项本地模拟检查通过：菜单排版与权限、数字会话、确认取消/过期/重复/角色变化、错误拦截、版本与公开地址、120 人名单、UTF-8 分段、官方 Markdown 失败降级、LLBot HTTP 连续发送、旧按钮回调与 BDS 版本记录核验。
- HTTP/QQ 发送均使用本地模拟服务或替代实现；没有向真实群发送测试消息。临时验证脚本已清理。
- 尚未部署到运行目录，未重启实际 BDS，真实官方 QQ 与 LLBot 客户端联调待完成。公开地址需要填写 `public_server`；实际版本需要新版 CLI 捕获一次 BDS 启动日志。
