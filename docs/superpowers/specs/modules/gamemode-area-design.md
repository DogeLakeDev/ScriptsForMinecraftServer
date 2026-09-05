# gamemode-area — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 作为挂接在 `area` 空间引擎上的声明式特性组件（`gamemode`），提供生存与创造模式沙箱控制与状态机隔离。玩家进入创造沙箱时快照保存生存背包并切换创造模式，阻断封禁物品放置与跨区夹带创造物品外流；离开创造区或进入强制生存区时，还原生存背包并纠正游戏模式；对外暴露创造链开关服务供 `gui` 聚合调度。

**Non-goals:**
- 不自建独立的空间边界侦测循环，进出判定与区域管理严格依赖上游 `area` 空间插槽
- 不实现跨维度的分布式背包转移，聚焦于单服内空间区域的状态隔离
- 严禁向外部导出内部领域类，所有跨模块通信经由标准化 service 调度

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `gamemode-area` |
| npm | `@sfmc-bds/module-gamemode-area` |
| manifest.id | `gamemode-area` |
| configKey | `gamemode_area` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["area", "inventory-switcher"]` |

## 3. Player surface

纯空间插槽驱动，无面向普通玩家的手动输入命令。

登记权限节点：

| 权限节点 | 权限等级 | 行为摘要 |
|----------|----------|----------|
| `gamemode_area.bypass` | OP (3) | 允许在受控区域外保留创造或旁观模式豁免 |
| `gamemode_area.place_banned` | Admin (2) | 允许在创造区内放置黑名单封禁物品 |

## 4. Data

**零私有数据表**。玩家的生存与创造物品快照统一委托给上游 `inventory-switcher` 模块（存储在 `sfmc_inventories` 表中，指定槽位 `gamemode_survival_backup`）。

## 5. Config

`configs/gamemode_area.json`：

```json
{
  "creative_chain_enabled": true,
  "enforce_survival_outside": true,
  "banned_items": [
    "minecraft:bedrock",
    "minecraft:barrier",
    "minecraft:structure_block",
    "minecraft:tnt"
  ]
}
```

- `creative_chain_enabled`：创造/生存联动链总开关；若设为 false，创造沙箱与校正逻辑安全空转；
- `enforce_survival_outside`：是否在所有创造区外强制将非豁免玩家纠正为生存模式；
- `banned_items`：创造区内默认禁放与禁用的危险物品 ID 清单。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `gamemode.setCreativeChainEnabled` | `{ enabled: boolean }` | `{ ok: boolean }` | 供 `gui` 管理面板启停创造/生存模式联动链 |
| `gamemode.isCreativeChainEnabled` | `{}` | `{ enabled: boolean }` | 查询当前创造模式联动链开关状态 |

### requires

| name | 来自 | 用途 |
|------|------|------|
| `area.registerFeature` | [area-design.md](./area-design.md) | 向底层空间引擎注册 `gamemode` 特性生命周期处理器 |
| `inventory.save` | [inventory-switcher-design.md](./inventory-switcher-design.md) | 快照并暂存玩家当前生存背包至隔离槽位 |
| `inventory.restore` | 同上 | 从隔离槽位完整恢复玩家生存背包 |
| `inventory.clear` | 同上 | 清空创造背包，彻底阻断创造物品带出 |
| `inventory.has` | 同上 | 检查是否存在待恢复的生存背包快照 |

## 7. Lifecycle notes

- `afterWorldLoad`: **true**
- `registerEvents`：调用 `area.registerFeature` 挂接 `gamemode` 特性处理器；订阅方块放置事件进行创造区禁放拦截：
  - **`onEnter(player, ctx, params)`**：
    - 若区域参数 `params.mode === "creative"`：
      1. 调用 `inventory.save({ playerId: player.id, slotKey: "gamemode_survival_backup", clearCurrent: true })` 将生存物品安全快照并清空手头背包；
      2. 切换为 `GameMode.creative` 并发送进入提示；
    - 若区域参数 `params.mode === "survival"` 或在校正区外且玩家处于创造模式：
      1. 校验 `gamemode_area.bypass` 权限；无豁免则调用 `inventory.clear({ playerId: player.id })` 清空创造物品，再调用 `inventory.restore({ playerId: player.id, slotKey: "gamemode_survival_backup", clearAfter: true })`，纠正为生存模式。
  - **`onLeave(player, ctx, params)`**：
    - 若离开创造区：
      1. 调用 `inventory.clear({ playerId: player.id })` 彻底销毁创造物品；
      2. 调用 `inventory.restore({ playerId: player.id, slotKey: "gamemode_survival_backup", clearAfter: true })` 还原生存背包；
      3. 切换回 `GameMode.survival`。
- **宕机与掉线安全防御**：
  - 玩家在创造区下线后重登：`playerSpawn` 时若玩家不在创造区且拥有 `gamemode_survival_backup` 快照，自动触发安全清理与恢复流程，杜绝物品丢失与卡创造漏洞。

## 8. Acceptance criteria

- [ ] 成功调用 `area.registerFeature` 挂接 `gamemode` 特性
- [ ] 依赖 `inventory-switcher` 完成背包快照与还原，模块自身零冗余数据表
- [ ] 进入创造区快照背包并切创造；出创造区清空创造物品并还原生存背包
- [ ] 创造区内封禁物品放置有效阻断
- [ ] 创造区外非豁免创造模式自动纠正为生存模式
- [ ] 异常断线重连能正确恢复背包，无丢物卡创造漏洞
- [ ] `gamemode.setCreativeChainEnabled` 供 `gui` 调用有效
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 多套独立创造背包方案、按领地权限细分允许创造名单

## 10. Legacy reference（仅参考）

- `packages/area/`（原 creative & survival 组合子功能重构抽离）
