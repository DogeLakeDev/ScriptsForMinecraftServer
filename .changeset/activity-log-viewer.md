---
"@sfmc-bds/db-server": minor
"@sfmc-bds/management": minor
"@sfmc-bds/cli": minor
---

桌面端和小程序可以查看行为日志模块（activity-log）的记录。管理协议新增 `activity.query`（按事件类型、分类、玩家、维度、级别、时间范围和关键词筛选，分页返回）和 `activity.stats`（记录数、活跃玩家、事件与级别分布），握手带 `activity` 能力时可用。平台以只读方式打开业务库查询，不需要重启后台进程；模块未安装时结果的 `installed` 为 false。db-server 新增导出 `@sfmc-bds/db-server/activity-log`，以及微信玩家查看本人记录的接口 `GET /api/sfmc/wechat/activity`，执行者固定为该微信绑定的游戏账号。
