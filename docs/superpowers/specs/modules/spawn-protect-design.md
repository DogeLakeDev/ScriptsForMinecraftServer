# spawn-protect — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 当玩家初次进入世界或死亡重生（Spawn / Respawn）时，自动为其施加短时高阶伤害抗性增益（Resistance），有效防范因出生点刷怪围堵、高空坠落或网络加载延迟引发的落地秒杀现象。

**Non-goals:**
- 模块极简自治，不引入数据库表持久化
- 不提供面向玩家的手动控制命令

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `spawn-protect` |
| npm | `@sfmc-bds/module-spawn-protect` |
| manifest.id | `spawn-protect` |
| configKey | `spawn_protect` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

纯事件响应机制，无玩家命令、无表单界面。

## 4. Data

纯内存与原生实体状态，无数据库持久化。

## 5. Config

无需强制配置，保留 `configKey: spawn_protect` 占位。内置保护常量定义：
- 药水效果标识：`minecraft:resistance`
- 保护时长：严格采用 `duration = 60 ticks`（约 3 秒，杜绝旧版秒/刻混用的裸数值）；
- 效果等级：`amplifier = 5`（最高免伤等级）。

## 6. Services

无。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**（可在启动期挂载 `playerSpawn` 事件监听）
- 触发策略：监听 `world.afterEvents.playerSpawn`（涵盖初次进服 `initialSpawn: true` 与死亡复活 `initialSpawn: false`）；若玩家当前未带有同等或更高抗性效果，则施加保护；在 `cleanup` 阶段彻底注销事件回调。

## 8. Acceptance criteria

- [ ] 进服与复活时正确施加抗性效果，时长与等级与 §5 一致
- [ ] 已有高阶抗性时不发生非预期覆盖或缩减
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 可配置时长/等级

## 10. Legacy reference（仅参考）

- `packages/spawn-protect/`
