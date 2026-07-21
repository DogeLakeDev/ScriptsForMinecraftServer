# 领地系统审计与实施计划 v2

**审计日期：** 2026-07-15
**作用域：** SAPI 客户端 + db-server 服务端 + 配套 GUI

## 一、现状摘要

`feature-land` 是已上线的 SAPI 模块，基础保护已完成 §18 项（见 `plan.md` §一）。本审计聚焦：

- 客户端与服务端的契约脱节
- GUI 中两条明确的 UX 阻断
- 历史遗留死代码与单方面真相源

## 二、现存问题（按 P0/P1/P2 排序）

### P0 — 必修（用户在 plan.md §一 已点名）

| #   | 问题                                               | 文件:行                        |
| --- | -------------------------------------------------- | ------------------------------ |
| 1   | GUI 领地删除按钮点击无效                           | `plan.md:33`、`gui/LandGUI.ts` |
| 2   | GUI 转让时若目标玩家离线，MSG 形式提示，玩家不可见 | `plan.md:34`                   |

### P0 — 契约脱节（本次审计新增）

| #   | 问题                                                                                                                        | 证据                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 3   | `LandDatabase.ts` 的 `memoryStore / writeJSON / readJSON` 三个死字段从未刷盘，重启即丢；与 `_registry`（真缓存）两套真相    | `land/LandDatabase.ts:140-150`    |
| 4   | `createLandTransaction` 在 `BEGIN IMMEDIATE` 内连续 `validateLandInput` 两次（`check` + `locked`），多余 count+overlap 查询 | `db-server/index.js:892-896`      |
| 5   | `LandCore.calculatePrice` 忽略 `cfg.priceFormula`，写死 `square*8 + height*20`，UI 预览永远与服务端脱钩                     | `land/LandCore.ts:178-183`        |
| 6   | GUI 调用 `deleteLand/transferLand` 只接 `boolean`，server 抛出的 `code/message` 全部丢失                                    | `api/LandApi.ts:172-202, 270-298` |

### P1 — 一致性

| #   | 问题                                                                                                     | 证据                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 7   | 角色枚举双源 — client 7 个（`entity`），server 6 个                                                      | `land/LandDatabase.ts:25` vs `db-server/index.js:1202`   |
| 8   | `land/land.permissions` 与 `db-server.protection_profile` 键名脱节                                       | `land/LandDatabase.ts:9-23` vs `db-server/index.js:1356` |
| 9   | `manage_members` 等角色能力键在 server 是 snake_case，client 的 `ROLE_PERMISSIONS` 数组里又混 kebab-case | `db-server:1201,1229` vs `land/LandDatabase.ts:27-63`    |
| 10  | `LandEvents.playerInteractWithBlock` 重复订阅两次（容器 / 设施分别注册）                                 | `land/LandEvents.ts:103,117`                             |
| 11  | 爆炸防护 `getImpactedBlocks()` 对每块同步 SQL 查询，TNT 大爆炸触发 N+ 次                                 | `land/LandEvents.ts:184-194`                             |
| 12  | `LandDatabase._config` 首次本地读，不从服务端权威刷新                                                    | `land/LandDatabase.ts:188-198`                           |
| 13  | `land.managers` 字段冗余 — owner/admin 已在 `sfmc_land_members`                                          | `land/LandDatabase.ts:73, 394`                           |

### P2 — 演进

| #   | 问题                             |
| --- | -------------------------------- |
| 14  | 没有领地可视化（进入无粒子护盾） |
| 15  | 没有公共领地（新人缺引导）       |
| 16  | 没有卡片化邀请（社交摩擦大）     |
| 17  | 没有市场转售（流动性）           |

## 三、创意拓展方向（4 个，未来选）

### A — 领地名片 + 圈子互联（社交层）

`!landcard <id>` 生成 NBT 物品，丢地右键给对方，拾起者 `!accept <id>` 加入。

- 零新表
- 复用现有 `sfmc_land_invites` 字段
- 适用于远程邀请、队长带新人、租客交接

### B — 领地可视化护盾（防御层）

进地触发彩色粒子墙，标题栏显示「§a[🏰 城堡名] §r| 访客权限: 关」。

- `LandData.theme_color` 新字段（6 字符串）
- `LandEvents.scanPlayerBoundaries` 加 spawnParticle 调度
- 强化"我的领地"心理所有权

### C — 交易二级市场（经济层）

`land.list` 上架 → 市场撮合 → 卖家收分期。

- 新表 `sfmc_land_listings`（land_id, seller_id, price, status, ttm）
- 复用 `transferLand` 事务 + 经济扣款
- 解锁地皮流动性

### D — 公共广场 + 新人引导（公共层）

服务器启动在 (0, 64, 0) 划 `status='public'` 的永久地，新人 `!land here` 即看见引导。

- `LandData.status` 增加 `'public'` 分支
- `LandPolicy.canUse` 对 `public` 永远返 true
- 客户端菜单 `[🏛️ 公共广场]` tab

> 不全做，挑 1-2 个先落地，对应实施步骤 7、8。

## 四、实施计划（8 步 — 两轮迭代）

### Iteration 1 — 稳态（P0-P1 修干净）

| 步  | 标题                                | 改动                                                                                        | 估时 | 验收                                                                   |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1   | GUI 删除 + 转让修通                 | 删：confirm modal + 余额回流；转：在地里丢名片 + 接受方 `!accept`，离线也走信箱             | 4h   | `!land` → 选地 → 删 → refund 可见；`!landcard` → 丢出 → 对方 `!accept` |
| 2   | `LandDatabase` 收为纯 client cache  | 删 `memoryStore/writeJSON/readJSON`；`_config` 改为每 5 min 从 `/api/sfmc/lands/config` GET | 3h   | `node --check` 通过 + SQL smoke                                        |
| 3   | `createLandTransaction` 单 validate | `db-server/index.js:892-896` 合并两次；保留 `BEGIN IMMEDIATE` 兜底                          | 1h   | `node --check` + 并发创建测试                                          |
| 4   | `LandCore.calculatePrice` 改远端    | 复用 `validateLand` 拿 server `price`；`!land here` 用 server 返回                          | 2h   | 改 `priceFormula` 后 UI 同步显示                                       |
| 5   | `LandApi` typed result              | 全部 export 改 `{ok,data} \| {ok:false,code,message}`；配套 `LAND_ERROR_MESSAGE` 表         | 3h   | 离线 → GUI 显示真因                                                    |
| 6   | 角色 + 权限矩阵单源                 | 抽 `land/LandRoles.ts`，client/server 双端 import                                           | 2h   | 增/删一个角色 grep 只命中一处                                          |

### Iteration 2 — 拓展（远见落地）

| 步  | 标题                    | 改动                                                                     | 估时 |
| --- | ----------------------- | ------------------------------------------------------------------------ | ---- |
| 7   | D — 公共广场 + 新人引导 | db-server 启动插 `public` 地 + 客户端菜单 tab                            | 6h   |
| 8   | B — 领地粒子护盾        | `scanPlayerBoundaries` 触发 spawnParticle + `LandData.theme_color` PATCH | 6h   |

> A、C 留为可选项；E（审计 + 撤销）补 plan.md §一验收。

## 五、Visible Impact

**Before**

- 删地无反应；转让不在线发 MSG 被淹没；UI 预览价与服务端脱钩；离线失败原因不显示

**After**

- 删地 → confirm → refund 实时回流；转让 → 丢名片 → 接受方一键加入；UI 价 = 服务端价；离线原因"玩家不存在"

## 六、验证

```powershell
cd scriptsforminecraftserver && npm run build
cd ..\db-server && node --check index.js
cd .. && node tools/smoke-modules.js
node tools/check-catalog.js
```

- happy path: 删 → refund；转让 → 接受
- 失败: 离线转让 / 余额不足
- 幂等: 重复 `deleteLand` 第二次 404，已处理（server `already_deleted`）
- 多端并发: `BEGIN IMMEDIATE` 已兜底（步骤 3 简化前）

---

**关联：** plan.md §一验收 + issues/sapi-analyze.md（LandDatabase / coop/Database Map 问题）
