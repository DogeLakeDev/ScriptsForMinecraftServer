# feature-tps 服务

安装 id：`tps` · npm：`@sfmc-bds/module-tps`

纯游戏侧采样，无 DB。

## Service 名

| 名称 | 输出 |
|------|------|
| `tps.current` | `number` |
| `tps.status` | 彩色状态字符串 |

`monitor` 等模块应 `service.get("tps.current")`，不要 import tps 源码。
