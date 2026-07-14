# 经济系统审查报告与改造方案

> 日期：2026-07-13 | 状态：规划中 | 版本：v1.0

---

## 一、现状审查

### 当前架构

经济系统基于三层架构：

```
Minecraft Bedrock (SAPI scripts)
       │  HTTP (@minecraft/server-net)
       v
   db-server (Node.js SQLite REST API)
       │  SQLite
       v
   sfmc_data.db
```

- 货币持久化在 `sfmc_economy_accounts` 表，`balance >= 0` 约束
- 每笔交易记录在 `sfmc_economy_transactions`（完整审计链）
- 旧 scoreboard 已显式弃用，不再作为权威数据源

### 当前货币来源（印钞口）

| 途径 | 模块 | 类型 |
|------|------|------|
| 管理员 `!money` 发放 | MoneyGUI | credit（无源，净增发） |
| QA 答题奖励 | QA.ts `giveBonus()` | credit（净增发） |
| 商店回收物品（所有物品均可卖） | ShopSystem.ts `sell()` | credit（净增发） |
| 领地删除退款（70%） | LandCore / db-server | credit（净增发，30%被销毁） |

### 当前货币回收（销毁口）

| 途径 | 模块 | 类型 |
|------|------|------|
| 商店购买物品 | ShopSystem.ts `buy()` | debit（净销毁） |
| 购买领地 | LandCore `createLand()` | debit（净销毁） |
| 创建合作社 | CoopCore `registerCoop()` | debit（净销毁） |
| 领地删除（30%差额） | db-server | 隐式销毁 |

### 当前定价机制

- **完全静态**：`configs/shop.json` 硬编码所有回收价与售卖价
- 价格存储在世界 `DynamicProperty` 中（不在数据库），可通过 GUI 调整
- **物理铸币**：铜/铁/金/钻/星币物品，买入卖出同价（1:1 自由兑换）

### 致命缺陷（对应改造点）

| # | 缺陷 | 对应草案章节 |
|---|------|-------------|
| 1 | **货币无限超发**：QA 奖励、商店回收皆凭空印钞，无总量控制 | 1.1 废除固定回收价 |
| 2 | **固定价格僵化**：无论经济冷热，同价回收 | 1.1 响应式动态定价 |
| 3 | **无持续回收机制**：仅商店购买/领地购买消耗货币，量不可控 | 3.1 地皮税、奢侈税 |
| 4 | **全物品可回收**：可再生资源（煤、腐肉）也能卖，等于无限印钞 | 1.1 仅回收稀缺不可再生 |
| 5 | **无玩家间交易市场**：只有转账，无挂牌/竞标 | 2.1 职业认证 + 交易补贴 |
| 6 | **无宏观数据观测**：发行量、回收量、流通速度不可见 | 4.1 经济白皮书 |
| 7 | **无存储惩罚**：囤积无成本，富人越来越富 | 4.2 负利率（保管费） |

---

## 二、改造草案逐项评估

### 2.1 货币发行机制

#### 1.1 废除固定回收价 → 响应式动态定价

**合理性**：高。当前商店回收煤炭、腐肉等于凭空印钞，是最大通胀源。

**建议**：
- 保留 `configs/shop.json` 结构，语义升级：`price` → `basePrice`，新增 `elasticity` 弹性系数
- 新增 `sfmc_economy_price_index` 表存储每物品的当前收购价/卖出价/收购上限/弹性系数
- 价格公式：`newPrice = basePrice * (1 + elasticity * (targetStock - currentStock) / targetStock)`
- 只允许在 GUI 中看到"可回收"的物品出现在商店卖出货架

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1.1 | `db-server/index.js` | 新增 `sfmc_economy_price_index` 表 |
| 1.2 | `db-server/index.js` | 新增 `POST /api/sfmc/economy/price-index/recalc` 端点（周度触发） |
| 1.3 | `ShopSystem.ts` | `sell()` 改为查询 API 获取当前市价 |
| 1.4 | `configs/shop.json` | 新增 `rarity`、`weeklyCap` 字段；移除可再生资源回收 |

#### 1.2 任务制回收（"今日急需 X 个ITEM"）

**合理性**：高。可控货币发行的核心方式。后台分配定额，玩家完成即下架。

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.1 | `db-server/index.js` | 新增 `sfmc_economy_daily_tasks` 表 |
| 2.2 | `db-server/index.js` | 新增 `GET/POST /api/sfmc/economy/daily-tasks` 端点 |
| 2.3 | `scripts/doge/DailyTask.ts` | 新模块，命令 `!task`，GUI 展示当日任务 |
| 2.4 | `modules/catalog.json` | 新增 `feature-daily-task` 条目 |

---

### 2.2 货币流通

#### 2.1 职业认证 + 交易补贴

**合理性**：中高。补贴是货币二次分配的良好方式。

**风险评估**：需防自买自卖刷补贴 → 加冷却期 + 每人每日补贴上限。

| 步骤 | 文件 | 改动 |
|------|------|------|
| 3.1 | `db-server/index.js` | 新增 `sfmc_player_certifications` 表 |
| 3.2 | `db-server/index.js` | 新增 `sfmc_player_shop_listings` 表 |
| 3.3 | `db-server/index.js` | 新增 `POST /api/sfmc/economy/market/buy` 端点 + 补贴计算逻辑 |
| 3.4 | `scripts/` | 新模块 `Market.ts`，命令 `!market`，GUI 浏览玩家摊位 |
| 3.5 | `modules/catalog.json` | 新增 `feature-market` 条目 |

#### 2.2 公共工程基金 + 众筹配资

**合理性**：中。有趣但实现复杂（需实物验证、项目周期管理）。

**优先级**：P3（远期）。先聚焦前三点。

---

### 2.3 货币回收

#### 3.1 地皮税 + 奢侈税

**合理性**：高。地皮税是现有领地模块的自然延伸；奢侈税防垄断。

| 步骤 | 文件 | 改动 |
|------|------|------|
| 4.1 | `LandCore.ts` | 新增 `LandTax` 类，周期检查逾期 |
| 4.2 | `db-server/index.js` | `sfmc_lands` 新增 `tax_due_at`、`tax_rate` 字段 |
| 4.3 | `LandSystem.ts` | 注册税后回调，欠税冻结地块权限 |
| 4.4 | `db-server/index.js` | 新增挂单奢侈税（挂单价 > 同类均价 300% 时收取 listing fee） |

#### 3.2 凭证积分（稀缺物品兑换副货币）

**合理性**：中高。本质是"销毁物品+主货币 → 凭证 → 限定商品"的精准回收工具。

**建议**：独立模块 `feature-voucher`，复用现有 economy 管道。

#### 3.3 指令阶梯收费（/home、/tpa、/back）

**合理性**：高。实现简单，直接影响货币流通。

| 步骤 | 文件 | 改动 |
|------|------|------|
| 5.1 | `libs/Command.ts` | `CommandOptions` 新增 `cost` 字段，`trigger()` 增加扣费逻辑 |
| 5.2 | `db-server/index.js` | 新增 `sfmc_player_command_usage` 表（player_id, command, date, count） |
| 5.3 | `entry.ts` | 为 `/home`、`/tpa`、`/back` 传入 cost 配置 |

---

### 2.4 宏观调控

#### 4.1 经济白皮书（月度报告）

**合理性**：高。最低成本的信任建设。

| 步骤 | 文件 | 改动 |
|------|------|------|
| 6.1 | `db-server/index.js` | 新增 `GET /api/sfmc/economy/stats/monthly` 端点 |
| 6.2 | `scripts/` | 新模块 `EconomyReport.ts`，每月1号聊天广播摘要 |
| 6.3 | `qq-bridge/index.js` | 同步转发到 QQ 群 |
| 6.4 | `db-server/index.js` | 新增 `sfmc_economy_stats` 快照表 |

#### 4.2 负利率（保管费）

**合理性**：中。理论正确但体感差，需谨慎。

**建议**：
- 仅对余额超过阈值（如 10万）部分收取
- 每周结算一次，显示 `#fee` 交易记录
- 频率可配置，默认关闭，作为可选调控工具

#### 4.3 准备金制度（余额上限 → 国债）

**合理性**：中低。过于强制，易引发反感。

**建议**：改为软引导（余额超上限后卖店不赚钱），而非强制转换。

---

## 三、分阶段路线图

### Phase 1 — 止血（1-2周）

```
P0：废除矿物/可再生资源回收 → 阻断通胀根源
P0：新增价格指数表 + 周度动态调价端点
P0：新增 daily-task 任务制回收 (SAPI 模块 + API)
```

### Phase 2 — 造血（2-4周）

```
P1：地皮税 + 欠税冻结
P1：指令阶梯收费（/home /tpa /back）
P1：经济白皮书月度报告
```

### Phase 3 — 活血（4-8周）

```
P2：玩家市场 + 职业认证 + 交易补贴
P2：凭证积分系统
P2：奢侈税
```

### Phase 4 — 未来探索

```
P3：公共工程基金众筹
P3：负利率 / 准备金制度（需要服务器规模达到临界点）
```

---

## 四、新增数据结构设计

```sql
-- ============================================
-- Phase 1: 价格指数 + 每日任务
-- ============================================

-- 价格指数（替代 shop.json 硬编码定价）
CREATE TABLE IF NOT EXISTS sfmc_economy_price_index (
  item_type               TEXT PRIMARY KEY,
  item_aux                INTEGER DEFAULT 0,
  base_buy_price          INTEGER NOT NULL,        -- 基准买入价（系统卖给玩家）
  base_sell_price         INTEGER NOT NULL,        -- 基准卖出价（玩家卖给系统）
  current_buy_price       INTEGER NOT NULL,        -- 当前买入价
  current_sell_price      INTEGER NOT NULL,        -- 当前卖出价
  elasticity              REAL DEFAULT 0.3,        -- 价格弹性系数 [0,1]
  weekly_acquisition_cap  INTEGER,                 -- 周收购上限（null=无限）
  weekly_acquired         INTEGER DEFAULT 0,       -- 本周已收购数量
  week_start              INTEGER,                 -- 当前周起始时间戳
  rarity                  TEXT DEFAULT 'common',   -- common | uncommon | rare | epic | legendary
  is_renewable            INTEGER DEFAULT 1,       -- 是否可再生（1=是, 0=否，不可再生才允许回收）
  updated_at              INTEGER
);

-- 每日任务
CREATE TABLE IF NOT EXISTS sfmc_economy_daily_tasks (
  id          TEXT PRIMARY KEY,
  item_type   TEXT NOT NULL,
  item_aux    INTEGER DEFAULT 0,
  target_qty  INTEGER NOT NULL,
  filled_qty  INTEGER DEFAULT 0,
  unit_reward INTEGER NOT NULL,
  created_at  INTEGER,
  expires_at  INTEGER,
  status      TEXT DEFAULT 'active'   -- active | completed | expired
);

-- ============================================
-- Phase 2: 税收 + 指令计费
-- ============================================

-- 土地税收（扩展 sfmc_lands）
-- ALTER TABLE sfmc_lands ADD COLUMN tax_rate INTEGER DEFAULT 0;
-- ALTER TABLE sfmc_lands ADD COLUMN tax_due_at INTEGER;
-- ALTER TABLE sfmc_lands ADD COLUMN tax_frozen INTEGER DEFAULT 0;

-- 指令使用记录
CREATE TABLE IF NOT EXISTS sfmc_player_command_usage (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  command   TEXT NOT NULL,             -- home | tpa | back
  date      TEXT NOT NULL,            -- YYYY-MM-DD
  count     INTEGER DEFAULT 0,
  UNIQUE(player_id, command, date)
);

-- 宏观经济快照
CREATE TABLE IF NOT EXISTS sfmc_economy_stats (
  id               TEXT PRIMARY KEY,   -- YYYY-MM
  total_issued     INTEGER DEFAULT 0,
  total_destroyed  INTEGER DEFAULT 0,
  total_supply     INTEGER DEFAULT 0,
  active_accounts  INTEGER DEFAULT 0,
  computed_at      INTEGER
);

-- ============================================
-- Phase 3: 玩家市场
-- ============================================

-- 玩家摊位
CREATE TABLE IF NOT EXISTS sfmc_player_shop_listings (
  id                    TEXT PRIMARY KEY,
  seller_id            TEXT NOT NULL,
  item_type            TEXT NOT NULL,
  item_aux             INTEGER DEFAULT 0,
  quantity             INTEGER NOT NULL,
  unit_price           INTEGER NOT NULL,
  certification_category TEXT,           -- farming | mining | hunting | building
  created_at           INTEGER,
  status               TEXT DEFAULT 'active'
);

-- 职业认证
CREATE TABLE IF NOT EXISTS sfmc_player_certifications (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL,
  category     TEXT NOT NULL,           -- farming | mining | hunting | building
  level        INTEGER DEFAULT 1,
  subsidy_rate REAL DEFAULT 0.05,       -- 补贴比例
  daily_subsidy_cap INTEGER DEFAULT 500,
  daily_subsidy_used INTEGER DEFAULT 0,
  subsidy_date TEXT,
  issued_at    INTEGER
);
```

---

## 五、现有模块受影响清单

| 模块 | 影响程度 | 说明 |
|------|----------|------|
| `feature-money` | **重构** | 新增总量控制、统计查询接口 |
| `feature-shop` | **大改** | 回收逻辑从静态 → 动态查询价格指数 API |
| `feature-land` | **中改** | 新增 LandTax 类和欠税冻结逻辑 |
| `feature-qa` | **小改** | 改为从任务池发奖或限定每日发放上限 |
| `feature-coop` | **无** | 合作社仓库独立经济池，不受影响 |
| `core-command` | **小改** | CommandOptions 新增 cost 字段 |
| `db-server` | **重构** | 新增 5+ 张表，8+ 端点 |
| `panel` | **中改** | 新增经济数据视图，税收配置界面 |
| `qq-bridge` | **小改** | 转发月度白皮书到 QQ |

---

## 六、风险与注意事项

1. **动态定价的预期管理**：价格波动规则需提前公示，否则玩家会认为"系统在割韭菜"
2. **任务制公平性**：先到先得可能让时区不同的玩家吃亏 → 建议分时段放量或随机分配
3. **奢侈税定义边界**：挂单价 > 同类物品过去7天均价 200% 即为"超高单价"
4. **负利率 UX 包装**：永远不说"扣钱"，说"账户保管费"或"银行服务费"
5. **渐进式上线**：从 Phase 1 开始，观察 2 周数据后再推进 Phase 2
6. **回滚预案**：每 Phase 保留一个配置开关，出问题可即时回退到旧逻辑
7. **物理铸币处理**：铜/铁/金/钻/星币的 1:1 兑换可能被滥用套利，需评估是否保留
