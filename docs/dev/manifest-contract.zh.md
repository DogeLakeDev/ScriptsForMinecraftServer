# manifest 契约

> `manifest.json` 是 BP 构建产物 `build/sfmc-modules/manifest.json` 的「单模块源」。每个模块在 `modules/packages/<id>/sapi/manifest.json` 手写一份,由 `sfmc behavior-pack build` 聚合时合并。

## 1. 完整 schema

```ts
// db-server/src/manifest.ts 的形状(只读契约)
interface ModuleManifestRoute {
  method: string;          // "GET" | "POST" | "PUT" | "DELETE"
  path: string;            // "/api/sfmc/lands" 或 "/api/sfmc/lands/:id/members"
  handler: string;         // "<moduleId>:<handlerName>" 形式
}

interface ModuleManifestMigration {
  name: string;            // "create_lands_table"
  version: number;         // 升序,1, 2, 3, ...
}

interface ModuleManifestEntry {
  name: string;            // 显示名,中文/英文均可
  type: string;            // "core" | "feature"
  configKey: string;       // 对应 configs/<key>.json
  requires: string[];      // 依赖的模块 id(拓扑排序用)
  handlers: string[];      // db-server 侧 handler 名字,阶段 I 留空
  routes: ModuleManifestRoute[];
  migrations: ModuleManifestMigration[];
}

interface ModuleManifest {
  schemaVersion: number;   // 当前 = 1
  generatedAt: string;     // ISO 8601 时间戳
  modules: Record<string, ModuleManifestEntry>;  // keyed by 模块 id
}
```

## 2. 字段语义

### `routes[].method`

只接受 `GET` / `POST` / `PUT` / `DELETE`。`PATCH` 当前阶段 db-server 没有等价 `app.patch`,建议改用 POST + `_method=PATCH` 形式。

### `routes[].path`

可以是精确路径(`/api/sfmc/lands`)或带参数占位符(`/api/sfmc/lands/:id/members`)。
> **占位符必须用 `:name` 形式**(冒号前缀),不要用 Express 5 风格的 `{name}` 或 wildcard。

db-server 启动时会按前 4 段做前缀匹配(`/api/sfmc/lands` 命中 `/api/sfmc/lands/:id/...`),所以精确前缀必须出现在 path 里。

### `routes[].handler`

`<moduleId>:<handlerName>` 形式。例如 `lands:list`、`lands:create`、`economy:transfer`。

`moduleId` 必须与 catalog.json 的 `id` 一致;`handlerName` 是 db-server 端 handler-registry 中的注册名(Stage I 留空数组 `handlers: []`,留待 Stage J+ 引入)。

### `migrations[]`

如果你修改了 db-server 的 schema,在这里登记 migration 名 + 版本号。db-server 启动时按 version 升序应用,写 `_migrations` 表。

```json
{
  "migrations": [
    { "name": "create_lands_table", "version": 1 },
    { "name": "add_land_tax_config", "version": 2 }
  ]
}
```

> 不写 = 你声明这个模块不需要 schema 变更(例如纯只读 HTTP 客户端)。

### `notes`(可选,非 schema 字段)

`emit-manifest.mjs` 不读 `notes`,但它会**原样保留**到 `module-manifests.json`。可用作模块自描述:

```json
{
  "handlers": [],
  "routes": [],
  "migrations": [],
  "notes": "feature-foo: 纯游戏侧逻辑,不调用 db-server"
}
```

## 3. db-server 怎么读 manifest

`db-server/src/index.ts` 启动期执行:

```ts
const m = loadManifest();
log.info(`[manifest] loaded schemaVersion=${m.schemaVersion} modules=${...} routes=${...}`);
const warnings = reconcile(m, KNOWN_PREFIXES);
if (warnings.length > 0) for (const w of warnings) console.warn(`[manifest] WARN ${w}`);
```

`reconcile` 检查每个 route 的前 4 段 path 是否落在 `KNOWN_PREFIXES` 里。前缀不匹配 → WARN 但不阻塞启动。

当前 `KNOWN_PREFIXES`(由 db-server 实际 `routes/*.ts` 文件覆盖范围决定):

```
/api/sfmc/activities     /api/sfmc/channels
/api/sfmc/configs        /api/sfmc/coop /api/sfmc/coops
/api/sfmc/economy        /api/sfmc/health
/api/sfmc/lands          /api/sfmc/messages
/api/sfmc/modules        /api/sfmc/monitor
/api/sfmc/players        /api/sfmc/redpacket
/api/sfmc/scoreboards    /api/sfmc/world
/api/sfmc/settings
```

> 如果你的 route 不在前缀表里 —— 先在 `db-server/src/routes/` 加文件,然后让 `KNOWN_PREFIXES` 覆盖。

## 4. 演进路径

| 阶段 | 形态 |
|------|------|
| **Stage I(当前)** | `handlers: []` 占位。routes 仅做 WARN 检查 |
| **Stage J**(计划中) | `db-server/src/handler-registry.ts` 单文件 `HANDLERS = Record<"<id>:<name>", RouteHandler>`;manifest 启动时**强校验**每个 handler 名都存在于 HANDLERS,缺一即 `throw` |
| **Stage K+** | SAPI bundle 不再包含 db-server 路由名。db-server 启动读 manifest + handler-registry 后,自己拼接 Express 路由。SAPI 端只看到 `HttpDB.post(path, body)` 不再有"我知道 db-server 有这条路由"的隐含契约 |

## 5. 端到端示例

`modules/packages/feature-foo/sapi/manifest.json`:

```json
{
  "handlers": [],
  "routes": [
    { "method": "GET",  "path": "/api/sfmc/foo/:id",      "handler": "foo:get"    },
    { "method": "POST", "path": "/api/sfmc/foo",           "handler": "foo:create" },
    { "method": "PUT",  "path": "/api/sfmc/foo/:id",      "handler": "foo:update" }
  ],
  "migrations": [
    { "name": "create_foo_table", "version": 1 }
  ],
  "notes": "feature-foo: demo module"
}
```

构建并启动:

```bash
sfmc behavior-pack build    # 跑 emit-manifest.mjs 合并 22 个 manifest
cat build/sfmc-modules/manifest.json | jq '.modules["feature-foo"]'
# 应输出上面这段内容
```

db-server 启动:

```bash
cd db-server
npm run dev
# [manifest] loaded schemaVersion=1 modules=22 routes=34
# (如果 feature-foo 的路由不在前缀表里,会出 WARN)
```

## 6. 校验工具

`node tools/check-catalog.js` 会在 CI 中跑。它检查 catalog.json 完整性,但**不**检查 manifest.json 字段名(写错的字段名会被 emit-manifest 原样透传 —— 报错只发生在 db-server 启动后)。

为了避免这种延迟反馈,Stage K 计划加入 `node tools/check-manifest.js`,在 BP 构建前静态校验每个 manifest.json 的字段名与 shape。当前可用如下 ad-hoc 检查:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const root = 'modules/packages';
const expected = ['handlers','routes','migrations'];
let bad = 0;
for (const id of fs.readdirSync(root)) {
  const mf = path.join(root, id, 'sapi', 'manifest.json');
  if (!fs.existsSync(mf)) { console.log('MISSING', id); bad++; continue; }
  const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
  for (const k of expected) if (!(k in j)) { console.log('NO FIELD', id, k); bad++; }
  if (j.routes) for (const r of j.routes) {
    if (!r.method || !r.path || !r.handler) { console.log('BAD ROUTE', id, r); bad++; }
  }
}
process.exit(bad ? 1 : 0);
"
```