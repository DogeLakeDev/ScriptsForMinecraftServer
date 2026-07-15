# 第二阶段：经济系统实现方案 — 全部完成 ✅

~~基于对现有代码库、plan.md 及 docs/plan/economic-reform-plan.md 的全面审查，以下是第二部分经济系统的实现方案：~~

~~第二阶段：经济系统实现方案~~

~~当前状态总结~~

~~已完成 (P0/P1): Money 缓存已重构（版本快照、区分 getCached/load、版本冲突保护）；交易返回完整账户快照 + transaction ID；HTTP 幂等键防止重复扣款；Money.set() 已标记废弃；土地购买、合作社银行、红包已包装为服务端事务。~~

~~待完成： 合作社商店仍为两次独立 HTTP（扣款→给物品/clear），无原子性；双账户流水缺 before/after 余额；API 错误码不统一；Money.UNIT 未完全统一；四个 P1 项未落地。~~

## Step 1 — 合作社商店服务端原子事务 (P0补齐) ✅

- ~~db-server/index.js — 新增 `POST /api/sfmc/coops/:cid/shop/buy` 端点 + `POST /api/sfmc/coops/:cid/shop/sell` 端点~~
- ~~scripts/api/CoopAPI.ts — 新增 `coopShopBuy()` / `coopShopSell()`~~
- ~~scripts/coop/CoopCore.ts — `buy()` / `sell()` 改为调用新原子 API，失败回滚~~

## Step 2 — 统一双账户流水 before/after 余额 (P1) ✅

- ~~db-server/index.js `applyEconomyTransaction()` — 每笔交易生成双行流水（`-dr` 借方 / `-cr` 贷方），记录完整的 `balance_before`/`balance_after`~~
- ~~各领域事务 — 确保 `balance_before` / `balance_after` 正确记录~~
- ~~scripts/api/EconomyApi.ts — 返回值暴露 `balanceBefore` / `balanceAfter`~~

## Step 3 — 统一 Money.UNIT (P1) ✅

- ~~scripts/coop/CoopCore.ts — 删除 `monetary_unit: "¥"`~~
- ~~scripts/coop/Database.ts — 删除 `monetary_unit` 类型和默认值~~
- ~~scripts/gui/CoopGUI.ts — 所有 `monetary_unit` 引用替换为 `Money.UNIT`~~
- ~~验证无残留 `¥` 符号~~

## Step 4 — 统一经济 API 错误码和网络错误处理 (P1) ✅

- ~~scripts/libs/HttpDB.ts — 新增 `typedRequest<T>()`~~
- ~~scripts/api/EconomyApi.ts / CoopAPI.ts — 使用 `typedRequest` 统一解析~~
- ~~scripts/libs/Money.ts — 失败时 `console.warn` 打印具体 `result.error`~~
- ~~scripts/coop/CoopCore.ts — `bankControl()` / `buy()` / `sell()` 返回 `{ ok, error }` 结构~~

## Step 5 — 价格指数表 + 周度动态调价 (Phase 1) ✅

- ~~db-server/index.js `initDB()` — 新增 `sfmc_economy_price_index` 表~~
- ~~db-server/index.js — 新增 `GET/POST /api/sfmc/economy/price-index` + `POST /api/sfmc/economy/price-index/recalc`~~
- ~~scripts/api/EconomyApi.ts — 新增 `getPriceIndex()`, `recalcPriceIndex()`~~
- ~~modules/catalog.json — 新增 `feature-price-index` 条目~~

## Step 6 — 每日任务系统 (Phase 1) ✅

- ~~db-server/index.js `initDB()` — 新增 `sfmc_economy_daily_tasks` 表~~
- ~~db-server/index.js — 新增 `GET /api/sfmc/economy/daily-tasks` + `POST /.../:id/submit`~~
- ~~scripts/doge/DailyTask.ts — 新建 SAPI 模块 (`!task` 命令 + GUI)~~
- ~~scripts/api/EconomyApi.ts — 新增 `getDailyTasks()`, `submitDailyTask()`~~
- ~~modules/catalog.json — 新增 `feature-daily-task` 条目~~
- ~~scripts/entry.ts — 注册 `dailyTask` 模块~~

## Step 7 — 地皮税 + 欠税冻结 (Phase 2) ✅

- ~~db-server/index.js — `sfmc_lands` 扩展 `tax_rate`, `tax_due_at`, `tax_frozen` 列~~
- ~~db-server/index.js — 新增 `POST /api/sfmc/lands/:id/tax-collect` 端点~~
- ~~scripts/land/LandTax.ts — 新建，定时遍历所有领地收税，欠税冻结~~
- ~~scripts/land/LandSystem.ts — 注册 `LandTax.start()/stop()`~~

## Step 8 — 指令阶梯收费 (Phase 2) ✅

- ~~scripts/libs/Command.ts — `CommandEntry` 新增 `cost` 字段；`register()` 新增 `cost` 参数；`trigger()` 加入扣费逻辑~~
- ~~db-server/index.js — 新增 `sfmc_player_command_usage` 表 + `GET/POST /api/sfmc/economy/command-usage`~~
- ~~scripts/entry.ts — 设置 `Command.deductCost` hook~~

## Step 9 — 经济白皮书月度报告 (Phase 2) ✅

- ~~db-server/index.js — 新增 `sfmc_economy_stats` 表 + `GET /api/sfmc/economy/stats/monthly`~~
- ~~scripts/EconomyReport.ts — 新建，每月 1 号聊天广播摘要~~

## 实施路线图

| 阶段   | 步骤                           | 状态    |
| ------ | ------------------------------ | ------- |
| Week 1 | Step 1 合作社商店原子事务      | ✅      |
|        | Step 2 统一 before/after 余额  | ✅      |
|        | Step 3 统一 Money.UNIT         | ✅      |
|        | Step 4 统一错误码              | ✅      |
| Week 2 | Step 5 价格指数表              | ✅      |
|        | Step 6 每日任务系统            | ✅      |
| Week 3 | Step 7 地皮税                  | ✅      |
|        | Step 8 指令阶梯收费            | ✅      |
|        | Step 9 经济白皮书              | ✅      |
| 后续   | Phase 3 (玩家市场/认证/奢侈税) | ⏳ 待定 |

所有 9 个步骤已完成，文档中各项任务均已划去。
