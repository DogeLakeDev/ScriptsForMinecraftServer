# SAPI 模块作者指南

> 面向 `modules/packages/<id>/sapi/` 下编写新模块的开发者。本文以 `feature-economy` 为参考实现,但所有约定都适用于新增或重构模块。

## 1. 模块放置位置

```
modules/
  catalog.json                       ← 注册表(必须新增一行)
  module-lock.json                   ← 运行期启用态,由 db-server 写入
  packages/
    <id>/
      package.json                   ← npm workspace
      sapi/
        manifest.json                ← 模块契约,见 docs/dev/manifest-contract.zh.md
        src/
          index.ts                   ← 入口,export 生命周期类 / 函数
          ...其他源文件
      resource_pack/                 ← (可选)资源包内容,构建时合并
```

**关键约束**:
- `id` 在 `modules/catalog.json` 内必须唯一,小写连字符
- `entry.path` 固定为 `modules/packages/<id>/sapi/src/index.ts`
- 模块**只在** BP 启动期被 `scripts/main.js`(由 `sfmc behavior-pack build` 聚合而成)通过 `ModuleRegistry.register(...)` 拉起;不要在模块内写顶层副作用,所有副作用放进生命周期回调

## 2. 模块契约 —— 你需要 export 什么

`@sfmc/sdk/module-loader` 的 `ModuleRegistry` 期望一个 lifecycle 对象,字段**全部可选**:

```ts
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { Player } from "@minecraft/server";

export class MyModule {
  // 命令注册。startup 阶段调用一次。
  static registerCommands(): void {
    Permission.register("mymodule.use", Permission.Member);
    Command.register(
      "mycommand",        // 命令字面
      "mymodule.use",     // 权限节点
      (player?: Player) => { /* ... */ },
      "我的命令",          // 帮助文本
      "category"          // 可选分类(主菜单中归组)
    );
  }

  // 事件订阅。worldLoad 阶段调用一次。
  static registerEvents(): void {
    // 订阅 world.afterEvents.* / world.beforeEvents.*
  }

  // startup 阶段最后调用。同步执行。
  static init(): void {
    debug.i("MYMOD", "init");
  }

  // worldLoad 阶段调用(afterWorldLoad=true 的模块)。
  static initAfterWorldLoad(): void {
    debug.i("MYMOD", "initAfterWorldLoad");
  }

  // 关服时调用。反订阅 + 释放定时器。
  static cleanup(): void {
    // ...
  }
}
```

> entry.ts 模板:
> ```ts
> ModuleRegistry.register({
>   id: "mymodule",
>   afterWorldLoad: true,
>   lifecycle: {
>     registerCommands: () => MyModule.registerCommands(),
>     registerEvents: () => MyModule.registerEvents(),
>     init: () => MyModule.init(),
>     initAfterWorldLoad: () => MyModule.initAfterWorldLoad(),
>     cleanup: () => MyModule.cleanup(),
>   },
> });
> ```
>
> `registerCommands` 在 startup 阶段执行(在 `system.beforeEvents.startup` 期间);`init` 也在 startup,但顺序在 commands 之后;`registerEvents` 与 `initAfterWorldLoad` 都在 `world.afterEvents.worldLoad` 期间触发。

## 3. SDK 三抽屉

| 抽屉 | 子路径 | 用途 |
|------|--------|------|
| **runtime** | `@sfmc/sdk/sapi/runtime` | 工具类:`Command`、`Permission`、`Msg`、`debug`、`MenuNavigator`、`Money`、`HttpDB`、`FormStatus`、`Observable*` 等 |
| **host** | `@sfmc/sdk/sapi/host` | 平台层适配器。普通模块不需要直接 import |
| **sdk** | `@sfmc/sdk/sapi/sdk` | 模块契约类型(`SapiHostApis`、`defineSapiModule` 等占位)。当前阶段占位,后续 commit 引入 |
| **contracts** | `@sfmc/sdk/contracts` | 跨 SAPI 与 db-server 的共享类型(`LandData`、`CoopData`、`Channel` 等) |
| **module-loader** | `@sfmc/sdk/module-loader` | BP 入口专用(`ConfigManager`、`ModuleRegistry`、`announceLoaded`、`guardEvent`)。**只有 `scripts/entry.ts` import**;业务模块不要 import |

**实战建议**:
- 90% 的代码只 import `@sfmc/sdk/sapi/runtime`
- 跨模块共享类型从 `@sfmc/sdk/contracts` 取
- 需要 HTTP 调用 db-server 时用 `HttpDB.get / post / requestJSON`,不要直接 `fetch`

## 4. manifest.json 字段

```json
{
  "handlers": [],
  "routes": [
    { "method": "GET", "path": "/api/sfmc/lands", "handler": "lands:list" }
  ],
  "migrations": []
}
```

| 字段 | 含义 |
|------|------|
| `handlers` | 阶段 I 留空。后续阶段 db-server 的 handler-registry 会查这张表 |
| `routes` | 你模块从 SAPI 调用 db-server 的所有路由。method + path + handler 名 |
| `migrations` | 你模块需要的 db-server 迁移名(version 升序)。留空表示无 schema 变更 |
| `notes`(可选) | 自由文本注释 |

> **必填** —— 即便你不调用 db-server,也写一个空 manifest:`{ "handlers": [], "routes": [], "migrations": [] }`,否则 emit-manifest 不会列出你的模块。
> 详见 [manifest-contract.zh.md](./manifest-contract.zh.md)

## 5. catalog.json 新增一行

```json
{
  "id": "feature-mymodule",
  "configKey": "mymodule",
  "name": "我的模块",
  "type": "feature",
  "description": "一句话描述",
  "enabledByDefault": false,
  "canDisable": true,
  "requires": [],
  "entry": { "kind": "sapi", "path": "modules/packages/mymodule/sapi/src/index.ts" }
}
```

字段说明:
- `id`:全仓唯一,推荐前缀 `core-` / `feature-`
- `configKey`:在 `configs/mymodule.json` 中的 key,对应 `ConfigManager.getConfigs("mymodule")`
- `enabledByDefault`:首次启动时是否默认启用
- `requires`:依赖的 `id` 列表(拓扑排序)
- `entry.path`:固定前缀 `modules/packages/...`

> `node tools/check-catalog.js` 会在提交前校验 id 唯一性、entry.path 存在、entry.ts 已注册。如果报 "expected id 'mymodule' 未在 entry.ts 注册 ModuleRegistry 生命周期",说明你忘了在 entry.ts 加 `ModuleRegistry.register(...)`。

## 6. package.json

```json
{
  "name": "@sfmc/module-mymodule",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "sapi/src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  },
  "dependencies": {
    "@sfmc/sdk": "*"
  }
}
```

`name` 必须是 `@sfmc/module-<id>`(id 与 catalog.json 一致),否则 `entry.ts` 的 `import { ... } from "@sfmc/module-<id>"` 解析不到。

## 7. tsconfig.json

直接复用兄弟模块的:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./sapi/src",
    "outDir": "./dist",
    "types": ["@minecraft/server"]
  },
  "include": ["sapi/src/**/*"]
}
```

## 8. 调试流程

```bash
# 1) 类型检查
cd modules/packages/mymodule
npm run typecheck

# 2) 全仓行为包构建
sfmc behavior-pack build    # esbuild 聚合模块 → build/sfmc-modules/

# 3) 启动 db-server(确保 manifest 加载)
cd ../../db-server
npm run dev

# 4) 看启动日志确认
# [manifest] loaded schemaVersion=1 modules=22 routes=34
# 如果你的 manifest 写了新 route 但 db-server 没覆盖,会出现
# [manifest] WARN feature-mymodule: route POST /api/sfmc/foo is not covered by db-server
```

## 9. 提交规范

```
<type>(scope): <subject>

<body — 解释 why,不写 what>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

`<type>` 限定:
- `feat(<id>):` — 新模块或新功能
- `fix(<id>):` — bug 修复
- `refactor(<id>):` — 重构(行为不变)
- `docs(<id>):` — 仅文档变更
- `chore(<id>):` — 工具/构建/格式化

## 10. 常见错误

| 现象 | 原因 |
|------|------|
| `npm run bundle` 报 `Could not resolve "@sfmc/module-mymodule"` | catalog `entry.path` 与 `package.json#name` 不一致,或忘了 `npm install` |
| 启动后模块没生效 | `ModuleRegistry.register` 没加,或 `id` 拼写不一致 |
| 启动日志没出现新模块名 | manifest.json 缺失或字段名错(必须是 `handlers`/`routes`/`migrations`) |
| TypeScript 报 "Cannot find name 'ConfigManager'" | import 错了抽屉。`ConfigManager` 在 `@sfmc/sdk/module-loader`,不在 runtime |
| 命令注册后不响应 | 大概率模块被 `moduleGuard` 拒绝,查 `modules/module-lock.json` 看 `enabled` 字段 |

## 11. 端到端模板

最小可工作新模块的目录骨架:

```
modules/packages/hello/
├── package.json
├── tsconfig.json
└── sapi/
    ├── manifest.json
    └── src/
        └── index.ts
```

`modules/packages/hello/package.json`:
```json
{
  "name": "@sfmc/module-hello",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "sapi/src/index.ts",
  "peerDependencies": { "@minecraft/server": "2.10.0-beta.1.26.40-preview.30" },
  "dependencies": { "@sfmc/sdk": "*" }
}
```

`modules/packages/hello/sapi/manifest.json`:
```json
{ "handlers": [], "routes": [], "migrations": [] }
```

`modules/packages/hello/sapi/src/index.ts`:
```ts
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { Player } from "@minecraft/server";

export class Hello {
  static registerCommands(): void {
    Permission.register("hello.use", Permission.Member);
    Command.register(
      "hello",
      "hello.use",
      (player?: Player) => { if (player) Msg.info(`你好,${player.name}!`, player); },
      "打招呼"
    );
  }

  static init(): void { debug.i("HELLO", "init"); }
}
```

随后在 `modules/catalog.json` 加一行,在 `modules/packages/hello/sapi/src/index.ts` 内导出 `ModuleRegistry.register({ id: "hello", ... })`,跑 `sfmc behavior-pack build`。

---

下一步:看 [SDK 三抽屉 API 索引](./sdk-reference.zh.md) 或 [manifest 契约](./manifest-contract.zh.md)。