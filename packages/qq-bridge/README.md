# @sfmc-bds/qq-bridge

SFMC QQ ↔ MC 桥接，支持双后端：

- **official**（默认）：QQ 开放平台 Gateway，转发群内 @机器人消息
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

## 依赖

- `@sfmc-bds/sdk`
- `ws`
- Node.js >= 22.13

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/packages/qq-bridge>

## 玩家服务交互（第一期）

首页分为「服务器」「我的账号」「入服」「帮助」，管理权限核验成功才显示「管理」。两端保留原有文字命令和斜杠别名，子菜单均可返回首页。官方群内需 @机器人；LLBot 菜单编号只对打开菜单的本人有效，60 秒过期，错误编号不会消费菜单。

- `查服` / `状态` / `/status`：玩家可见的运行、在线与世界摘要；主机与进程信息位于管理员「自检」。
- `版本` / `/version`：优先显示 SFMC CLI 捕获的本次 BDS 启动日志版本。须部署新版 CLI 并重启 BDS 才能产生记录；外部启动、停止运行或启动记录无法核验时，不冒充当前版本。
- `ip` / `地址`：只显示 `qq_config.json` 的公开连接配置，不使用数据库地址或主机名。
- `绑定`：获取验证码后，在游戏内执行 `/c:bind`，随后发送纯数字验证码。
- 解绑、踢人、关闭白名单功能或关闭审批：先显示对象与影响，60 秒内本人确认；取消、新命令或超时后失效。确认时重新核验权限，重复确认不重复提交。
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
