# feature-online-time 服务

安装 id：`online-time` · npm：`@sfmc-bds/module-online-time`

## Service 名

| 名称 | 输入 | 输出 |
|------|------|------|
| `onlinetime.byPlayer` | `playerId` | 在线时长对象（本次/今日/本月/累计等） |

模块自有表 `player_onlinetime`，不再写入平台 `sfmc_players` 的在线列。
