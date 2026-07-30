# Script API 原生对照映射（线 R）

**状态：** 草稿  
**用途：** 只读对照 LeviLamina `mc/scripting` 与 pin 版 `@minecraft/server`，指导沙箱 L2；**不入库任何 Levi 头文件**。

## 版本钉扎

| 组件 | 版本 |
|------|------|
| `@minecraft/server` | `2.10.0-beta.1.26.40-preview.30`（与模板 peer 一致） |
| `@minecraft/server-ui` | `2.2.0-beta.1.26.40-preview.30` |
| Levi `mc/scripting` | 对照时填写具体 Levi/BDS dump 版本（只读浏览，不拷贝） |

## 边界

- **权威契约：** npm `index.d.ts` + MS Learn  
- **线索源：** `LiteLDev/LeviLamina` → `src-server/mc/scripting/**`（如 `ScriptWorldAfterEvents`）  
- **非权威：** `ll/api/event`（平行插件事件）  
- 争议行为：Learn / 真机抽检优先于头文件猜测  

## 启动分相（宿主线 A）

| 原生 / Scripting 线索 | `@minecraft/server` | 沙箱目标 |
|----------------------|---------------------|----------|
| `ScriptModuleStartupBeforeEvent` 等 | `system.beforeEvents.startup` | ConfigManager.init → bootAll |
| Level / world init 后 | `world.afterEvents.worldLoad` | bootAfterWorldLoad |
| shutdown | `system.beforeEvents.shutdown` | teardown / dispose |

## 事件面（初表，随 L2 勾选）

| Scripting 线索（示意） | Script API | 沙箱 | 备注 |
|------------------------|------------|------|------|
| ScriptWorldAfterEvents.playerJoin | `world.afterEvents.playerJoin` | L2 | `sb.emit.playerJoin` |
| ScriptWorldAfterEvents.playerSpawn | `world.afterEvents.playerSpawn` | L2 | `sb.emit.playerSpawn` |
| ScriptWorldBeforeEvents.chatSend | `world.beforeEvents.chatSend` | L2 | `sb.emit.chatSend` |
| ScriptSystemAfterEvents.scriptEventReceive | `system.afterEvents.scriptEventReceive` | L2 | `sb.emit.scriptEvent` |
| LevelTick / system tick | `system.run*` / currentTick | L2 | FakeSystem |
| （其余 WorldAfter/Before） | 对应 after/beforeEvents.* | L0 | 生成骨架硬失败 |

## Scoreboard（对照 Learn + pin `.d.ts`）

权威：[Scoreboard](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/scoreboard) / [ScoreboardObjective](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/scoreboardobjective)；pin `2.10.0-beta.1.26.40-preview.30`。

| Script API | 沙箱 | 备注 |
|------------|------|------|
| `world.scoreboard.addObjective` | L2 | 重复 id 抛错 |
| `getObjective` / `getObjectives` / `removeObjective` | L2 | remove 后 `isValid=false` |
| `set/get/clearObjectiveAtDisplaySlot` | L2 | 最小槽位表 |
| `getParticipants`（Scoreboard） | L2 | 含已登记 Identity |
| `ScoreboardObjective.getScore` | L2 | **未设分 → `undefined`**（非 0） |
| `setScore` / `addScore` / `hasParticipant` / `removeParticipant` / `getScores` | L2 | participant: string \| Identity \| Player |
| `Player.scoreboardIdentity` | L2 | type=`Player` |
| `Scoreboard` / `ScoreboardObjective` 顶层 class 构造 | L0 | `new` 硬失败（与真机 private ctor 一致） |

状态：`L0` = 可 import/硬失败；`L2` = 有可测语义；`—` = 未接线。

## Dimension / Block（对照 Learn + pin `.d.ts`）

权威：[Dimension](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension) / [Block](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/block) / [BlockPermutation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockpermutation)。

| Script API | 沙箱 | 备注 |
|------------|------|------|
| `world.getDimension` | L2 | overworld/nether/the_end 别名 |
| `Dimension.id` / `heightRange` | L2 | 高度区间近似 |
| `getBlock` | L2 | **恒返回 Block**；缺省空气（不模拟未加载→`undefined`） |
| `setBlockPermutation` / `setBlockType` | L2 | |
| `getPlayers` / `getEntities` | L2 | getEntities 支持 type/tags/距离查询 |
| `spawnEntity` | L2 | 触发 `world.afterEvents.entitySpawn` |
| `Block.isAir` / `typeId` / `permutation` / `setPermutation` | L2 | |
| `BlockPermutation.resolve` | L2 | `new BlockPermutation()` 仍 L0 硬失败 |
| 其余 Dimension 方法（fill/explosion/…） | L0 | allowlist 外访问硬失败 |

## Entity（对照 Learn + pin `.d.ts`）

权威：[Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity)。

| Script API | 沙箱 | 备注 |
|------------|------|------|
| `Entity.id` / `typeId` / `location` / `dimension` / `nameTag` / `isValid` | L2 | |
| `remove` / `kill` / `teleport` | L2 | teleport 可换维度 |
| `addTag` / `hasTag` / `getTags` / `removeTag` | L2 | |
| `getComponent` / `hasComponent` | L2 | `minecraft:inventory` → EntityInventoryComponent；其余 undefined |

## Container / Inventory（对照 Learn + pin `.d.ts`）

权威：[Container](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container) / [ItemStack](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack) / [EntityInventoryComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityinventorycomponent)。

| Script API | 沙箱 | 备注 |
|------------|------|------|
| `new ItemStack(type, amount?)` | L2 | amount 1–255；`clone` / `isStackableWith` |
| `Container.getItem` / `setItem` | L2 | 空槽 `undefined`；get/set 克隆 |
| `addItem` / `clearAll` / `transferItem` / `swapItems` / `moveItem` | L2 | |
| `size` / `emptySlotsCount` / `weight` | L2 | |
| `EntityInventoryComponent.container` | L2 | `componentId = minecraft:inventory` |
| 玩家库存槽位数 | L2 | 36；chest_minecart 27；默认实体 27 |
| `new Container()` / `new EntityInventoryComponent()` | L0 | 硬失败 |

## server-ui（对照本地 pin `2.2.0-beta.1.26.40-preview.30`）

权威：本地 `node_modules/@minecraft/server-ui/index.d.ts`（**不止** Action/Message/Modal 三表单）。

| Script API | 沙箱 | 备注 |
|------------|------|------|
| `ActionFormData` / `MessageFormData` / `ModalFormData` | L2 | + divider/header/label/submitButton；`show(player)` + queueResponse |
| `CustomForm` | L2 | `constructor(player,title)`；`show()` 无参；selection 触发 button onClick |
| `MessageBox` | L2 | `show()` → `{ closeReason, selection? }` |
| `ObservableBoolean/Number/String/UIRawMessage` | L2 | value + subscribe |
| `uiManager.closeAllForms` | L2 | 清空该玩家队列 |
| `DataDrivenScreenClosedReason` | L1 | **ClientClosed / ServerClosed / UserBusy**（非 UserClosed） |
| `FormCancelationReason` | L1 | UserClosed / UserBusy |
| 其余（FormReject*、错误类、UIManager ctor…） | L0 | 生成骨架硬失败 |

## 维护

1. 升级 `@minecraft/server` pin 时更新本表版本行  
2. 加深 L2 前先在本表加行再改 overrides  
3. 勿将 Levi 路径加入 npm pack / git submodule（除非另开私有只读镜像且仍不进发布包）
