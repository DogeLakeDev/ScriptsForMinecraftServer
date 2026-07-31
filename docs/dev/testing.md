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

## Playground 1:1 驱动面

第一轮对 pin 版 `@minecraft/server` **不做最小集裁剪**，三块表面可驱动：

| 块 | API | 说明 |
| ---- | ---- | ---- |
| 构造对象 | `sb.objects.create(kind, props)` | `Player` / `Entity` / `ItemStack` / `Block`；可写属性来自生成元数据 |
| 操作对象 | `sb.objects.call(id, method, args)` | 调实例方法；未实现 → L0 硬失败 |
| 事件触发 | `sb.events.emit(path, payload)` | 路径如 `world.afterEvents.playerJoin`；hub 清单见 `PLAYGROUND_META.events` |

扩展「SFMC: Open Playground」通过 `playground-host` JSON-RPC 消费同一套 API。快捷创建 / 每玩家聊天糖为后续轮次。

世界模拟维度（宿主分相、System、玩家、聊天等）与「永不模拟」边界见规格 `docs/superpowers/specs/2026-07-31-sfmc-module-extension-design.md` §5；真机联调用 Watch，不靠假 BDS。

## 宿主分相

`createSandbox({ module })` 默认对齐 BDS 启动：

1. 内存 `DataAdapter` → `ConfigManager.init()`
2. `ModuleRegistry.register` → `bootAll`
3. 假 `world.afterEvents.worldLoad` → `bootAfterWorldLoad`
4. `dispose` → cleanup + 复位 Registry / ConfigManager

可选：`configs` 覆盖内存快照；`enabled: false` 时模块不 boot；`boot: false` 只起假引擎。旁路钩子单测可用 `runLifecycle` / `runCleanup`（不经 ConfigManager，非默认路径）。

## 能测什么

| API | 作用 |
| ------ | ------ |
| `createSandbox` | 假引擎 + 宿主 boot；`addPlayer` / `emit.*` / `tick` / `triggerCommand` / `ui.queueResponse` / `dispose`；`supported.l0` 为生成元数据 |
| `sb.objects` / `sb.events` | 1:1 构造 / 调用 / 全 hub emit；Event 类型亦可 `create`；`eventTypes` 映射信号→Event 类 |
| `PLAYGROUND_META` | class 成员（含全部 Event）+ hub 信号 + `eventTypes` |
| `sb.emit` | `playerJoin` / `playerSpawn` / `chatSend` / `scriptEvent`（糖；底层仍是事件） |
| `createFakePlayer` / `createFakeDb` | 底层替身（一般不必直接用） |
| `runCleanup` | 单测清理钩子 |
| `assertMsg` | 断言玩家消息 |

## 已实现语义（L2 摘要）

| 面 | 行为 |
| ------ | ------ |
| System | `run` / `runTimeout` / `runInterval` / `clearRun` / `tick` / `flush` |
| Player | `id` / `name` / `nameTag` / `typeId` / `location` / `dimension` / `playerPermissionLevel` / `scoreboardIdentity` / `sendMessage` / `isValid` |
| 事件 | 订阅 + `sb.emit.*`；boot 自动假 `worldLoad` |
| UI | 经典三表单 + `CustomForm` / `MessageBox` / Observables / `uiManager` + `ui.queueResponse` |
| Scoreboard | `add/get/removeObjective`、display slot、`getScore→undefined`、`set/addScore`、`Player.scoreboardIdentity`（对齐 Learn） |
| Dimension | `getBlock` 缺省空气、`setBlockPermutation`/`setBlockType`、`BlockPermutation.resolve`；不模拟未加载区块 |
| Entity | `spawnEntity` / `getEntities` 查询、`remove`/`kill`/`teleport`/tags；`getComponent('minecraft:inventory')` |
| Inventory | `ItemStack`、`Container` get/set/add/transfer/swap、玩家 36 格 |

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
4. 设置 `sfmc.root` 为 SFMC 工作根（指向主仓根；Watch、Reload to BDS、模块启停都需要）。

## 相关

| 章节 | 内容 |
| ------ | ------ |
| [模块开发](./module-author.md) | 扩展优先工作流 |
| [工具脚本](./tools.md) | 平台 `smoke-modules`（非作者日常） |
| [SDK 类型参考](../reference/index.md) | TypeDoc（含 testing） |
