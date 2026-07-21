# v2 模块协议重构 — 代码审查报告

> 审查对象:`main` @ `34e658b`(v2 模块协议 + `land`/`land-gui`/`afk` 迁移)
> 审查方式:静态阅读 + 实际构建 + db-server 启动 + 冒烟/接口运行时验证
> 结论:**当前尚不符合要求** —— 平台层、SDK、已迁移模块三处均存在 BLOCKER,v2 端到端链路目前无法跑通。

---

## 0. 结论速览

| 维度 | 状态 | 说明 |
|------|------|------|
| 构建 `npm run build --workspaces` | ✅ 通过 | 全部 workspace 编译成功 |
| db-server 启动 + v2 manifest 装载 | ✅ 通过 | `loaded 3 modules; provides 12 services`,v1 模块正确跳过 |
| 模块 API 冒烟 `tools/smoke-modules.js` | ❌ **失败** | `FAIL: enabled 翻转`(见 R1) |
| v2 db/config/service 端到端 | ❌ **不可用** | 客户端从不带 token,服务端一律 401(见 B1) |
| SAPI 启动依赖 `GET /configs/all` | ❌ **回归** | 被 v2 鉴权网关遮蔽,返回 401(见 B2) |
| 团队规则(clean-break / 模块即第三方) | ⚠️ 部分违反 | `land` 仍保留 v1 代码并对外重导出内部(见 P-clean) |

**运行时证据**
```text
[manifest v2] loaded 3 modules; provides 12 services
[manifest v2] enabled: feature-afk, feature-land

POST /api/sfmc/db/tx        (无 token) -> HTTP 401
GET  /api/sfmc/configs/all  (无 token) -> HTTP 401  {"success":false,"error":"unauthorized: module identity invalid"}
tools/smoke-modules.js      -> FAIL: enabled 翻转
POST /api/sfmc/modules/feature-economy/disable -> {"success":true, ... "enabled":true}  # disable 后仍 enabled
```

---

## 0.5 本 PR 已修复的高置信 BLOCKER(附运行时验证)

以下问题已在本 PR 中直接修复,并用「模拟真实模块(按 `module-auth` 派生 token)」端到端验证通过:

| 编号 | 问题 | 修复 | 验证 |
|------|------|------|------|
| P-M1 | v2 路由请求体恒空(读 `req._body` 从未赋值)| `index.ts` 改为复用预读的 `body(req)` | `define-table`/`tx`/`get`/`query` 均能拿到载荷 → 200 |
| B2 | `GET /configs/all` 被 v2 鉴权遮蔽 401,插件端起不来 | `index.ts` 豁免 `configs/all` | `GET /configs/all` → 200(返回配置 JSON)|
| B3 | `/db/tx` 从 body 取 `moduleId` → 越权 + 事务恒拒 | `db-routes.ts` 强制 `moduleId=auth.id` | 持 land token + body 伪造 `moduleId=afk` → 仍以 land 身份执行 |
| B4 | 整体 `db:write:*` 断言恒失败 → 所有事务被拒 | `tx-runner.ts` 删除该断言,按表精确 gate | land 事务 200;afk 写 lands → 403 `permission_denied` |
| (schema) | `finalize()` 从未调用 → 表永不落地;且 softDelete 建表 SQL 语法错误 | `schema-registry.ts` define 即建表 + 抽出 `buildColumnList` | `lands` 表创建成功,insert/query/get 正常 |
| B7 | `land-gui` 未登记 catalog → 永不装载 | `catalog.json` 补 `feature-land-gui` 条目 | `check-catalog` OK(23 模块)|
| (回归) | 模块启停后 `enabled` 不翻转(读启动缓存的 lock)| `index.ts` `setModuleEnabled` 回写共享缓存 | `smoke-modules.js` **全部通过** |

> 仍**未**修复(需提交方做更大改动,详见下文):**B1**(SDK 客户端从不带 token → host-bootstrap 注入身份)、**B5**(`tx()` 录制-回放拿不到服务端结果)、**B6**(service provider 无注册通路)。这三项是 SAPI 侧/协议级改动,须结合 Bedrock 运行时验证,不在本审查 PR 的安全外科修复范围内。

---

## 1. BLOCKER(必须先修,否则 v2 无法运行)

### B1. 每一次 db/config/service 调用都会 401 —— 客户端从不发送鉴权 token
- 服务端对 `/api/sfmc/db/*`、`/services/*`、`/configs/:key` 全部经 `verifyModuleAuth` 强制校验 `?moduleId=` + `Authorization: Bearer`(`db-server/src/index.ts` 鉴权分支;运行时已验证 `POST /db/tx` 无 token → 401)。
- 但 SDK 侧设置身份的 `setDbModuleContext / setConfigModuleContext / setServiceModuleContext`(`modules/sdk/@sfmc-sdk/src/sapi/{db,config,service}/client.ts`)**在整个仓库里从未被调用**;`installHostBootstrap`(`modules/sdk/@sfmc-sdk/src/module-loader/install.ts`)不注入。运行时 `_moduleId===""`、`HttpDB.authToken===""`,既不带 `?moduleId=` 也不带 `Authorization` 头。
- 结果:任何模块的 `db.tx / db.query / config.get / service.get` 一律 401。**这是 v2 的第一号拦路石。**

### B2. 回归:`GET /api/sfmc/configs/all` 被 v2 鉴权遮蔽,SAPI 启动即失败
- SAPI 启动时 `ConfigManager.init()` 会一次性拉 `GET /api/sfmc/configs/all`。现在该路径落入 v2 `configs/:key` 命名空间,`key="all"` 无模块归属 → 无 token 401 / 带 token 403(`db-server/src/index.ts` 的 `needsModuleAuth` 判定 + `routes/module-config-routes.ts`)。旧的 `routes/config.ts` 处理器不再被命中。
- 运行时已验证:`GET /configs/all` → `401 {"error":"unauthorized: module identity invalid"}`。**这会让插件端起不来。** 需要把 `configs/all` 从 v2 模块鉴权命名空间里豁免/前置。

### B3. `/db/tx` 从请求体读取 `moduleId` —— 越权风险 + 与单操作路由不一致
- 单操作路由用鉴权身份 `auth.id` 执行(`routes/db-routes.ts`),但 `/db/tx` 直接把 body 透传给 runner,runner 从 `body.moduleId` 取身份(`routes/db-routes.ts` 的 tx 分支 + `tx-runner.ts`)。
- 双重问题:(a) 客户端 `tx()` 只发 `{steps}` 不带 `moduleId`,即便修好 B1,tx 仍因 `moduleId===undefined` 被拒;(b) 安全上,持 A 的合法 token 却在 body 里写 `moduleId:"B"`,即可用 B 的权限执行事务。**必须强制 `moduleId = auth.id`。**

### B4. `db:write:*` 通配权限自相矛盾 —— 所有事务被拒
- `tx-runner.ts` 在每次 `run()` 开头无条件断言 `db:write:*`,但 `permission-gate.ts` 的 `validPermissionKey` 正则不接受 `*`,导致任何模块声明 `db:write:*` 会在装载期抛错,`moduleHasPermission` 也永远无法满足。→ 所有 `/db/tx`(以及经 runner 的单操作)返回 `permission_denied`。通配相关代码(`config:read:*` 等)同为死码。

### B5. `tx()` 的批处理模型无法支持步骤间数据依赖,且丢弃服务端结果
- SDK 的 `db.tx(fn)` 是"录制—回放":`tx.insert/update/query/get/call` 在 HTTP 往返前先返回占位值(`insert→入参行`、`get→null`、`query→[]`、`update→patch`、`call→undefined`)(`sapi/db/client.ts`)。因此 `const u = await tx.insert(...)` 拿不到服务端生成的 id,后续 `tx.update("t", u.id, ...)` 必然失效。
- 提交后 `tx()` 又不回传 `TxResponse` 里的 step 结果,插入 id / 查询行 / call 返回值全部不可达。**这直接使 `land-transfer` 里"先 get 再按 version 更新"的乐观并发失效**(见 R-land M5)。

### B6. 服务处理器无处注册 —— 所有 `service.get` / `tx.call` 必失败
- 业务逻辑运行在 SAPI 进程,而 db-server 的 `service-registry.ts` 的 `registerHandler` 从未被调用、也没有任何 HTTP 注册入口,`handlers` 恒为空 → `dispatch` 抛 `no_such_service`,含 service 步骤的事务必回滚。
- 对应到模块侧:`land` 声明了 12 个 `services.provides`,但 `registerServiceHandlers()`(`modules/packages/land/sapi/src/index.ts`)是空操作(注释自承"真实注册由 db-server side land-daemon 接管(P1)")。**provider 侧完全未实现**,`land-gui` 的所有 `service.get(...)` 落空。

### B7. `land-gui` 未登记进 `modules/catalog.json`
- catalog 只有 `feature-land`、`feature-afk`,没有 `land-gui`(`modules/catalog.json`)。模块不会被装载,其 `requires:["feature-land"]` 的加载顺序不被约束,`tools/check-catalog.js` 也无从校验。仅此一项即让 land↔land-gui 的 v2 演示无法端到端跑通。

---

## 2. MAJOR(正确性 / 安全 / 隔离)

**平台层(db-server)**
- **P-M1 请求体恒为空**:`index.ts` 预读 body 存到 `req._bodyPromise`,但 ctx 从 `req._body`(从未赋值)取值 → 所有 v2 路由 `ctx.body === {}`,`define-table/tx/query/...` 收到空载荷(`String(undefined)="undefined"`)。**若此项成立,v2 写面在 B1 之外再度全废,请优先核对。**(`db-server/src/index.ts`、`lib/http.ts`、`routes/db-routes.ts`)
- **P-M2 update/delete 按 `rowid` 定位、get 按真实主键**:文本主键(UUID)时 `WHERE rowid='uuid'` → 0 行;数字型 id 又可能命中错行(`tx-runner.ts`)。
- **P-M3 软删除未在读取端过滤**:`doQuery/doGet` 无 `_deleted_at IS NULL`,已软删数据仍被读回;`doUpdate` 也会更新软删行(`tx-runner.ts` vs `schema-registry.ts`)。
- **P-M4 service HTTP 路由绕过 `service:<name>` 权限**:tx 内路径校验权限,直连 `GET /services/:name` 只校验 `requires` 不校验 permission(`routes/service-routes.ts` / `service-registry.ts`)。
- **P-M5 事务中 `await` 异步 service handler**:在共享单连接上持 `BEGIN IMMEDIATE` 期间让出事件循环,并发请求会串进同一事务,破坏隔离(`tx-runner.ts`)。
- **P-M6 平台表前缀判断过松**:短路条件用 `sfmc_`(单下划线),真实平台表是 `sfmc__audit/sfmc__idempotent`(双下划线),`sfmc_x` 之类模块表会绕过 registry 归属校验;建议改为精确白名单(`tx-runner.ts`)。

**SDK 客户端**
- **S-M1 身份存在进程级全局静态**:`HttpDB.authToken` 单例 + 各抽屉模块级 `_moduleId`,同进程所有模块共享;A 的请求 `await` 挂起期间 B `set*Context` 会串改 token → 身份/权限串号(`runtime/httpdb.ts`、`sapi/*/client.ts`)。
- **S-M2 tx 错误信息被抹平**:`post` 在 `!res.ok` 时统一抛 `internal`,服务端 `tx_aborted/permission_denied` 与失败 step 下标丢失(`sapi/db/client.ts`)。
- **S-M3 `_currentTxId` 全局阻塞并发非事务调用**:tx 体 `await` 窗口内,别处/别模块的 `db.query` 会误抛 `use_tx/nested_tx`(`sapi/db/client.ts`)。
- **S-M4 可发布包缺 peerDependencies**:代码 `import @minecraft/server` / `@minecraft/server-net`,但 `package.json` 未声明任何 `dependencies/peerDependencies`(`modules/sdk/@sfmc-sdk/package.json`)。

**已迁移模块**
- **R-land M1 借贷方向反了**:`land-transfer.ts` 转移时借记原主(卖方)、贷记新主(买方),买卖语义相反。
- **R-land M5 乐观并发失效**:`version` 恒为 `1`(受 B5 影响拿不到真实值),无 `WHERE version=` 守卫,也未校验 `currentOwnerId` 是否真为业主(`land-transfer.ts`)。
- **R-land M6 重叠校验只在单个业主范围内**:`validateLandBox` 仅遍历 `args.ownerLands`,不同玩家可造重叠领地;且 `land.validateBox` 服务入参只有 box,拿不到 `ownerLands/cfg`,契约与实现不符(`land-validate.ts` vs manifest)。
- **R-gui M2 跨模块乱读配置**:`land-gui` 读 `config.get("land.config")`(land 的域),却只声明 `config:read:land_gui`;应走 land service(`land-gui/sapi/src/index.ts` vs manifest)。
- **R-gui M3 `services.requires` 漏声明/多声明**:用到 `land.validateBox` 未声明;声明了 `land.byOwner` 却只用 `land.listByOwner`。
- **R-gui M4 直查 land 私有表**:`db.query("lands", ...)`(`LandApi.queryLands`)违反自身"只走 service.get"不变量,且无 `db:read:lands` 权限。
- **R-afk M7 `afterWorldLoad:false` 却在 init 里访问世界**:`init` 调 `world.getAllPlayers()` 并遍历重置,应为 `afterWorldLoad:true`(`afk/sapi/src/index.ts`)。

---

## 3. MINOR / NIT(择要)

- **P-m1** `OFFSET` 无 `LIMIT` → SQLite 语法错误(`tx-runner.ts`)。
- **P-m2** `parseServiceList` 的 `seen` 集合定义在循环体内,重名服务检测失效(`manifest-loader.ts`)。
- **P-m3/m4** `config set` 未过滤 `__proto__/constructor`;`configs/:key/notify` SSE 缺 `config:read` 门(`module-config-routes.ts`)。
- **P-m5** `ColumnDef.ref` 生成 `REFERENCES t.c`(应为 `t(c)`),建表会失败(`schema-registry.ts`)。
- **P-m6** `doInsert/doUpdate` 返回伪造行,不带 DB 默认值/自增/`_version`(`tx-runner.ts`)。
- **P-m7** IPv4-mapped loopback 判断用等值 `!== "::ffff:127."` 而非前缀,误拒 `::ffff:127.0.0.1`(`index.ts`)。
- **S-m1** 响应包裹字段漂移:单操作路由返回 `{success:true}`,客户端类型按 `{ok:true}`;`TxResponse.steps`(客户端)vs `results`(服务端)。
- **S-m2** `Primitive` 允许 `bigint`,但 `JSON.stringify` 会抛 → 被吞成 `network_error`。
- **R-land m9** `synthMemberId` 用 32 位 djb2,注释却写 sha256,存在碰撞风险(`land-transfer.ts`)。
- **R-afk n2/n3** `removeTag("NOAFK")` 死行;AFK 提示中英文混用。
- 死码:`permission-gate.ts` 的 `PERMISSION_KEYS`/通配项、`manifest-loader.ts` 的 `filterEnabled`、旧 `manifest.ts`(v1)基本未用。

---

## 4. 是否符合团队规则

| 规则(来自 HANDOFF.md) | 判定 | 依据 |
|---|---|---|
| **Clean-break,不留旧代码** | ⚠️ 违反 | `land/sapi/src/index.ts` 明写"与 v1 并存:v1 保留所有 route/handler",并"重导出内部给同进程其它模块用" |
| **模块即不可信第三方,禁止触碰内部** | ⚠️ 违反 | `land-gui` 直查 `land` 私有表 `lands`;`land` 对外重导出内部符号 |
| **主仓最终只剩 SDK + API** | ⏳ 进行中 | 仅迁 2.x 个模块;其余 22 个仍 v1(启动日志已确认逐个跳过) |
| **v2 manifest 禁 routes/migrations/handlers** | ✅ 符合 | `land/afk` manifest 已是纯 permissions + services |

---

## 5. 建议修复顺序

1. **打通鉴权闭环(B1/B2/B3/P-M1)**:host 侧 `installHostBootstrap` 读取 `data/module-tokens.json` 并对每个模块调用 `set*ModuleContext`;`configs/all` 从 v2 命名空间豁免;`/db/tx` 强制 `moduleId=auth.id`;修好 `req._body` 赋值。
2. **权限模型自洽(B4)**:去掉 runner 里对 `db:write:*` 的硬断言,或让 `validPermissionKey` 正式支持通配并在 `moduleHasPermission` 里正确展开。
3. **补齐 provider 通路(B6/B7)**:实现服务处理器注册(HTTP 注册或 daemon),把 `land-gui` 登记进 catalog。
4. **重构 tx 结果回传(B5 + S-M2/M3)**:让 `tx()` 返回 `results`,支持步骤间依赖;修错误透传。
5. **正确性修补(P-M2/M3、R-land M1/M5/M6)**:主键定位、软删过滤、借贷方向、乐观并发、全局重叠校验。
6. **清账 clean-break(P-clean)**:删除 `land` 的 v1 残留与对外重导出;`land-gui` 改走 service。

---

## 6. 复现方式

```bash
npm install
npm run build --workspaces --if-present
# 修正 configs/db_config.json 的 modulesDir 为 "modules"(见 AGENTS.md 云端小节)
SFMC_ROOT=$PWD node db-server/dist/index.js   # 观察启动日志 loaded 3 modules
SFMC_ROOT=$PWD node tools/smoke-modules.js     # 复现 FAIL: enabled 翻转
curl -i -X POST http://127.0.0.1:3001/api/sfmc/db/tx -d '{"steps":[]}'   # 401
curl -i http://127.0.0.1:3001/api/sfmc/configs/all                        # 401(回归)
```

> 说明:本报告只做审阅,未改动任何业务代码;标注 `优先核对` 的项(P-M1)建议提交方先本地确认。
