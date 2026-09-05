# afk — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 基于玩家位移与交互行为实现低开销的挂机检测（AFK），自动标注状态并广播全服；支持玩家手动切换挂机状态，并允许管理员为特权用户施加挂机豁免标记。

**Non-goals:**
- 模块纯内存运行，不引入数据库持久化
- 首版不引入挂机自动踢出（Kick）或经济扣费惩罚

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `afk` |
| npm | `@sfmc-bds/module-afk` |
| manifest.id | `afk` |
| configKey | `afk` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `afk` | `afk.use` | Member | 玩家主动切换进入/退出挂机状态 |
| `noafk` | `afk.clear.other` | Admin | 为指定目标玩家添加或移除 `NOAFK` 挂机豁免标签 |

## 4. Data

纯内存与原生标签，无数据库表。使用原生玩家 Tag：`AFK`（挂机中）、`NOAFK`（免疫自动检测）。

## 5. Config

`configs/afk.json`：

```json
{
  "afk_time": 120,
  "step_time": 15
}
```

- `afk_time`：空闲判定阈值（秒），超过此时间无有效位移则判定为挂机；
- `step_time`：检测轮询间隔（秒）。
未配置时默认采用上述设定。

## 6. Services

无。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**
- 周期判定机制：定期采样在线玩家坐标，当欧氏位移 $\ge 1.0$ 方块时重置空闲计时；当空闲时长达到 `afk_time` 且无 `NOAFK` 标签时，自动打上 `AFK` 标签并通过 `Msg.broadcast` 播报；
- 状态唤醒：处于 `AFK` 状态的玩家产生有效移动后，立即剥离标签并播报重返游戏；
- 边界处理：玩家进服（`playerSpawn`）或离线时及时复位内存坐标缓存与瞬态标签。

## 8. Acceptance criteria

- [ ] 挂机检测阈值与轮询步长由配置精确驱动
- [ ] 手动执行 `!afk` 与自动超时打标广播行为正确
- [ ] 拥有 `NOAFK` 标签的玩家绝对豁免自动挂机判定
- [ ] 玩家重返移动后标签与广播即时恢复
- [ ] typecheck / lint / test 通过

## 9. Deferred

- AFK 踢出 / 经济惩罚

## 10. Legacy reference（仅参考）

- `packages/afk/`
