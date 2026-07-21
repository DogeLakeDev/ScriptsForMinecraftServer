# SDK 三抽屉 API 索引

> `@sfmc/sdk` 是仓顶唯一伞包,通过 subpath exports 暴露稳定 API。SAPI 模块作者**只**看 `@sfmc/sdk/sapi/runtime` 与 `@sfmc/sdk/contracts`。其余抽屉(`host` / `sdk` / `module-loader`)目前仅供 entry.ts 与 SDK 自身使用。

## 抽屉速览

| 抽屉 | 子路径 | 谁该用 |
|------|--------|--------|
| runtime | `@sfmc/sdk/sapi/runtime` | 90% 的业务代码 |
| host | `@sfmc/sdk/sapi/host` | 平台层适配(普通模块无需) |
| sdk | `@sfmc/sdk/sapi/sdk` | 契约类型(占位) |
| contracts | `@sfmc/sdk/contracts` | 跨 SAPI / db-server 共享类型 |
| module-loader | `@sfmc/sdk/module-loader` | **仅** `scripts/entry.ts` 用 |
| logs | `@sfmc/sdk/logs` | Node 服务日志 |
| node/config | `@sfmc/sdk/node/config` | Node 服务定位 configs/data |
| behavior-pack-build | `@sfmc/sdk/behavior-pack-build` | 构建 BP 发布产物 |

---

## runtime — 业务代码主力

### `debug` — 统一日志门面

```ts
import { debug } from "@sfmc/sdk/sapi/runtime";
debug.i("LAND", "load");          // info
debug.w("LAND", "stale cache");   // warn
debug.e("LAND", "db unreachable");// error
```

`debug.i/w/e` 输出受 `setDebugLevel("INFO" | "WARN" | "ERROR")` 控制。生产环境默认 ERROR。

### `Command` — 命令注册

```ts
import { Command } from "@sfmc/sdk/sapi/runtime";

Command.register(
  "transfer",                       // 命令字面
  "economy.transfer",               // 权限节点
  (player) => { /* ... */ },        // handler(可以是 async)
  "转账给其他玩家",                  // 帮助文本
  "economy"                         // 可选分类
);
```

BP 启动期调用一次。注册过的命令走 `moduleGuard`,被禁用的模块命令会被自动拒绝。

### `Permission` — 权限节点

```ts
import { Permission } from "@sfmc/sdk/sapi/runtime";

Permission.register("land.create", Permission.Admin);  // 0=Any 1=Member 2=OP 3=Admin
Permission.check(player, "land.create");              // boolean
```

### `Msg` — 玩家消息 + 系统频道

```ts
import { Msg } from "@sfmc/sdk/sapi/runtime";

Msg.info("加载完成。", player);     // §f[*]
Msg.success("保存成功。", player);   // §a[√]
Msg.warning("背包已满。", player);   // §e[!]
Msg.error("指令失败。", player);     // §c[×]
Msg.tips("提示:输入 /menu 打开面板。", player);
```

> **永远**用 `Msg.*` 而不是 `player.sendMessage()` —— 这些方法会自动带前缀色码、播放音效、并把消息转发到系统频道。

### `HttpDB` — db-server HTTP 客户端

```ts
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

await HttpDB.get("/api/sfmc/lands");                    // string | null
await HttpDB.post("/api/sfmc/scoreboards", { entries });
await HttpDB.put(`/api/sfmc/players/${playerId}`, body);
await HttpDB.delete(`/api/sfmc/lands/${id}`, { actorId });

// 精细控制(method enum + status code)
import { HttpRequestMethod } from "@minecraft/server-net";
const r = await HttpDB.requestJSON(
  HttpRequestMethod.POST, "/api/sfmc/economy/transaction", payload
);
if (r.status === 0) throw new Error("db-server unreachable");
const json = JSON.parse(r.body);
```

`HttpDB` 自动走 `127.0.0.1:3001`,失败返回 null / status=0。

### `Money` — 本地账本缓存 + 远程账本协调

```ts
import { Money } from "@sfmc/sdk/sapi/runtime";

const balance = Money.get(player);                      // 同步,缓存命中
const fresh = await Money.load(player);                 // 异步,刷新缓存
Money.setCached(player, 100, version);                  // 写本地缓存
await Money.commit(player, -50, reason);                 // 提交到 db-server
```

`Money.UNIT` 是货币单位字符串,所有显示文本自动拼接。

### `MenuNavigator` / `FormStatus` — 表单状态机

```ts
import { MenuNavigator, FormStatus, obsStr } from "@sfmc/sdk/sapi/runtime";

const nav = new MenuNavigator(player);
nav.section("main", "主菜单", (page) => {
  page.label("选择一个操作");
  page.button("打开背包", () => nav.go("inventory"));
});
nav.section("inventory", "背包", (page) => {
  page.label(obsStr(""));
  const qty = obsStr("");
  page.textField("数量", qty);
  const status = new FormStatus(page);
  page.button("确认", () => {
    if (!qty.getData().trim()) { status.fail("数量无效"); return; }
    status.ok("已提交");
  });
});
nav.start("main");
```

`MenuNavigator` 自动处理「返回上级」按钮、`obsStr/Num/Bool` 是响应式数据源,FormStatus 自动渲染成功/失败 toast。

### 工具函数

```ts
import {
  pointInArea_2D,      // (x, z, ax, az, bx, bz) => boolean
  getRandomInteger,    // (min, max) => number
  getShanghaiTime,     // () => { date, time }
  formatTimestamp,     // (ms) => "2026-07-21 14:30:25"
  generateId,          // ("CH"|"M"|"RP"|"L"|"CP") => string
  dimensionId,         // Dimension => 0|1|2
  toQueryString,       // ({k:v}) => "?k=v&k2=v2"
  ListFormInfo,        // (string[]) => "§r§7..." (灰色提示行)
  ensureDoubleChest,   // block-snapshot helper for paired chests
  placeSign,           // sign placement helper
  getLayout,           // block-permutation snapshot helper
  getBase, getChestCardinal, getSignFacing, // facing math
} from "@sfmc/sdk/sapi/runtime";
```

---

## contracts — 共享类型

```ts
import type {
  LandData, LandRole, LandMember, LandPermissions, LandTaxConfig,
  CreateLandRequest, DeleteLandResult, TransferLandResult,
} from "@sfmc/sdk/contracts";

import type {
  Channel, ChannelConfig, ChatMessage, MessageType,
  PlayerChannelSettings, RedPacket,
} from "@sfmc/sdk/contracts";

import type {
  CoopData, CoopMember, CoopBankLog, CoopShopGroup, CoopShopItem,
} from "@sfmc/sdk/contracts";

import type {
  EconomyAccountRow, EconomyTransactionRow, EconomyIdempotencyRow,
} from "@sfmc/sdk/contracts";

import type { PlayerData } from "@sfmc/sdk/contracts";
import type { ScoreboardEntry, Participant, ScoreboardIdentityTypeNumber } from "@sfmc/sdk/contracts";
import type { WorldData } from "@sfmc/sdk/contracts";
import type { ModuleCatalog, ModuleCatalogEntry, ModuleLock, ModuleRuntimeState } from "@sfmc/sdk/contracts";
```

> 子路径模式 `@sfmc/sdk/contracts/<file>` 也可,例如 `@sfmc/sdk/contracts/land`。但日常使用直接 `@sfmc/sdk/contracts` 即可。

---

## host — 平台层适配(进阶)

`@sfmc/sdk/sapi/host` 暴露 host 单例适配器。普通模块不需要直接 import,但如果你写的是「host 模块」(类似 feature-chat 那种替整个 host channel 系统做适配),可以这样用:

```ts
import { apis } from "@sfmc/sdk/sapi/host";
apis.config.get("land:permissions");
apis.config.refresh();
apis.data.request("POST", "/api/sfmc/lands", body);
apis.events.subscribe("world.afterEvents.playerSpawn", handler);
```

> **Stage I**:`apis.data` 内部委托给 `HttpDB`。后续阶段将切换为直接走 module-loader 的内存通道。

---

## sdk — 契约类型(占位)

```ts
import type { SapiHostApis, SapiModuleSurface, defineSapiModule } from "@sfmc/sdk/sapi/sdk";
```

> 当前仅导出 `SFMC_SAPI_SDK_VERSION` 常量。`defineSapiModule` 等契约类型将在后续 commit 引入。

---

## module-loader — entry.ts 专用

```ts
// scriptsforminecraftserver/scripts/entry.ts ONLY
import {
  ConfigManager,                // 读取 configs/*.json,areas/bannedItems
  Modules,                      // 模块启用态快照
  ModuleRegistry,               // bootAll / bootAfterWorldLoad / register / reconcile
  announceLoaded,               // 启动期向 db-server 上报已加载模块
  guardEvent,                   // event 订阅包一层 moduleGuard
  setModuleGuard,               // 把 moduleGuard 注入到 Command/Permission
} from "@sfmc/sdk/module-loader";
```

> 业务模块严禁 import 此抽屉 —— `moduleGuard` 由 entry.ts 注入一次,业务模块只通过 `Command.register` / `Permission.register` 间接受益。

---

## 其他(Node 侧)

- `@sfmc/sdk/logs` — `createLogger({ source, sinks })`,db-server / bds-tools / qq-bridge 共用
- `@sfmc/sdk/node/config` — `resolveRuntimeRoot(fallbackRoot)`、`configDir(root)`、`configPath(root, name)`
- `@sfmc/sdk/behavior-pack-build` — esbuild 入口扫描 + 资源包拷贝 + manifest 发射;由 `tools/emit-manifest.mjs` 间接消费

---

下一步:看 [module-author.zh.md](./module-author.zh.md) 的端到端示例,或 [manifest-contract.zh.md](./manifest-contract.zh.md) 了解契约字段语义。