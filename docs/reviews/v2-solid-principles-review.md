# v2 模块协议 — SOLID 维度补充审查

> 审查对象:`main` @ `c559ab4`(此前功能审查见 `v2-module-protocol-review.md`)
> 强制维度:**DRY · OCP · DIP · LSP · Law of Demeter**
> 结论:平台层与 SDK 抽屉在契约一致性与依赖倒置上仍有缺口;本 PR 修了两处高置信、可验证的 LSP/DRY 违规。

---

## 原则速查(本轮最高信号)

| 原则 | 最热味道 |
|------|---------|
| **DIP** | 抽屉依赖具体 `HttpDB`;host-bootstrap 从不注入 token;`land-gui` 直达 land 表/配置 |
| **LSP** | service HTTP ≠ `tx.call` 权限门;`ok`≠`success`;tx 录制器 ≠ 真结果;config 漏 `?moduleId=` |
| **DRY** | 三处 `set*ModuleContext` 写同一个 `HttpDB.authToken`;config 漏掉与 db/service 共用的 `withModuleId` |
| **OCP** | economy/land handler 在 `index.ts` 硬编码接线;`handle()` 按路径族 if 链扩张 |
| **LoD** | `req.moduleAuth` / `_bodyPromise`;`land-gui`→`lands`;land barrel 重导出内部 |

---

## 本 PR 已修复(SOLID)

### F1. config 客户端漏带 `?moduleId=` — **DRY + LSP**
- **违规**:db/service 客户端都用 `withModuleId` 把身份放在 query;config 只把 `moduleId` 塞进 POST body。而 `verifyModuleAuth` **只认** `?moduleId=` → 即便 token 注入成功,config 读写也恒 401。同一鉴权契约在三个抽屉上不可互换(LSP),且身份拼装逻辑本应 DRY。
- **修复**:`modules/sdk/@sfmc-sdk/src/sapi/config/client.ts` 增加与 db/service 一致的 `withModuleId`,GET/POST 均走 query;body 不再重复塞 `moduleId`。

### F2. service HTTP 绕过 `service:<name>` 权限 — **LSP**
- **违规**:`tx-runner.doService` 先 `assertModulePermission(Perm.service(name))` 再 `dispatch`;`service-routes` 只调 `dispatch`(只验 `services.requires`)。同一「调服务」操作两条路径契约不同,HTTP 可绕过权限声明。
- **修复**:`db-server/src/routes/service-routes.ts` 在 `dispatch` 前补上同款 `assertModulePermission`,403 时返回 `permission_denied`。

---

## BLOCKER(仍未修 — 需更大改动)

### S-B1. 模块抽屉鉴权从未注入 — **DIP**(已知 B1 的根因)
`module-auth.ts` 写 `data/module-tokens.json`,文档声称 `installHostBootstrap` 调 `set*ModuleContext`,但 `module-loader/install.ts` 仍是占位 stub。平台依赖「具体文件 + 未实现的 host」,高层(模块)无法得到抽象的身份能力。须在 BP bootstrap / 构建期注入 token 后才能端到端绿。

### S-B2. 三抽屉共享一个进程级 `HttpDB.authToken` — **DRY + DIP**
`setDbModuleContext` / `setConfigModuleContext` / `setServiceModuleContext` 都写同一个静态 token。多模块同进程时 last-writer-wins,身份串号。应抽「ModuleAuthContext」抽象(每模块/每请求),抽屉依赖该抽象而非具体 `HttpDB`。

### S-B3. `land-gui` 直查 `lands` / 读 `land.config` — **DIP + LoD**
manifest 自承「只走 service.get」,却有 `db.query("lands")` 与 `config.get("land.config")`。跨模块边界应只经 `service.get`;配置属 land 域,GUI 不得深挖。

---

## MAJOR

### S-M1. `land.validateBox` 调用了但未列入 `services.requires` — **LSP / 契约漂移**
`land-gui` 调 `service.get("land.validateBox")`,manifest requires 列表缺该项 → 一旦鉴权接通会 `not_in_requires`。

### S-M2. 进程内 service handler 在 `index.ts` 硬编码接线 — **OCP**
`if (enabledSet.has("feature-economy")) registerEconomyHandlers(...)`。新模块提供服务 = 改核心启动文件,而非「注册表扩展」。land 的 12 个 provides 仍无注册通路(已知 B6)。

### S-M3. 响应信封 `ok` vs `success` — **LSP**
单操作多用 `{success}`;tx/service/config-set 用 `{ok}`。客户端 `typedRequest` 靠 `ok !== false` 碰巧兼容。应统一一种信封类型。

### S-M4. `db.tx` 录制器结果占位 — **LSP**(已知 B5)
事务内 `query→[]` / `get→null` / `call→undefined`,与「真执行」语义不可互换;调用方无法按步骤结果分支。

### S-M5. 路由挖 `req.moduleAuth` / `_bodyPromise` — **LoD**
鉴权与 body 挂在 IncomingMessage 私有字段,而非显式 `RequestContext` 类型。协作方应只拿上下文对象,不深挖 `req`。

### S-M6. AFK(已外迁 sfmc-modules)误用 config API — **LSP**
`config.get("afk")` 期望整文件对象,抽屉实际按文件内 key 展平;`onChange("afk", handler)` 签名是 `onChange(handler)` only。

### S-M7. land 重导出内部符号 — **LoD / DIP**
`transferLand` / `validateLandBox` 等 barrel export 诱使同进程模块绕过 service 契约。

---

## MINOR

| ID | 原则 | 摘要 |
|----|------|------|
| S-m1 | DRY | `getModuleAuth` 在 db-routes / service-routes 重复 |
| S-m2 | OCP / DIP | `handle()` 路径族 if 链 + `as unknown` 路由转型 |
| S-m3 | DRY | `PERMISSION_KEYS` 死集合 vs 实际 regex 校验 |
| S-m4 | LSP | `configs/:key/notify` SSE 未断言 `config:read` |
| S-m5 | LoD 软 | `sfmc_*` 前缀短路绕过 schema 归属 |

---

## 与功能审查的关系

- 前序 PR #3 已修:请求体读取、configs/all 豁免、tx moduleId 强制、db:write:* 断言、define 建表、land-gui catalog、启停缓存。
- 本文件专盯 **设计原则**;功能正确性仍以 `v2-module-protocol-review.md` 为准。
- 建议下一刀:先做 **S-B1**(host 注入 ModuleAuthContext,顺带消掉 S-B2),再清 **S-B3 / S-M1**(land-gui 契约),最后 **S-M2**(handler 注册表,OCP)。
