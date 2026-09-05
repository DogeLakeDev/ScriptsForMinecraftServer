# monitor — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 作为服务器性能与运行健康中枢：
1. 高频（逐 tick）内存环形采样服务端每秒游戏刻数（TPS），向全服玩家与控制台提供实时刻速查询指令 `!tps`，并对外暴露标准化的 TPS 状态服务；
2. 周期性（如每 30 秒）采集服务端宏观负载：统计主世界、下界与末地各维度的活跃实体数量，估算在线玩家视距覆盖的区块负载；
3. 提供管理员综合性能查询命令 `!monitor`，并将多维指标批量持久化至监控时序表，为服务器性能分析与瓶颈诊断提供基础数据。

**Non-goals:**
- 首版不构建复杂的 Web 前端图表大屏（数据沉淀至 SQLite 供运维与拓展分析）
- 不做卡顿实体的自动清理干预（卡顿清理职责解耦并归属于 `clean` 模块）
- 不引入重型第三方监控探针，完全基于原生 SAPI 与本地数据服务

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `monitor` |
| npm | `@sfmc-bds/module-monitor` |
| manifest.id | `monitor` |
| configKey | `monitor` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `tps` | `tps.see` | Any | 向执行玩家（或控制台）输出当前服务端 TPS 运行状况（带健康色阶） |
| `monitor` | `monitor.admin` | Admin | 向管理员输出当前服务器综合负载（TPS、各维度活跃实体数、在线玩家区块总负载估算） |

## 4. Data

- **纯内存环形缓冲区**：容量为 100 的环形采样缓冲（逐 tick 记录墙钟毫秒戳），提供微秒级无锁的实时 TPS 计算，冷启动未满时保底 20.00。
- **持久化监控表**：

| 表名 | 关键列 |
|------|--------|
| `sfmc_monitor_metrics` | `id` PK，`recorded_at`（Unix ms），`tps`（REAL），`dimension`（TEXT），`entity_count`（INT） |
| `sfmc_monitor_player_chunks` | `id` PK，`player_id`，`player_name`，`dimension`，`pos_x`，`pos_y`，`pos_z`，`render_distance`，`chunk_estimate`，`updated_at` |

## 5. Config

`configs/monitor.json`：

```json
{
  "sample_interval_ticks": 600,
  "history_retention_hours": 72
}
```

默认周期采样与持久化间隔为 600 ticks（约 30 秒），历史时序数据保留 72 小时。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `tps.current` | `{}` | `number` | 当前实时 TPS 浮点值，保留 2 位小数，区间 `[0.00, 20.00]` |
| `tps.status` | `{}` | `{ text: string, tps: number, grade: "green"\|"yellow"\|"gold"\|"red" }` | `text` 为带色阶串（供聊天）；`grade` 供 gui/监控结构化渲染 |
| `monitor.metrics` | `{}` | `{ tps: number, grade: string, entities: Record<string, number>, totalLoadedChunks: number }` | 当前全服综合性能快照，供管理后台或跨模块消费 |

### requires

无（零外部依赖，作为平台底层基石监控能力）。

### 采样规则与健康色阶

- **采样机制**：依托 `system.runInterval` 逐 tick 记录墙钟时间戳，维护容量为 100 的环形采样缓冲区；冷启动采样未满时默认返回 20.00；
- **健康色阶定义**：
  - 优秀（$\ge 19.5$）：`green`（聊天颜色 `§a`）
  - 正常（$\ge 15.0$）：`yellow`（聊天颜色 `§e`）
  - 负载（$\ge 10.0$）：`gold`（聊天颜色 `§6`）
  - 卡顿（$< 10.0$）：`red`（聊天颜色 `§c`）

## 7. Lifecycle notes

- `afterWorldLoad`: **true**（维度实体分布与玩家视距区块估算需在世界加载后执行；内存 TPS 环形采样可在 `init` 提前启动，`cleanup` 时注销计时器句柄）
- **后台采集管道**：
  1. 实时流水线：逐 tick 采样时钟增量更新环形缓冲；
  2. 周期流水线（`sample_interval_ticks`）：读取实时 TPS $\rightarrow$ 遍历各维度计算实体总数 $\rightarrow$ 统计玩家所在区块与视距估算 $\rightarrow$ 在本地 `db.tx` 批量事务写入快照。

## 8. Acceptance criteria

- [ ] `!tps` / `！tps` 任意玩家可用，输出带色阶的刻速
- [ ] `!monitor` / `！monitor` OP 玩家可用，输出综合性能大盘
- [ ] 对外稳定提供 `tps.current`、`tps.status`、`monitor.metrics` 服务，向后完全兼容已有调用契约
- [ ] 零外部依赖（`manifest.requires: []`）
- [ ] 多维度实体计数与玩家区块负载采样准确，持续批量落库
- [ ] 数据库表名统一规范为 `sfmc_monitor_*`
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 前端图表可视化 / 导出 CSV
- 异常掉刻告警推送（如配合 `qq-bridge` 或群推送）

## 10. Legacy reference（仅参考）

- `packages/monitor/`
- `packages/tps/`
