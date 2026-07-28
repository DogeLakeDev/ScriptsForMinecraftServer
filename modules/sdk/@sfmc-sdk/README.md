# @sfmc-bds/sdk

ScriptsForMinecraftServer 平台 SDK。SAPI/Node umbrella,统一导出:

- **`@sfmc-bds/sdk/contracts`** — 平台级类型契约（模块 catalog / lock）；业务域类型由各模块在 sfmc-modules 内维护
- **`@sfmc-bds/sdk/sapi/runtime`** — SAPI 进程内运行时:`Msg` / `Command` / `Permission` / `MenuNavigator` / `Money` / `debug`
- **`@sfmc-bds/sdk/sapi/diagnostics`** — BDS Sentry 可选接入（经 `debug` sink；`SENTRY_DSN` 缺省关闭）
- **`@sfmc-bds/sdk/sapi/db`** — 数据库友好 API:`db.defineTable` / `db.tx` / `db.query` / `db.audit` / `db.idempotent`
- **`@sfmc-bds/sdk/sapi/config`** — 模块配置:`config.get` / `config.set` / `config.onChange`
- **`@sfmc-bds/sdk/sapi/service`** — 跨模块调用:`service.get` / `service.list`
- **`@sfmc-bds/sdk/sapi/host`** — 平台 host adapter 注入面(仅 BP 构建期使用)
- **`@sfmc-bds/sdk/sapi/sdk`** — SAPI 侧 SDK 聚合入口
- **`@sfmc-bds/sdk/module-loader`** — `ModuleRegistry.register` / `installHostBootstrap`
- **`@sfmc-bds/sdk/node/...`** — Node 进程内 SDK(db-server / qq-bridge / bds-tools / sfmc 自身)
- **`@sfmc-bds/sdk/behavior-pack-build`** — BP 构建期类型与工具
- **`@sfmc-bds/sdk/logs`** — 平台统一的日志/格式化/输出器
- **`@sfmc-bds/sdk/testing`** — 模块 lifecycle 测试 harness：`createFakePlayer` / `createFakeWorld` / `createFakeDb` / `runLifecycle`，让模块在 `node --test` 中跑 register/init/cleanup 而不需真实 BDS

## 安装

```bash
npm install @sfmc-bds/sdk
```

## 模块作者使用

```typescript
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { db } from "@sfmc-bds/sdk/sapi/db";
import { service } from "@sfmc-bds/sdk/sapi/service";
import { config } from "@sfmc-bds/sdk/sapi/config";
import { Permission, Msg, debug } from "@sfmc-bds/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "my-module",
  afterWorldLoad: false,
  lifecycle: {
    async init() {
      await db.defineTable("my_table", {
        id: { type: "text", primary: true },
        created_at: { type: "integer", notNull: true },
      });
      await db.tx(async (tx) => {
        await tx.insert("my_table", { id: "row-1", created_at: Date.now() });
        await tx.audit("my_table", "row-1", "create");
      });
      const lands = await service.get("land.listByOwner", { ownerId: "abc" });
    },
  },
});
```

## 模块测试（无需 BDS）

```typescript
// test/my-module.test.ts（用 tsx 或 node --import tsx 跑）
import { test } from "node:test";
import assert from "node:assert/strict";
import entry from "../sapi/src/index.ts";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import {
  createFakePlayer,
  createFakeWorld,
  createFakeDb,
  assertMsg,
} from "@sfmc-bds/sdk/testing";

test("smoke: register + init 不抛", async () => {
  const world = createFakeWorld();
  const db = createFakeDb();
  /* harness 直接调 lifecycle 钩子，绕过 ConfigManager/ModuleRegistry 启动门禁 */
  const desc = ModuleRegistry.list().find((d) => d.id === "my-module");
  await desc.lifecycle.registerPermissions?.();
  await desc.lifecycle.registerCommands?.();
  await desc.lifecycle.init?.();
  assert.ok(true);
});
```

> `runLifecycle(descriptor, opts)` 提供更结构化入口（按 afterWorldLoad 决定是否跑 init，返回 `{ ok, error }`）。模块若依赖 db/config/service，须在用例里 stub；harness 不会自动替身。

## 平台规则

1. **模块不写 SQL**。只通过 `db.tx()` / `db.query()` 走 `WhereExpr` 表达式树。
2. **模块不直连 db-server**。只通过 `service.get()` / `db.*` 走平台 SDK。
3. **模块作者写 `sapi/manifest.json`** 声明 schemaVersion=2 + permissions + services.requires。
4. **跨模块调用必须在 `manifest.services.requires`** 列名,平台启动期校验。

## 版本

`0.1.x` 是首个公开发布版本，SDK 与 [DogeLakeDev/ScriptsForMinecraftServer](https://github.com/DogeLakeDev/ScriptsForMinecraftServer) 主仓独立 semver；发布 tag 形如 `@sfmc-bds/sdk@v0.1.0`。

## License

ISC