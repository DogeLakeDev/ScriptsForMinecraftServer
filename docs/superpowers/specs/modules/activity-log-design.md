# activity-log — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 全面监听玩家进退服、公屏聊天、方块破坏放置、容器存取、战斗伤害与实体爆炸等关键原生事件；**同时作为全服行为审计中枢，对外提供标准化的事件摄入插槽（`activity.record`）与多维检索插槽（`activity.query`）**，供其他业务模块（如合作社 `coop`、领地 `land` 等）统一异步上报业务治理与安全审计日志，并在管理面板中按需检索；基于内存环形/批处理队列异步聚合落库，并提供基于保留期的自动数据淘汰修剪机制。

**Non-goals:**
- 模块专注底层数据存取服务，不自建复杂的玩家交互 GUI（交互呈现交由调用方领域 GUI 或集中式运维面板消费）
- 杜绝旧版大量重复硬编码的分散事件处理器，采用统一的事件分流与规范化管道

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `activity-log` |
| npm | `@sfmc-bds/module-activity-log` |
| manifest.id | `activity-log` |
| configKey | `activity_log` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

纯后台审计记录，无玩家命令、无表单界面。

## 4. Data

| 表名 | 关键列 / 语义 |
|------|----------------|
| `sfmc_activities` | `id` PK，`timestamp`（Unix ms），`event_type`，`actor_id`，`actor_name`，`target_id`，`dimension`，`x`，`y`，`z`，`level`（info/warn/error），`payload_json`，`created_at` |

对 `(event_type, timestamp)` 与 `(target_id, timestamp)` 建立索引，确保按类型或按目标实体审计追踪的高效性。

## 5. Config

`configs/activity_log.json`：

```json
{
  "retention_days": 30,
  "flush_interval_ms": 2000,
  "batch_size": 100
}
```

未配置时自动采用上述内置默认参数。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `activity.record` | 见下方入参信封 | `{ ok: boolean }` | 统一事件摄入插槽：供其他业务模块上报领域治理/审计日志 |
| `activity.query` | 见下方查询入参 | `{ records: ActivityRecord[], total: number }` | 审计日志检索端点：按目标实体、操作者、事件前缀及时间范围多维检索 |

**`activity.record` input 契约：**

```ts
export interface ActivityRecordInput {
  /** 事件命名空间标识，例如 "coop.create"、"coop.member_kick"、"land.transfer" */
  eventType: string;
  /** 操作者标识（玩家 ID、管理员 ID 或 "system"） */
  actorId?: string;
  /** 操作者名称快照 */
  actorName?: string;
  /** 目标实体标识（例如合作社 cid、领地 landId 或受影响玩家 ID） */
  targetId?: string;
  /** 发生空间位置 */
  dimension?: string;
  x?: number;
  y?: number;
  z?: number;
  /** 严重级别，默认 "info" */
  level?: "info" | "warn" | "error";
  /** 领域扩展详情字典（自动序列化入 payload_json） */
  payload?: Record<string, unknown>;
}
```

**`activity.query` input / output 契约：**

```ts
export interface ActivityQueryParams {
  /** 目标实体标识（例如合作社 cid、领地 landId 或玩家 ID） */
  targetId?: string;
  /** 操作者标识过滤 */
  actorId?: string;
  /** 事件类型前缀过滤，例如 "coop." 或 "land." */
  eventTypePrefix?: string;
  /** 起始时间戳 (Unix ms) */
  from?: number;
  /** 截止时间戳 (Unix ms) */
  to?: number;
  /** 分页拉取条数，默认 20，最大 100 */
  limit?: number;
  /** 分页偏移量，默认 0 */
  offset?: number;
}

export interface ActivityRecord {
  id: number;
  timestamp: number;
  eventType: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  dimension?: string;
  x?: number;
  y?: number;
  z?: number;
  level: "info" | "warn" | "error";
  payload?: Record<string, unknown>;
  createdAt: string;
}
```

### requires

无（作为通用中枢，绝对不反向依赖上游业务模块）。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**（可在启动期完成事件订阅挂载）
- 异步批量写入：原生监听事件与 `activity.record` 摄入事件统一推入内存队列，每 2000ms 或达到 `batch_size` 时批量执行 `db.insert` 刷盘；数据库瞬时不可用时保留队列指数重试；
- 维护调度：每日低峰期自动执行 `DELETE FROM sfmc_activities WHERE timestamp < :cutoff` 批量清理过期日志；`cleanup` 时将内存残留队列同步刷新入库。

## 8. Acceptance criteria

- [ ] 完整覆盖原生进退服、聊天、方块、物品、容器、战斗与爆炸等关键 after-events
- [ ] 真实注册并对外暴露 `activity.record` 摄入与 `activity.query` 检索插槽，外部模块可成功上报并分页检索
- [ ] 批量入库机制稳定，不阻断主线程游戏刻运行
- [ ] 过期数据自动淘汰清理机制生效
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 官方集中式 Web 审计大屏与深度统计分析报表

## 10. Legacy reference（仅参考）

- `packages/activity-log/`
