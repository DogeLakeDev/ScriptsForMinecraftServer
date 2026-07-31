# 测试沙箱

在 **不启动 BDS** 的情况下，用 `node --test` + `@sfmc-bds/sdk/testing` 跑模块 lifecycle 与游戏 API 断言。

假引擎对齐 pin 版 `@minecraft/server` / `server-ui`（大范围导出 + 未实现硬失败）。作者日常用 **VS Code/Cursor 扩展「SFMC Module」**；`sfmc mod test|watch` 已移除。

目标：把「类型全绿、进服才翻日志」的故障前移到 `npm test`（堆栈落在模块源码）。

## 保真层级

| 层级 | 含义 |
| ------ | ------ |
| L0 | 声明面可 `import`；未实现方法硬失败 |
| L1 | 枚举/无状态默认 |
| L2 | 可断言状态机（Player、tick、事件、UI…） |
| L3 | 高成本世界语义（方块/实体…）专题加深 |

手写 L1–L3 实现放在 `modules/sdk/@sfmc-sdk/src/testing/engine/overrides/`；`overrides/exports.json` 是生成器跳过名单的权威来源（`npm run gen:mc-fake`）。

## Playground 1:1 驱动面

第一轮对 pin 版 `@minecraft/server` **不做最小集裁剪**，三块表面可驱动：

| 块 | API | 说明 |
| ---- | ---- | ---- |
| 构造对象 | `sb.objects.create(kind, props)` | `Player` / `Entity` / `ItemStack` / `Block`；可写属性来自生成元数据 |
| 操作对象 | `sb.objects.call(id, method, args)` | 调实例方法；未实现 → L0 硬失败 |
| 事件触发 | `sb.events.emit(path, payload)` | 路径如 `world.afterEvents.playerJoin`；hub 清单见 `PLAYGROUND_META.events` |

扩展「SFMC: Open Playground」通过 `playground-host` JSON-RPC 消费同一套 API。快捷创建 / 每玩家聊天糖为后续轮次。

世界模拟维度与「永不模拟」边界如下（与规格 §6 一致）。IDE 内默认人机路径为 **脚本沙箱**（sapi-sandbox：节点图编排 + 场景坞 + meta 表单），见 `docs/superpowers/specs/2026-07-31-sfmc-script-sandbox-ui-design.md`。引擎与扩展边界见 `docs/superpowers/specs/2026-07-31-sfmc-testing-and-extension-design.md`。真机联调用 Watch。

## 世界模拟维度

| ID | 维度 | 含义 | 沙箱 | 脚本沙箱 UI |
| --- | --- | --- | --- | --- |
| H | 宿主分相 | ConfigManager → boot → worldLoad | 有 | 进度 / 重置 |
| S | System | run / tick / flush | 有 | Tick 节点 |
| W | World | 假 world | 薄 | 场景坞只读 |
| D | Dimension | 默认三维可查；无物理 | 部分 L2 | 场景坞只读 |
| P | 玩家 | 名、OP、位置、Msg… | 有 | 图节点 / 场景 |
| E | 实体 | spawn / query… | 部分 L2 | 场景 / 后置节点 |
| I | 物品栏 | ItemStack / Container | 有 | 后置 |
| C | 聊天 → 命令 | `chatSend` → `!` | emit 有 | Emit 节点 |
| V | 事件对象 | 属性袋 + emit | 有 | Emit 表单 |
| U | UI | 表单 + queueResponse | 有 | 后置 |
| B | 记分板 | objective / score | 有 | 后置 |
| M | 模块宿主 | Registry / Permission / Msg | 有 | boot / 冒烟 |
| N | DB | 内存假 DB | 有 | 默认 |

**永不模拟：** 完整物理、红石、流体、AI、区块生成语义、客户端渲染、BDS 原生断点。

## 宿主分相

`createSandbox({ module })` 或 `createSandbox({ moduleRoot })` 默认对齐 BDS 启动：

1. 内存 `DataAdapter` → `ConfigManager.init()`
2. 装载 `sapi/src/index.ts`（`moduleRoot`）或使用传入的 `DESCRIPTOR`（`module`）
3. `ModuleRegistry.register` → `bootAll`
4. 假 `world.afterEvents.worldLoad` → `bootAfterWorldLoad`
5. `dispose` → cleanup + 复位 Registry / ConfigManager

聊天以 `!` / `！` 开头时，沙箱拦截 `beforeEvents.chatSend` 并走 `Command.trigger`（扩展「Run Module Tests」冒烟与脚本沙箱 Emit 共用；手点主路径不要直接 `triggerCommand`）。

可选：`configs` 覆盖内存快照；`enabled: false` 时模块不 boot；`boot: false` 只起假引擎；`fixture` 可预置 settings/权限。脚本沙箱面板「夹具」经 `fixture.get` / `fixture.apply` 读写同一意图，重置场景后宿主会保留并重新注入。旁路钩子单测可用 `runLifecycle` / `runCleanup`（不经 ConfigManager，非默认路径）。

## 能测什么

| API | 作用 |
| ------ | ------ |
| `createSandbox` | 假引擎 + 宿主 boot；支持 `module` / `moduleRoot`；`addPlayer` / `emit.*` / `tick` / `triggerCommand` / `ui.queueResponse` / `dispose`；`supported.l0` 为生成元数据 |
| `loadModuleDescriptor` | 从模块根动态装载 `sapi/src/index.ts` 的 `DESCRIPTOR` |
| `sb.objects` / `sb.events` | 1:1 构造 / 调用 / 全 hub emit；Event 类型亦可 `create`；`eventTypes` 映射信号→Event 类 |
| `PLAYGROUND_META` | class 成员（含全部 Event）+ hub 信号 + `eventTypes` |
| `sb.emit` | `playerJoin` / `playerSpawn` / `chatSend` / `scriptEvent` / `playerLeave` / `itemUse` / `playerBreakBlock` / `playerPlaceBlock` / `playerInteractWithBlock` / `entityHitEntity`（糖；底层仍是事件） |
| `createFakePlayer` / `createFakeDb` | 底层替身（一般不必直接用） |
| `runCleanup` | 单测清理钩子 |
| `assertMsg` | 断言玩家消息 |

## 已实现语义（L2 摘要）

| 面 | 行为 |
| ------ | ------ |
| System | `run` / `runTimeout` / `runInterval` / `clearRun` / `tick` / `flush`；`isEditorWorld=false` |
| World | 薄：`getDimension`、玩家列表、时间 / 出生点、`sendMessage`、`getEntity`、动态属性；`allowCheats` / `seed` / `isHardcore`；`runCommand`（仅记录）/ `playSound`（仅记录）；`removePlayer` → `playerLeave` |
| Player | `id` / `name` / `nameTag` / `typeId` / `location` / `dimension` / `playerPermissionLevel` / `scoreboardIdentity` / `sendMessage` / `teleport` / tags / `isValid`；`getGameMode`/`setGameMode`（+ `playerGameModeChange`）、`runCommand`（记录 + 薄解析 `gamemode` / `give` / `clear`→物品栏、`ability`→`abilities` 袋）、`playSound`、`onScreenDisplay`、`getSpawnPoint`/`setSpawnPoint`、`applyDamage` / `kill` / `minecraft:health`；`addEffect`/`getEffect`/`getEffects`/`removeEffect` |
| 事件 | 订阅 + `sb.emit.*`；boot 自动假 `worldLoad`；`kill`/`applyDamage→0` → `entityDie`（`damageSource` 含 cause / damagingEntity / damagingProjectile）；`sb.emit.playerLeave` / `itemUse` / `playerBreakBlock` / `playerPlaceBlock`（可落块）/ `playerInteractWithBlock` / `entityHitEntity` |
| UI | 经典三表单 + `CustomForm` / `MessageBox` / Observables / `uiManager` + `ui.queueResponse` |
| Scoreboard | `add/get/removeObjective`、display slot、`getScore→undefined`、`set/addScore`、`Player.scoreboardIdentity`（对齐 Learn） |
| Dimension | 默认三维可查；`getBlock` 缺省空气、`setBlockPermutation`/`setBlockType`、`spawnEntity`/`spawnItem`、`getEntities`/`getEntitiesAtBlockLocation`/`getEntitiesOfType`（糖）、`isChunkLoaded≡true`、天气状态袋；`runCommand`（仅记录）；不模拟未加载区块 / 物理 |
| Entity | `spawnEntity` / 查询、`remove`/`kill`/`teleport`/tags；`getComponent('minecraft:inventory'|'minecraft:health')`；`applyDamage`（生命值袋，无物理）；`addEffect`/`getEffect`/`getEffects`/`removeEffect`（效果状态袋，无粒子/周期伤）；`runCommand`（记录；有物品栏时 give/clear 可作用） |
| Inventory | `ItemStack`、`Container` get/set/add/transfer/swap、玩家 36 格 |

`PLAYGROUND_META` 方法/属性带 `impl: "l0" | "l2" | "skip"`：`l2` 由 `gen-playground-meta` 扫描 `overrides/` 里 Fake* 自有成员推断（Player 合并 Entity）；`skip` 来自权威清单 `src/testing/engine/l2-skip.json`（实现面跳过 / Call 不主推，**≠** L0 名面 allowlist，声明面仍可硬失败）；其余 TARGET 默认 `l0`。脚本沙箱 Call：L2 在前，L0 标「未接线」，skip 排在其后并标「跳过/无测价值」。

## 边界与非目标

- **全表面 ≠ 假 BDS**：声明面可 import 不等于模拟完整引擎。
- 未实现 `@minecraft/*` API **一碰就抛**（禁止安静 noop）。失败分两种：
  - L0 硬失败：错误名含 `UnimplementedMinecraftApiError` / 文案「未实现的 Minecraft API」→ 沙箱未接线，缩小用例或等加深。
  - 断言失败：已接线 API 行为与预期不符 → 修模块或报沙箱保真 bug。
- 不模拟完整物理 / 红石 / 区块生成。
- 不把 LeviLamina 等逆向头文件入库；`mc/scripting` 仅作团队只读对照（见规划规格）。
- 真机手感用扩展 **Start Watch** 或运维 `sfmc mod reload`。
- `@minecraft/server-gametest` 为预留真机轨，不在 Node 沙箱内（勿在 `npm test` 中依赖）。
- 沙箱内 `ModuleRegistry` / `Command` 为进程级单例：`dispose` 后勿与并行用例抢同一进程；模块仓默认串行 `node --test` 即可。

## 与 BDS 日志分工

| 优先 | 手段 |
| ------ | ------ |
| 脚本运行时 / lifecycle / 命令 Msg | `npm test` |
| 世界交互与版本 quirk | Watch / 真机日志 |

## 最小示例

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSandbox, assertMsg } from "@sfmc-bds/sdk/testing";
import { DESCRIPTOR } from "../sapi/src/index.js";

test("命令冒烟", async (t) => {
  const sb = await createSandbox({ module: DESCRIPTOR });
  t.after(() => sb.dispose());
  const player = sb.addPlayer({ name: "tester", op: true });
  await sb.triggerCommand("example", player);
  assert.equal(assertMsg(player, "示例模块已就绪"), true);
});
```

`package.json`：

```json
{
  "scripts": {
    "test": "node --test --import @sfmc-bds/sdk/testing/minecraft-loader --import tsx/esm test/**/*.test.ts"
  }
}
```

## Cursor / VS Code

1. 安装推荐扩展：`ESLint`、`SFMC Module`、`nodejs-testing`（见模板 `.vscode/extensions.json`）。
2. Testing 面板发现 `test/**/*.test.ts`（settings 已配好 loader）。
3. 命令面板：`SFMC: Run Module Tests` / `Start Watch` / `Reload to BDS`。
4. 设置 `sfmc.root` 为 SFMC 工作目录（含 `configs/`、`modules/` 的运行时根，不必是源码仓库；Watch、Reload to BDS、模块启停都需要）。

### 模块如何进沙箱（最短路径）

1. 用 VS Code/Cursor **单独打开模块根**（含 `package.json` + `sapi/manifest.json`），或在 SFMC 侧栏选中目标模块。
2. Tree 点 **脚本沙箱**，或命令面板 `SFMC: 脚本沙箱`（多模块时会 QuickPick；无选中可沿用上次，不会静默装错包）。
3. 顶栏「当前模块」与 Output（`sandbox moduleRoot=…` / `已装 DESCRIPTOR id=…`）应对上你的模块 id；重置场景仍保持同一 `moduleRoot`。
4. `SFMC: Run Module Tests` 与沙箱共用同一 `moduleRoot` 解析；冒烟结果在「SFMC 扩展」Output，若沙箱已开会按同根重置场景。
5. 日志主路径：Output「SFMC 扩展」。可用 `SFMC: 日志过滤…` / 视图菜单过滤（仅新写入）；运行行含 `node=<id>`，失败后 `SFMC: 定位沙箱日志节点`（剪贴板或上次失败）；断言可筛最近 N 条 / 级别 / source；模块 `console`/`Msg` 以模块 id 为 source 汇入。

## 相关

| 章节 | 内容 |
| ------ | ------ |
| [模块开发](./module-author.md) | 扩展优先工作流 |
| [工具脚本](./tools.md) | 平台 `smoke-modules`（非作者日常） |
| [SDK 类型参考](../reference/index.md) | TypeDoc（含 testing） |
