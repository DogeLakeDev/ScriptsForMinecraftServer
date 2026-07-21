# SDK API 索引

> `@sfmc/sdk` 是平台官方 npm 包,作为伞包暴露 v2 协议的全部能力。模块作者**只**看四个子路径:`sapi/runtime` / `sapi/db` / `sapi/config` / `sapi/service`。其余抽屉(`host` / `module-loader` / `node/*` / `behavior-pack-build`)供平台与构建器自身使用。

## 抽屉速览

| 抽屉 | 子路径 | 谁该用 |
|------|--------|--------|
| runtime | `@sfmc/sdk/sapi/runtime` | 90% 业务代码 |
| **db** | `@sfmc/sdk/sapi/db` | 一切数据库读写 |
| **config** | `@sfmc/sdk/sapi/config` | 一切配置读写 |
| **service** | `@sfmc/sdk/sapi/service` | 一切跨模块调用 |
| contracts | `@sfmc/sdk/contracts` | 跨 SAPI / db-server 共享类型 |
| module-loader | `@sfmc/sdk/module-loader` | BP 入口:ModuleRegistry.register / installHostBootstrap |
| host | `@sfmc/sdk/sapi/host` | 平台层适配(普通模块不直接 import) |
| logs | `@sfmc/sdk/logs` | Node 服务日志 |
| node/config | `@sfmc/sdk/node/config` | Node 服务定位 configs/data |
| node/sdk | `@sfmc/sdk/node/sdk` | Node 服务统一能力面 |
| behavior-pack-build | `@sfmc/sdk/behavior-pack-build` | 构建 BP 发布产物 |

---

## runtime — 业务代码主力

```ts
import { debug, Msg, Command, Permission, MenuNavigator, Money, FormStatus, ListFormInfo } from "@sfmc/sdk/sapi/runtime";
```

### `debug` — 统一日志门面

```ts
debug.i("LAND", "load");          // info
debug.w("LAND", "stale cache");   // warn
debug.e("LAND", "db unreachable");// error
```

### `Msg` — 玩家消息(用这个,别用 player.sendMessage)

```ts
Msg.info("提示", player);
Msg.success("成功", player);
Msg.error("失败", player);
Msg.warning("警告", player);
Msg.tips("小贴士", player);
```

内部会处理前缀 (§f[*] / §a[√] / etc.)、音效、转发系统频道。

### `Command` / `Permission`

```ts
Permission.register("land.use", Permission.Any);
Permission.register("land.admin", Permission.OP);
Permission.register("land.op", Permission.Member);

Command.register("mylcmd", "land.use", (player) => { /* ... */ }, "我的命令");
```

Permission 等级:`Any=0` / `Member=1` / `OP=2` / `Admin=3`。

### `MenuNavigator` / `FormStatus` / `ListFormInfo` — UI

```ts
const nav = new MenuNavigator(player);
nav.section("home", "首页", (page) => { page.label("..."); page.button("进入", () => nav.rebuild("next")); });
nav.start("home");
```

### `Money` — 经济抽象

```ts
const balance = await Money.load(player);
if (balance < price) { ... }
Money.setCached(player, newBalance, version);
```

---

## db — 数据库友好 API ⭐

```ts
import { db, DbError, type TxContext, type WhereExpr } from "@sfmc/sdk/sapi/db";
```

### 表定义

```ts
await db.defineTable("my_table", {
  id: { type: "text", primary: true },
  owner_player_id: { type: "text", notNull: true, index: true },
  created_at: { type: "integer", notNull: true },
  expires_at: { type: "integer" },
  version: { type: "integer", default: 1 },
}, { softDelete: true });
// softDelete=true 自动添加 _deleted_at / _version 字段
```

`ColumnDef.type` ∈ `"text" | "integer" | "real" | "blob"`,可选 `primary?` / `notNull?` / `default?` / `index?` / `unique?`。

### 单次读写(只能跑在事务外)

```ts
const rows = await db.query<MyRow>("my_table", {
  where: { eq: ["status", "active"] },
  orderBy: { field: "created_at", dir: "desc" },
  limit: 50,
});
const one = await db.get<MyRow>("my_table", "row-1");
await db.insert("my_table", { id: "row-1", ... });
await db.update("my_table", "row-1", { status: "active" });
await db.delete("my_table", "row-1");         // 软删
await db.delete("my_table", "row-1", { hard: true });  // 硬删
```

### 事务(一切写操作走这里)

```ts
await db.tx(async (tx: TxContext) => {
  await tx.insert("lands", { id: "L1", ... });
  await tx.update("land_members", "lm-1", { role: "admin" });
  await tx.audit("lands", "L1", "transfer", { from: "A", to: "B" });
  // 跨模块调用,在事务内执行,失败回滚
  await tx.call("economy.debit", { playerId: "A", amount: 100 });
  return { ok: true };
});
```

`tx.fn` 抛错 = 自动 ROLLBACK,return = COMMIT。步骤顺序由代码顺序决定。

### WhereExpr

```ts
type WhereExpr =
  | { eq: [field, value] }
  | { ne: [field, value] }
  | { gt: [field, value] } | { gte: [field, value] }
  | { lt: [field, value] } | { lte: [field, value] }
  | { like: [field, pattern] }
  | { in: [field, values[]] }
  | { isNull: [field] }   | { isNotNull: [field] }
  | { and: WhereExpr[] }  | { or: WhereExpr[] }  | { not: WhereExpr };
```

不允许写 SQL 字符串。所有表达式翻译成 prepared statement。

### 平台预置

```ts
await db.audit("lands", "L1", "transfer", { from, to });
const result = await db.idempotent("land.transfer", requestId, async () => {
  // 同 requestId 不会重复执行
  return await doTransfer();
});
```

### DbError

```ts
catch (e) {
  if (e instanceof DbError) {
    console.log(e.code, e.status, e.message);
  }
}
```

---

## config — 模块配置 ⭐

```ts
import { config } from "@sfmc/sdk/sapi/config";
```

```ts
const cfg = await config.get<{ minSquare: number; maxSquare: number }>("land.config");
cfg.minSquare;  // typed
await config.set("land.config", "maxSquare", 200);
config.onChange("land.config", (key, value) => {
  // SAPI 进程内通知(同一进程所有模块都能收到)
});
```

**注意**:`config.get` 走 cache,首次调时一次性拉全 configKey 的 `configs/<key>.json` 进内存,后续走内存读。`config.set` 立刻更新内存 + 异步持久化到 db-server。

---

## service — 跨模块调用 ⭐

```ts
import { service } from "@sfmc/sdk/sapi/service";
```

```ts
// 调一个服务
const land = await service.get<{ id: string; name: string } | null>("land.byId", { landId: "L1" });

// 列出所有已注册服务
const all = await service.list();  // [{ name, moduleId }, ...]
```

**事务内调用**:用 `tx.call("service.name", input)`,不要在事务内用 `service.get`。`tx.call` 跟当前事务原子提交/回滚。

**授权**:`manifest.services.requires` 必须声明要调用的 service,否则 db-server 启动期 throw。

---

## contracts — 共享类型

```ts
import type { LandData, CoopData, Channel } from "@sfmc/sdk/contracts";
```

跨 SAPI / db-server 共享的类型。**不要**自己造轮子。需要新类型先在 contracts 里加。

---

## module-loader — BP 入口

```ts
import { ModuleRegistry, installHostBootstrap } from "@sfmc/sdk/module-loader";
```

```ts
// main.ts 顶层
installHostBootstrap({ dbServerUrl: "http://127.0.0.1:3001" });

// 每个模块 sapi/src/index.ts
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
ModuleRegistry.register({
  id: "feature-mine",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() { Permission.register("mine.use", Permission.Any); },
    async init() { /* db.defineTable, etc. */ },
    cleanup() {},
  },
});
```

---

## node/* — 平台进程内部

`@sfmc/sdk/node/*` 供 db-server / qq-bridge / bds-tools / sfmc 自身使用。模块作者**不要** import 这些子路径(在 SAPI 进程内根本拿不到)。

---

## 协议版本

```ts
import { SFMC_SAPI_DB_VERSION } from "@sfmc/sdk/sapi/db";
// → "0.1.0"
```

db 子路径当前版本。后续 v0.2 协议不兼容时 bump 此常量 + 平台启动期 throw。

---

下一步:看 [manifest 契约](./manifest-contract.zh.md) 或 [模块作者指南](./module-author.zh.md)。