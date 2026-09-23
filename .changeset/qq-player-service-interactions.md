---
"@sfmc-bds/qq-bridge": minor
"@sfmc-bds/db-server": patch
"@sfmc-bds/cli": patch
"@sfmc-bds/sdk": minor
---

统一 QQ 双后端玩家服务菜单、权限核验、敏感操作确认及错误反馈，修复编号菜单与长名单发送，保留查服、版本和 ip 指令习惯。

新增 public_server 公开连接配置；版本优先使用 CLI 捕获并经状态接口核验的当前 BDS 启动版本。移除在线状态接口的 64 人上限，不改变入服业务状态与审批策略。
