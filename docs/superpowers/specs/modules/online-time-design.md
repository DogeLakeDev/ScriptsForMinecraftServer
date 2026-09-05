# online-time — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 基于**进服时间戳打点（Session Timestamp）+ 增量心跳结转（Heartbeat Flush）**的无锁高效模型，精准统计并持久化玩家当前会话（Session）、当日（Today）、当月（Month）及历史累计总在线秒数（Total）；向玩家提供极速实时的格式化时长查询指令 `!onlinetime`，并向平台生态提供标准化的单人时长快照（`onlinetime.byPlayer`）与全服在线时长排行榜（`onlinetime.top`）跨模块服务。

**Non-goals:**
- 不在模块内部绑定在线发钱、经济奖励或签到奖励逻辑（解耦设计：由经济或签到消费模块调用本服务执行奖励）
- 不直接依赖且不扫描行为审计流水日志（避免日志 30 天自动清理淘汰导致历史时长蒸发、崩服数据异常以及 $O(N)$ 复杂时序匹配开销）
- 不假设复杂的跨服或跨区分片时钟同步

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `online-time` |
| npm | `@sfmc-bds/module-online-time` |
| manifest.id | `online-time` |
| configKey | `online_time` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `onlinetime`（别名 `onlineTime`） | `onlinetime.see` | Any | 仅限玩家执行：实时格式化展示本次会话/今日/本月/累计总时长 |

- 控制台执行时友好拦截并提示仅限玩家终端使用；
- **GUI 声明式集成**：若检测到 `gui.registerMenuItem` 服务已注册，自动向玩家主菜单挂载 `🕒 在线统计` 入口，点击可查看个人详细时长面板及全服时长排行榜。

## 4. Data

### 纯内存实时态（无锁轻量结构）

维护 `Map<string, SessionState>`：
- `sessionStartMs`: 本次进服（或上次心跳结转时）的毫秒时间戳；
- `baseTodaySeconds`: 登录时（或上次结转后）库中当日基准秒数；
- `baseMonthSeconds`: 登录时（或上次结转后）库中当月基准秒数；
- `baseTotalSeconds`: 登录时（或上次结转后）库中历史累计基准秒数；
- `sessionTotalSeconds`: 本次连入会话全流程累计秒数。

### 持久化表

| 表名 | 关键列 | 索引 |
|------|--------|------|
| `sfmc_online_time` | `player_id` VARCHAR(64) PK，`player_name` VARCHAR(64)，`today_seconds` INT，`month_seconds` INT，`total_seconds` INT，`last_date` VARCHAR(10)，`last_month` VARCHAR(7)，`updated_at` BIGINT | `idx_online_today (today_seconds DESC)`，`idx_online_total (total_seconds DESC)` |

## 5. Config

`configs/online_time.json`：

```json
{
  "timezone": "Asia/Shanghai",
  "flush_interval_ticks": 3600
}
```

- `timezone`: 显式声明跨日/跨月重置的时区基准（默认 `Asia/Shanghai` 即 UTC+8），杜绝隐式依赖宿主物理时区；
- `flush_interval_ticks`: 增量心跳刷盘间隔，默认 3600 ticks（约 3 分钟）。防止服务器异常断电或强杀进程丢失过多数据。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `onlinetime.byPlayer` | `{ playerId: string }` | 见下方详情 | 查询目标玩家在线时长快照（在线时微秒级实时叠加当前会话增量） |
| `onlinetime.top` | `{ metric?: "today"\|"month"\|"total", limit?: number }` | 见下方详情 | 查询全服在线时长排行榜（按指定维度降序排列） |

#### `onlinetime.byPlayer` 契约

```ts
// input
{
  playerId: string;
}

// output
{
  playerId: string;
  playerName: string;
  isOnline: boolean;
  sessionSeconds: number; // 离线时为 0
  todaySeconds: number;   // 库基准 + 内存实时增量
  monthSeconds: number;   // 库基准 + 内存实时增量
  totalSeconds: number;   // 库基准 + 内存实时增量
  lastActiveAt: number;   // Unix ms
}
```

#### `onlinetime.top` 契约

```ts
// input
{
  metric?: "today" | "month" | "total"; // 缺省为 "total"
  limit?: number; // 默认 10，最大 50
}

// output
Array<{
  rank: number;       // 排名（1-indexed）
  playerId: string;
  playerName: string;
  seconds: number;    // 对应维度的累计秒数
  formatted: string;  // 格式化展示串（例如 "28小时45分"）
  isOnline: boolean;
}>;
```

### requires

无（零外部强依赖，作为 Wave A 基础提供者）。

## 7. Lifecycle notes & 计算机制

- `afterWorldLoad`: **true**（需在世界就绪后挂载进退服监听与心跳计时器）；
- **核心算法机制（打点 + 心跳结转）**：
  1. **进服打点（Player Join / Spawn）**：
     - 查询 `sfmc_online_time`；若新玩家则初始化插入记录；
     - 依据配置时区检查日期与月份：若时区日期 $\neq$ `last_date`，当日秒数清零；若月份 $\neq$ `last_month`，当月秒数清零；
     - 在内存记录 `sessionStartMs = Date.now()` 与各基准值。
  2. **极速无锁实时查询（Realtime Calculation）**：
     - 当玩家在线时，未结转增量 $\Delta t = \lfloor (\text{Date.now()} - \text{sessionStartMs}) / 1000 \rfloor$；
     - 实时今日时长 $= \text{baseTodaySeconds} + \Delta t$，累计时长同理；
     - **彻底废除旧版每 20 ticks（1秒）全服遍历的累加循环**，主线程零计算压力。
  3. **跨午夜平滑切片（Midnight Slicing）**：
     - 心跳或查询时，若检测到自 `sessionStartMs` 以来跨越了时区午夜 0 点：
       - 将跨午夜之前的秒数结转入前一天的 `today_seconds` 并归档入库；
       - 重置 `baseTodaySeconds = 0`，并将 `sessionStartMs` 调整为今日零点时间戳；
       - 确保玩家跨夜在线时数据平滑过渡，无任何突变失真。
  4. **周期心跳防崩盘（Heartbeat Flush，默认 3 分钟）**：
     - 定时器触发时，遍历在线玩家内存态，将增量 $\Delta t$ 批量结转落库：
       `today_seconds += Δt`, `month_seconds += Δt`, `total_seconds += Δt`, `updated_at = now`；
     - 刷新 `sessionStartMs = Date.now()` 并更新基准，将数据意外丢失窗口严格压缩在 3 分钟以内。
  5. **退服与停机（Player Leave & Teardown）**：
     - 玩家离线或服务器 `cleanup` 停机时，强制执行终态增量结算刷盘，并释放内存会话对象。

## 8. Acceptance criteria

- [ ] 彻底取消每秒（20 ticks）的高频轮询累加，转为进服打点 + 心跳结转模型
- [ ] 玩家执行 `!onlinetime` 格式化返回实时的本次/今日/本月/累计四段时长
- [ ] 控制台调用优雅阻断拦截
- [ ] `onlinetime.byPlayer` 真实注册，在线时微秒级叠加实时增量
- [ ] `onlinetime.top` 真实注册，支持按 today/month/total 排序并返回排名字典
- [ ] 跨日（0 点）与跨月依据配置时区（默认 `Asia/Shanghai`）平滑自动重置
- [ ] 数据库表名统一为 `sfmc_online_time`，建立适当降序索引
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 在线时长兑换游戏币 / 道具（由独立业务模块消费 `onlinetime.byPlayer` 服务实现）
- 阶梯签到奖励系统

## 10. Legacy reference（仅参考）

- `packages/online-time/`
