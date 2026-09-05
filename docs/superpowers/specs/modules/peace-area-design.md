# peace-area — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 作为挂接在 `area` 空间引擎上的声明式特性组件（`peace`），提供和平区域保护与怪物实体过滤。在声明了 `peace` 特性的空间区域内（如主城、新人生存区、交易集市），自动清理或拦截所有敌对生物族群（Monster Family），防止怪物刷出、游荡骚扰及袭击玩家，保障区域绝对和平。

**Non-goals:**
- 不自建独立的空间边界几何计算，依赖上游 `area` 空间插槽
- 不篡改生物原生 AI 行为树或仇恨系统，仅负责区域内的实体拦截与安全销毁
- 严禁向外部导出内部实现类

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `peace-area` |
| npm | `@sfmc-bds/module-peace-area` |
| manifest.id | `peace-area` |
| configKey | `peace_area` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["area"]` |

## 3. Player surface

纯空间插槽驱动，无面向普通玩家的交互命令。

## 4. Data

纯内存实体过滤，无数据库持久化表。

## 5. Config

`configs/peace_area.json`：

```json
{
  "target_families": ["monster"],
  "exclude_entities": [
    "minecraft:iron_golem",
    "minecraft:snow_golem"
  ]
}
```

- `target_families`：目标清除的实体族群类型（默认 `monster` 敌对怪物）；
- `exclude_entities`：豁免清理的友好/防卫型实体白名单（如铁傀儡、雪傀儡）。

## 6. Services

### provides

无。

### requires

| name | 来自 | 用途 |
|------|------|------|
| `area.registerFeature` | [area-design.md](./area-design.md) | 向底层空间引擎注册 `peace` 特性生命周期处理器 |
| `area.byPoint` | 同上 | 实体生成时点查坐标是否处于和平区 |

## 7. Lifecycle notes

- `afterWorldLoad`: **true**
- `registerEvents`：调用 `area.registerFeature` 挂接 `peace` 特性生命周期处理器；订阅实体生成事件：
  - **前置/后置生成拦截**：监听 `entitySpawn`，若生成实体属于 `target_families` 且不在白名单内，通过 `area.byPoint` 点查坐标；若处于和平区，立即调用 `entity.remove()` 销毁，阻止怪物露面；
  - **`onTick(ctx, params)`**：由 `area` 引擎定期触发，扫描该和平区域内的全部存活实体，兜底清除游荡误入或穿透生成的怪物；
  - 安全过滤：严格校验实体类型，坚决不误杀玩家宠物、坐骑、村民与友好 NPC。

## 8. Acceptance criteria

- [ ] 成功调用 `area.registerFeature` 挂接 `peace` 特性
- [ ] 和平区域内敌对生物生成即时被拦截清除
- [ ] 外部游荡怪物进入和平区在下个周期内被自动销毁
- [ ] 铁傀儡、友好生物与玩家宠物不受任何误伤
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 细分区域自定义过滤白名单/黑名单族群

## 10. Legacy reference（仅参考）

- `packages/area/`（原 peace 生物过滤子能力抽离重构）
