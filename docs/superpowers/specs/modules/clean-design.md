# clean — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 构建全服与区域无主掉落物自动巡检与回收清理模块。挂接在 `area` 空间引擎上支持针对特定区域（如主城、公共广场、刷怪重灾区）定制掉落物清理策略，同时提供全服掉落物阈值防卡服预警、全服倒计时广播通知、定向将可回收物品存入指定公共回收箱（Recycle Bin）以及特指有害实体（如过量经验球、失控矿车）安全销毁；对外提供 OP 运维手动清理指令（`!clean`）与可远程调度的清理服务。

**Non-goals:**
- 不自建独立的空间边界几何判定，特定区域清理依赖上游 `area` 空间插槽
- 首版不构建面向普通玩家的拾遗找回 GUI 竞价系统
- 严禁向外部导出内部领域类，所有跨模块通信经由标准化 service 调度

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `clean` |
| npm | `@sfmc-bds/module-clean` |
| manifest.id | `clean` |
| configKey | `clean` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["area"]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `clean` | `clean.admin` | OP (3) | 手动触发全服或指定区域掉落物扫描、倒计时广播与清理回收流程 |

## 4. Data

纯内存维护定时任务与预警状态机，无数据库持久化表。

## 5. Config

`configs/clean.json`：

```json
{
  "poll_interval_seconds": 60,
  "item_threshold_warning": 200,
  "countdown_seconds": 10,
  "kill_list": [
    "minecraft:xp_orb",
    "minecraft:tnt"
  ],
  "recycle_bin": {
    "enabled": true,
    "dimension": "minecraft:overworld",
    "container_coords": [0, 64, 0],
    "max_slots": 54
  }
}
```

- `poll_interval_seconds`：全服掉落物例行检查周期（默认 60 秒）；
- `item_threshold_warning`：掉落物堆叠数量预警阈值，超过则触发自动清理倒计时；
- `countdown_seconds`：清理执行前的全服广播倒计时（默认 10 秒）；
- `kill_list`：直接物理销毁而不存入回收箱的实体 ID 列表（如经验球、引爆物）；
- `recycle_bin`：公共回收箱配置，可将地面积压的有价值物品移入指定物理箱子容器供玩家取用。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `clean.trigger` | `{ force?: boolean, areaName?: string }` | `{ ok: boolean, cleanedCount: number }` | 供运维控制台或监控警报（monitor）远程调度执行清理 |

### requires

| name | 来自 | 用途 |
|------|------|------|
| `area.registerFeature` | [area-design.md](./area-design.md) | 向底层空间引擎注册 `clean` 特性生命周期处理器 |
| `area.byName`（可选） | 同上 | 获取特定目标区域空间范围以执行局域清理 |

## 7. Lifecycle notes

- `afterWorldLoad`: **true**
- `registerCommands`：注册 `!clean` 命令（校验 OP 权限，支持手动触发全局或指定区域掉落物扫描回收）；
- `registerEvents`：调用 `area.registerFeature` 挂接 `clean` 空间特性生命周期处理器；
- `init`：
  - **`onTick(ctx, params)`**：若区域声明了 `features.clean`，根据区域私有阈值独立扫描并清理该区域内的过量掉落物；
  - **全服轮询扫描**：在世界加载完成后启动周期定时任务：
    1. 统计当前加载区块内的掉落物（`minecraft:item`）总量；
    2. 若超过 `item_threshold_warning`，广播倒计时提示全服玩家拾取地表贵重物品；
    3. 倒计时结束后，对处于 `kill_list` 中的实体调用 `kill()` 销毁；对常规物品实体尝试移入 `recycle_bin` 容器，溢出部分安全清除；
    4. 播发清理完成公告，报告清理掉落物总数。

## 8. Acceptance criteria

- [ ] 成功调用 `area.registerFeature` 挂接 `clean` 特性
- [ ] `!clean` 指令具备 OP 权限校验，执行后正确广播倒计时并回收掉落物
- [ ] 掉落物超限时自动触发预警与清理，不卡顿主线程
- [ ] 黑名单实体（经验球等）直接销毁，常规物品正确转移至回收箱
- [ ] provides `clean.trigger` 服务有效
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 区分物品品质白名单保留、多维度独立回收站

## 10. Legacy reference（仅参考）

- `packages/area/`（原 clean 掉落物清理子能力抽离重构）
