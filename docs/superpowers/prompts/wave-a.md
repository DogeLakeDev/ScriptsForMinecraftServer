# Wave A：核心底座与中枢插槽提供者（5 个）

开仓前先读 [AGENT_BRIEF.md](../specs/modules/AGENT_BRIEF.md) 与对应 `*-design.md`，并套用 skill `sfmc-module-kickoff`。  
全局铁律见 `.cursor/rules/sfmc-module-architecture.mdc`。

---

## 1. `economy`（全服资金与账户中枢）

```markdown
请实现 official module: `economy`。
权威规范：docs/superpowers/specs/modules/economy-design.md
【关键要求】：
1. 计分板权威性：以 `sfmc_money` 原生计分板为唯一运行时权威余额，DB（`sfmc_economy_accounts` / `transactions`）作为时序审计与离线留档；
2. 账户语法：原生支持玩家 XUID/名称账户，以及机构公账（如 `coop:<cid>` 语法）；
3. 核心服务暴露：必须真实提供 `economy.account.get` / `credit` / `debit` / `transfer`，支持业务 `idempotencyKey` 幂等防重；提供 `economy.stats.query` 通用统计；
4. 杜绝旧版废弃的任务（dailyTasks）相关逻辑，纯粹内聚于资金流水与转账。
```

---

## 2. `monitor`（综合刻速采样与负载监控中枢）

```markdown
请实现 official module: `monitor`。
权威规范：docs/superpowers/specs/modules/monitor-design.md
【关键要求】：
1. 零外部依赖：`manifest.requires: []`；
2. 微观 TPS 流水线：维护容量 100 的逐 tick 环形时间戳采样区，微秒级无锁计算实时 TPS，冷启动保底 20.00；
3. 宏观负载流水线：每 600 ticks 周期汇总三维度活跃实体与视距区块，批量落库 `sfmc_monitor_*`；
4. 命令与服务：注册 `!tps`（面向全员带健康色阶输出）与 `!monitor`（面向管理员全服大盘）；对外提供 `tps.current`、`tps.status` 与 `monitor.metrics` 接口。
```

---

## 3. `area`（空间微内核与区域规则引擎）

```markdown
请实现 official module: `area`。
权威规范：docs/superpowers/specs/modules/area-design.md
【关键要求】：
1. 微内核定位：核心纯内存运行，零具体业务硬编码（严禁在 area 内部写游戏模式或飞行逻辑）；
2. 空间索引：维护 XZ 平面 AABB 矩形空间边界与点查；
3. 特性插槽（OCP）：对外暴露 `area.registerFeature`，统一调度 `AreaFeatureHandler` 的 `onEnter`、`onLeave` 和 `onTick` 声明周期；
4. 动态区域：提供 `area.registerArea` 与 `area.unregisterArea` 供第三方模块（如 land）动态声明边界。
```

---

## 4. `online-time`（在线时长统计与排行榜）

```markdown
请实现 official module: `online-time`。
权威规范：docs/superpowers/specs/modules/online-time-design.md
【关键要求】：
1. 打点结转模型：严禁每秒轮询累加！进服记录 `sessionStartMs`，实时查询即算即出；每 3 分钟心跳增量结转一次入库（`sfmc_online_time`）；
2. 跨天切片：跨午夜 0 点时平滑拆分归档前一日与当日时长；
3. 服务暴露：提供 `onlinetime.byPlayer`（含在线实时增量与 `isOnline` 状态）与 `onlinetime.top`（今日/本月/总榜）；
4. 自主向 `gui.registerMenuItem` 挂载 `🕒 在线统计` 菜单项。
```

---

## 5. `activity-log`（全服审计与行为日志中枢）

```markdown
请实现 official module: `activity-log`。
权威规范：docs/superpowers/specs/modules/activity-log-design.md
【关键要求】：
1. 原生监听与插槽双轨：全面监听进退服、聊天、方块破坏、容器等原生 after-events；
2. 双向服务插槽：
   - 提供 `activity.record`：供 coop、land 等模块异步上报治理事件；
   - 提供 `activity.query`：支持按 `targetId`、`actorId`、`eventTypePrefix` 及时间区间分页多维检索；
3. 性能保障：采用内存批量缓冲（2000ms 或 100 条）批量刷盘至 `sfmc_activities`；每日自动清理过期保留日志。
```
