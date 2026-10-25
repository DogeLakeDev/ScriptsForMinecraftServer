---
"@sfmc-bds/db-server": minor
"@sfmc-bds/management": minor
"@sfmc-bds/cli": minor
"@sfmc-bds/sdk": minor
---

桌面端和小程序可以查看与编辑计分板。管理协议新增 `scoreboard.read`（全部计分项、参与者分数与显示位，可用 `after` 等待编辑后的新快照）和 `scoreboard.apply`（新建 / 删除计分项，设为 / 增加 / 减少 / 重置分数），握手带 `scoreboard` 能力时可用。读取来自 SDK 运行时同步到数据服务的快照：只在有人查看时上报，未变化时只发哈希；修改经 BDS 控制台的 `scoreboard` 命令下发，参数校验与命令生成在协议包的 `scoreboardOperationError` / `scoreboardCommand` 中。控制台命令无法定位离线玩家与实体，这两类参与者只读（`scoreboardTargetBlock` 给出原因）。db-server 新增 `POST /api/sfmc/scoreboard/live`（游戏内脚本上报）与 `GET /api/sfmc/scoreboard`，以及导出 `@sfmc-bds/db-server/scoreboard`。
