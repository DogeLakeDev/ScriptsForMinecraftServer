# daily-task — Design Spec

> **Status:** deferred  
> **Spec authority:** this file（搁置）。依赖的经济侧任务 API 已从 [economy-design.md](./economy-design.md) 移除。

## 1. Goal / Non-goals

**Goal（未来）：** 玩家侧每日任务 UI，调用**独立任务域**服务完成列表/提交；奖励经 `economy.account.credit`。

**当前决定（2026-09-04）：**

- **暂不实现**本模块；不进入开仓波次 C 的并行实现
- economy **不再**提供 `economy.dailyTasks.list` / `submit`
- 旧 archive 中「任务表挂在经济库」方案废弃

**Non-goals（现在）：** 不开仓、不发布 npm、不写 index 登记。

## 2. Identity（预留，实现时再用）

| 字段 | 值 |
|------|-----|
| install id | `daily-task` |
| npm | `@sfmc-bds/module-daily-task` |
| manifest.id | `daily-task` |
| configKey | `daily_task` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["economy"]`（仅账户 credit；任务数据自有或未来 `tasks` 模块） |

## 3–8. Player / Data / Config / Services / Lifecycle / Acceptance

**搁置。** 重新激活前须另开设计修订：明确任务权威存储（自有表 vs 新模块），再写完整章节与验收项。

## 9. Deferred

- 本模块整体
- 任务生成调度、管理 GUI

## 10. Legacy reference（仅参考）

- `packages/daily-task/`（旧：编排 `economy.dailyTasks.*`）
