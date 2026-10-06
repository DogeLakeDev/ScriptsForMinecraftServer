# 平台运行监控

运行监控由 SDK 行为包宿主在世界加载后自动启动，不依赖 `monitor` 或 `qq-link` 模块。桌面总览和其他模块共享同一份采样。

## 采集与口径

- TPS：每 tick 记录墙钟毫秒，使用最近 100 个采样点计算速率并限制在 0–20。冷启动或时钟回退时显示未知；它不是 MSPT。
- 在线玩家：通过 SAPI `world.getAllPlayers()` 采集，同时向现有状态接口提供玩家与世界快照。
- 实体数量：约每 30 秒查询三个维度中的可访问实体，查询失败返回 `null`，并保留采集时间。
- 视距区块估算：累加玩家客户端视距对应的面积，不扣除玩家间重叠，不代表真实已加载区块数量。
- 主机内存、进程内存和累计 CPU 秒数：由数据服务读取宿主系统。进程资源只认当前实例的 BDS PID；权限不足或无法确认归属时返回未知。累计 CPU 时间不能按百分比展示。主机已用内存、BDS 和数据服务内存会另外记入最近一小时，供曲线使用。

正常速度下，每 100 tick 上报一次指标。低 TPS 时墙钟上报间隔会变长；桌面不会补造中间点。

## 查询入口

SDK 的 `@sfmc-bds/sdk/sapi/runtime` 导出 `getRuntimeMetrics()` 和 `getRuntimeTpsStatus()`，允许模块直接读取平台采样。初始化前快照为 `undefined`，TPS 为 `null`。不要修改返回值来控制采集。

管理协议握手新增 `metrics` 能力。支持该能力时，`metrics.read` 返回 `current`、`history`、`fresh`、`updatedAt`、`host`、`processes`、`resourcesUpdatedAt` 和 `resourceHistory`。旧平台缺少能力时，客户端展示升级提示；旧数据服务没有 `resourceHistory` 时，桌面只保留本次打开后的内存采样。

数据服务提供以下入口：

| 入口                          | 用途                                               |
| ----------------------------- | -------------------------------------------------- |
| `POST /api/sfmc/metrics/live` | SDK 平台上报；沿用平台通道鉴权，校验值域与玩家计数 |
| `GET /api/sfmc/metrics`       | 读取当前指标、最近一小时历史与宿主资源             |
| `GET /api/sfmc/status`        | 兼容既有玩家与世界状态消费者                       |

指标保存在业务数据库同目录的 `runtime-metrics.sqlite` 中，避免加入模块的跨请求事务。默认保留 72 小时且最多 60000 条；单次历史读取最多 720 点。客户端断开、数据过期、游戏重启和采样中断时，当前值显示未知，图表按启动标识和时间间隔分段。

## monitor 弃用与兼容

`monitor` 已收编至平台。新行为包构建、SDK 生命周期和模块更新跳过旧模块；CLI 不再允许安装、启用或更新，桌面与模块索引移除安装入口。无需手动删除旧包目录、`monitor.json`、启用记录或 `sfmc_monitor_*` 历史表。

平台保留 `/c:status`（高级管理员权限）、`tps.current`、`tps.status` 和 `monitor.metrics`。跨模块服务仍要求有效调用方及 `services.requires` 声明。既有 `requires: ["monitor"]` 视为已由平台满足，不能让任意模块声明 `_platform` 身份或抢占平台服务。

`monitor.metrics.totalLoadedChunks` 是为旧消费者保留的估算别名，新消费者应使用 `chunkEstimate`。采样不可用时兼容服务返回 `null` 或 `grade: "unknown"`，不伪报 20 TPS。旧历史留在原库，新历史不会自动覆盖或改写旧表。

更新 SDK 后必须重建并部署平台行为包，才能启用游戏内的采集；仅构建桌面客户端不会更新正在运行的 BDS。
