# @sfmc/sdk

ScriptsForMinecraftServer 平台 SDK。SAPI/Node umbrella,统一导出:

- **`@sfmc/sdk/contracts`** — 跨模块共享类型契约(land / chat / coop / economy / player / world / 等)
- **`@sfmc/sdk/sapi/runtime`** — SAPI 进程内运行时:`Msg` / `Command` / `Permission` / `MenuNavigator` / `Money` / `debug`
- **`@sfmc/sdk/sapi/db`** — 数据库友好 API:`db.defineTable` / `db.tx` / `db.query` / `db.audit` / `db.idempotent`
- **`@sfmc/sdk/sapi/config`** — 模块配置:`config.get` / `config.set` / `config.onChange`
- **`@sfmc/sdk/sapi/service`** — 跨模块调用:`service.get` / `service.list`
- **`@sfmc/sdk/sapi/host`** — 平台 host adapter 注入面(仅 BP 构建期使用)
- **`@sfmc/sdk/sapi/sdk`** — SAPI 侧 SDK 聚合入口
- **`@sfmc/sdk/module-loader`** — `ModuleRegistry.register` / `installHostBootstrap`
- **`@sfmc/sdk/node/...`** — Node 进程内 SDK(db-server / qq-bridge / bds-tools / sfmc 自身)
- **`@sfmc/sdk/behavior-pack-build`** — BP 构建期类型与工具
- **`@sfmc/sdk/logs`** — 平台统一的日志/格式化/输出器

## 安装

```bash
npm install @sfmc/sdk
```

## 模块作者使用

```typescript
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { db } from "@sfmc/sdk/sapi/db";
import { service } from "@sfmc/sdk/sapi/service";
import { config } from "@sfmc/sdk/sapi/config";
import { Permission, Msg, debug } from "@sfmc/sdk/sapi/runtime";

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

## 平台规则

1. **模块不写 SQL**。只通过 `db.tx()` / `db.query()` 走 `WhereExpr` 表达式树。
2. **模块不直连 db-server**。只通过 `service.get()` / `db.*` 走平台 SDK。
3. **模块作者写 `sapi/manifest.json`** 声明 schemaVersion=2 + permissions + services.requires。
4. **跨模块调用必须在 `manifest.services.requires`** 列名,平台启动期校验。

## 版本

`0.1.x` 是首个公开发布版本,SDK 与 `Shiroha7z/ScriptsForMinecraftServer` 主仓 `main` 分支同步打 tag。

## License

ISC