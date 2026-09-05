# inventory-switcher — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 构建**全平台通用的玩家背包快照、隔离还原与多槽位切换服务提供者（Inventory Switching & Snapshot Provider）**。将玩家全部物品栏（主背包、快捷栏、盔甲栏、副手槽位）结构化序列化并持久化至数据库；对外暴露标准化的 service 接口，供上层业务模块（如 `gamemode-area` 创造沙箱、副本活动等）按需调度，彻底解耦具体业务逻辑与底层背包序列化细节。

**Non-goals:**
- **严禁私自监听原生游戏模式变化（`playerGameModeChange`）**：模式与区域判定一律由上层业务模块（如 `gamemode-area`）主导，本模块纯粹作为受控的被动底层服务
- **彻底废除在主世界生成物理双箱与木告示牌记录的旧版遗留方案**，统一采用高性能数据库结构化存储
- 严禁向外部导出内部实体序列化类，所有跨模块操作严格经由标准化 service 调度

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `inventory-switcher` |
| npm | `@sfmc-bds/module-inventory-switcher` |
| manifest.id | `inventory-switcher` |
| configKey | `inventory_switcher` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

纯受控服务底座，无面向普通玩家的手动输入命令。

管理面交互（灾备兜底）：

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `inv restore <player> <slotKey>` | `inv.admin` | OP (3) | 紧急情况下从指定槽位快照手动为玩家恢复背包 |

## 4. Data

| 表名 | 归属 | 关键列 | 用途 |
|------|------|--------|------|
| `sfmc_inventories` | 本模块 defineTable | player_id, slot_key, items_data, updated_at | 结构化持久化存储玩家各槽位背包（含盔甲与副手）JSON 快照 |

联合唯一索引：`(player_id, slot_key)`。

## 5. Config

`configs/inventory_switcher.json`：

```json
{
  "max_slots_per_player": 5,
  "save_xp_level": false
}
```

- `max_slots_per_player`：每个玩家允许持久化的最大槽位数量上限（默认 5 套）；
- `save_xp_level`：是否在保存背包时同步快照并还原玩家的经验值与等级。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `inventory.save` | `{ playerId: string, slotKey?: string, clearCurrent?: boolean }` | `{ ok: boolean }` | 将玩家当前物品栏保存至指定槽位（缺省为 `"default"`），可选保存后清空当前背包 |
| `inventory.restore` | `{ playerId: string, slotKey?: string, clearAfter?: boolean }` | `{ ok: boolean }` | 从指定槽位读出快照并完整恢复至玩家物品栏，可选恢复后从数据库删除该记录 |
| `inventory.switch` | `{ playerId: string, fromSlotKey: string, toSlotKey: string }` | `{ ok: boolean }` | 原子置换两个槽位（将当前背包存入 `fromSlotKey`，并载入 `toSlotKey` 内容） |
| `inventory.clear` | `{ playerId: string, backupSlotKey?: string }` | `{ ok: boolean }` | 清空玩家当前全部物品栏，可选在清空前自动备份至 `backupSlotKey` |
| `inventory.has` | `{ playerId: string, slotKey: string }` | `{ exists: boolean }` | 检查指定玩家在特定槽位是否存在已保存的背包快照 |

### requires

无。

## 7. Lifecycle notes

- `afterWorldLoad`: **true**（需世界实装以访问玩家实体物品组件）
- **序列化与恢复契约**：
  1. 完整覆盖 36 格主背包容器、4 格装备栏（Head / Chest / Legs / Feet）与副手（Offhand）；
  2. 精确记录 `typeId`、`amount`、耐久（damage）、显示名（nameTag）、自定义 lore 与附魔属性；
  3. 还原时执行清空校验，先完整清空对应槽位再逐一填充，杜绝物品重叠或卡出复制；
- 纯被动架构：无任何常驻轮询定时器，所有行为完全由上游模块通过 RPC service 调用触发。

## 8. Acceptance criteria

- [ ] 核心零模式监听与零物理箱子生成，定位纯净的背包服务
- [ ] `inventory.save` / `restore` / `switch` / `clear` / `has` 完整注册且往返序列化不丢属性
- [ ] 盔甲与副手栏位与主背包一同原子更新
- [ ] 数据库表 `sfmc_inventories` 字段定义符合规范，支持多槽位隔离
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 离线玩家背包远程修改、支持跨服 Redis 暂存

## 10. Legacy reference（仅参考）

- `packages/inventory-switcher/`（废弃物理双箱方案，重构为微服务数据持久化）
