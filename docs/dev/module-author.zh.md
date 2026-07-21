# SAPI 模块作者指南

> 面向 `Shiroha7z/sfmc-modules` 仓库编写新模块的开发者。本文以
> `feature-land` 与 `feature-land-gui` 为参考实现,展示 v2 协议下模块的完整
> 生命周期。所有新增或重构模块都遵循同一约定。

## 1. 模块放置位置

模块**不再**放在主仓 `modules/packages/` 下。它们居住在独立仓库
[Shiroha7z/sfmc-modules](https://github.com/Shiroha7z/sfmc-modules),每个模块一个子目录:

```
sfmc-modules/
├── packages/
│   ├── <id>/
│   │   ├── package.json              ← @sfmc/module-<id>,依赖 @sfmc/sdk
│   │   ├── sapi/
│   │   │   ├── manifest.json         ← v2 协议契约
│   │   │   ├── tsconfig.json
│   │   │   └── src/
│   │   │       ├── index.ts          ← ModuleRegistry.register 入口
│   │   │       └── ...业务源文件
│   │   ├── configs-default/          ← (可选)默认配置
│   │   └── resource_pack/            ← (可选)资源包内容
│   └── ...
├── index.json                        ← first-party registry(被 fetch-module 读)
├── tools/
│   ├── check-modules.js              ← v2 manifest 校验
│   ├── sync-index.js                 ← index.json 自动同步
│   └── new.sh                        ← 新模块脚手架
```

**关键约束**:
- `id` 在 sfmc-modules 仓内必须唯一,推荐前缀 `core-` / `feature-`
- `package.json#name` 必须是 `@sfmc/module-<id>`,与 manifest `id` 一致
- 模块**只在** BP 启动期被 esbuild 聚合产物通过 `ModuleRegistry.register(...)` 拉起
- 模块**只能**依赖 `@sfmc/sdk` + `@minecraft/server`。不能 import 其它模块的源码

## 2. 创建新模块

最快路径是用脚手架:

```bash
cd sfmc-modules
./tools/new.sh feature-my-thing "我的新模块"
# 生成:
#   packages/feature-my-thing/package.json
#   packages/feature-my-thing/sapi/manifest.json
#   packages/feature-my-thing/sapi/src/index.ts
#   packages/feature-my-thing/sapi/tsconfig.json
#   packages/feature-my-thing/configs-default/config.json
#   index.json (自动同步)
```

脚手架已经填好 v2 manifest 的骨架字段,你在 `manifest.json` 补全
`permissions` + `services`,在 `src/index.ts` 写实际业务。

### 手动创建

如果你不想要脚手架产物(比如已有模板),最小骨架:

```jsonc
// packages/<id>/package.json
{
  "name": "@sfmc/module-<id>",
  "version": "0.1.0",
  "type": "module",
  "main": "sapi/src/index.ts",
  "private": true,
  "dependencies": {
    "@sfmc/sdk": "^0.1.0"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  }
}
```

```json
// packages/<id>/sapi/manifest.json
{
  "schemaVersion": 2,
  "id": "<id>",
  "name": "我的模块",
  "type": "feature",
  "configKey": "<config_key>",
  "requires": [],
  "permissions": [
    "db:read:<table>",
    "db:write:<table>",
    "config:read:<config_key>",
    "config:write:<config_key>"
  ],
  "services": {
    "provides": [],
    "requires": []
  },
  "notes": ""
}
```

```ts
// packages/<id>/sapi/src/index.ts
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "<id>",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("<config_key>.use", Permission.Any);
    },
    async init() {
      // 调 db.defineTable / db.tx / service.get ...
    },
    cleanup() {},
  },
});
```

## 3. manifest v2 字段

| 字段 | 类型 | 必填 | 含义 |
|------|------|------|------|
| `schemaVersion` | `2` | ✓ | 协议版本。其他值启动时 throw 或 warn-skip |
| `id` | string | ✓ | 模块唯一 id |
| `name` | string | ✓ | 显示名(中文/英文) |
| `type` | `"core"` \| `"feature"` | ✓ | 是否可禁用:core=false,feature=true |
| `configKey` | string | ✓ | 对应 `configs/<config_key>.json` |
| `requires` | string[] | ✓ | 依赖模块 id 列表(拓扑排序) |
| `permissions` | string[] | ✓ | 平台权限声明(见下表) |
| `services.provides` | ServiceEntry[] | ✓ | 本模块对外暴露的能力 |
| `services.requires` | ServiceEntry[] | ✓ | 本模块依赖的其它模块的能力 |
| `notes` | string | – | 自由文本 |

**permission 类型**:

| 字串 | 含义 |
|------|------|
| `db:read:<table>` | 读模块声明的表 |
| `db:write:<table>` | 写模块声明的表 |
| `db:read:*` / `db:write:*` | 通配(慎用,需在启动期通过白名单) |
| `config:read:<key>` | 读模块 configKey 命名空间下的配置 |
| `config:write:<key>` | 写模块 configKey 命名空间下的配置 |
| `service:<service_name>` | 声明你**调用**了哪个 service(无 declare 也可调用,但启动期校验会 throw) |

**ServiceEntry**:

```jsonc
{
  "name": "land.byOwner",
  "input":  { "type": "object", "properties": { "ownerId": { "type": "string" } }, "required": ["ownerId"] },
  "output": { "type": "array" }
}
```

`provides` 名字全仓唯一;`requires` 必须能在其它模块的 `provides` 找到(启动期校验)。

**禁止字段**:`routes` / `tables` / `migrations` / `seeds` / `handlers` / `events`。v1 残留,启动 throw。

## 4. SDK 四抽屉

模块作者 90% 的代码只 import 这 4 个子路径:

| 子路径 | 用途 |
|--------|------|
| `@sfmc/sdk/sapi/runtime` | `Msg` / `Command` / `Permission` / `MenuNavigator` / `Money` / `debug` / `HttpDB`(legacy,新代码不要直接用)/ `FormStatus` |
| `@sfmc/sdk/sapi/db` | `db.defineTable` / `db.tx` / `db.query` / `db.get` / `db.insert` / `db.update` / `db.delete` / `db.audit` / `db.idempotent` |
| `@sfmc/sdk/sapi/config` | `config.get` / `config.set` / `config.onChange` |
| `@sfmc/sdk/sapi/service` | `service.get` / `service.list`(跨模块调用) |
| `@sfmc/sdk/module-loader` | `ModuleRegistry.register`(业务模块只 import 这一个 symbol) |
| `@sfmc/sdk/contracts` | 跨模块共享类型(平台提供的契约,不自己造轮子) |

**规则**:
- **不允许** `require("fs")` / `fetch()` / 直连 db-server 端口。只能走 SDK
- **不允许** 写 SQL 字符串。只能写 `WhereExpr` 表达式树
- **不允许** import 其它模块的源码。跨模块调用一律 `service.get(...)`

## 5. 端到端示例(以 land 为例)

`land` 模块提供 13 个 service,land-gui 是它的消费方:

```ts
// modules/packages/land/sapi/src/land-transfer.ts
import { db, type TxContext, DbError } from "@sfmc/sdk/sapi/db";

export async function transferLand(input: { landId: string; currentOwnerId: string; newOwnerId: string }) {
  return db.tx(async (tx: TxContext) => {
    await tx.update("lands", input.landId, { owner_player_id: input.newOwnerId, version: 2 });
    await tx.audit("lands", input.landId, "transfer", { from: input.currentOwnerId, to: input.newOwnerId });
    await tx.call("economy.debit", { playerId: input.currentOwnerId, amount: 100 });
    await tx.call("economy.credit", { playerId: input.newOwnerId, amount: 100 });
    return { ok: true };
  });
}
```

```ts
// modules/packages/land-gui/sapi/src/index.ts
import { service } from "@sfmc/sdk/sapi/service";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

ModuleRegistry.register({
  id: "feature-land-gui",
  afterWorldLoad: false,
  lifecycle: {
    async init() {
      const land = await service.get<{ id: string; name: string } | null>("land.byId", { landId: "abc" });
      // 渲染 GUI
    },
  },
});
```

`land-gui/sapi/manifest.json` 必须声明 `requires: ["feature-land"]` + `services.requires: [{ name: "land.byId" }]` —— 启动期校验,漏声明直接 throw。

## 6. 本地开发

```bash
# 1) 在主仓 + sfmc-modules 仓下都跑
cd ../ScriptsForMinecraftServer
git clone git@github.com:Shiroha7z/ScriptsForMinecraftServer.git
# 同时克隆 sfmc-modules 仓,放在同级目录
# D:/#WorkPlace/
# ├── ScriptsForMinecraftServer/   (主仓)
# └── sfmc-modules/                 (模块仓)

# 2) 让你的模块的 @sfmc/sdk 解析到本地 SDK(无需发布)
cd ../sfmc-modules
cd packages/land
npm link ../../ScriptsForMinecraftServer/modules/sdk/@sfmc-sdk
# 现在 import "@sfmc/sdk/sapi/db" 直接指向 SDK 源码

# 3) typecheck
cd packages/land
npm run typecheck

# 4) 把模块软链到主仓的 modules/packages/<id>/,BP 构建会自动拉到
cd ../../ScriptsForMinecraftServer
mkdir -p modules/packages
ln -s ../../sfmc-modules/packages/land modules/packages/land

# 5) 跑 BP 构建 + db-server
sfmc behavior-pack build
sfmc behavior-pack deploy
```

## 7. 发布模块

sfmc-modules 仓用 GitHub Releases 发布模块 tarball:

```bash
# 在 sfmc-modules 仓下
git tag -a v1.2.3  # tag 整个仓
git push origin v1.2.3
# CI 跑 tools/check-modules.js 校验 + 打包每个 packages/* → 上传 GitHub Release
```

发布后:

```bash
# 主仓 / 用户端
node tools/fetch-module.mjs install <id>   # 自动解析 GitHub Release URL + 拉 tarball
# 写入 modules/packages/<id>/,更新 modules/module-lock.json
```

## 8. 调试技巧

- 启动日志看 `[manifest v2] loaded N modules; provides M services`,N = 你的 v2 manifest 数,M = provides 总数
- 如果你的模块被 `warn-skip`,日志里会有 `[manifest] <id>: moduleId=... schemaVersion=... (需要 2),跳过`
- `service.get` 失败时检查 manifest `services.requires` 是否漏声明
- `db.tx` 内 step 顺序由代码顺序决定,不要假设 server 端会重排

## 9. 提交规范

```
<type>(<scope>): <subject>

<body — 解释 why,不写 what>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

`<type>`:
- `feat(<id>):` — 新功能
- `fix(<id>):` — bug 修复
- `refactor(<id>):` — 重构
- `docs(<id>):` — 仅文档
- `chore(<id>):` — 工具/构建/CI

## 10. 常见错误

| 现象 | 原因 |
|------|------|
| 启动日志 `moduleId=... schemaVersion=... (需要 2),跳过` | 你的 manifest 写了 `schemaVersion: 1` 或没写 |
| `service.get("xxx")` 返回 403 | 漏声明 `services.requires` 或 `permissions` 没 `service:xxx` |
| `db.defineTable` 后 `db-server` 启动报 `table X already registered by another module` | 两个模块声明了同名表 —— 找平台协商 |
| esbuild 报 `Could not resolve "@sfmc/module-X"` | `package.json#name` 与目录名/id 不一致 |
| BP 构建后 BDS 启动报 `module X not found in catalog` | 主仓 `modules/catalog.json` 没加你的模块条目,或 `entry.path` 错 |

---

下一步:看 [SDK API 索引](./sdk-reference.zh.md) 或 [manifest 契约详情](./manifest-contract.zh.md)。