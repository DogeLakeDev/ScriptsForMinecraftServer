# Wave C：业务消费者与玩法生态模块（8 个可实现 + 1 个搁置）

依赖 Wave A/B 的中枢插槽（economy / activity-log / chat / area / gui / inventory-switcher 等）。  
开仓闸门见 [AGENT_BRIEF.md](../specs/modules/AGENT_BRIEF.md)。套用 skill `sfmc-module-kickoff`。

---

## 12. `chat-sounds`（聊天关键字全服音效）

```markdown
请实现 official module: `chat-sounds`。
权威规范：docs/superpowers/specs/modules/chat-sounds-design.md
【关键要求】：
1. 严禁裸听原生聊天：必须通过 `chat.onMessage` 观察者插槽接入聊天管道；
2. 关键词匹配：匹配预设关键词（如 ciallo, baka）并向全服广播目标音效；
3. 冷却防刷：生存模式玩家施加 200 ticks 触发冷却，创造模式豁免。
```

---

## 13. `coop`（合作社公账与组织治理）

```markdown
请实现 official module: `coop`。
权威规范：docs/superpowers/specs/modules/coop-design.md
【关键要求】：
1. 资金账户托管（DRY）：严禁自建钱包表！金库公账统一采用 `coop:<cid>`，完全由 `economy.account.transfer` 划转；
2. 审计托管（DRY）：严禁自建审计表！治理变动统一调用 `activity.record`（`eventType: "coop.audit"`）；
3. 治理业务：建社、入社、退社、转让、踢人、金库提现额度与角色权限门禁；
4. 声明式向 `gui.registerMenuItem` 挂载合作社面板。
```

---

## 14. `qa`（知识竞答与奖惩系统）

```markdown
请实现 official module: `qa`。
权威规范：docs/superpowers/specs/modules/qa-design.md
【关键要求】：
1. 严禁裸听原生聊天：出题广播使用 `chat.broadcast`；答题通过 `chat.registerInterceptor` 注册前置拦截器捕获 `!答案` 并消费；
2. 加权随机出题与最近 5 题防重队列；
3. 奖惩结算：答对调用 `economy.account.credit` 发放节操；答错调用 `economy.account.debit` 扣罚（传入轮次幂等键）；
4. 配置文件容错：题库为空或配置损坏时安全降级不崩溃。
```

---

## 15. `land`（现代地产庄园与只租不卖生态）

```markdown
请实现 official module: `land`。
权威规范：docs/superpowers/specs/modules/land-design.md
【关键要求】：
1. 根本法则：只租不卖（Lease Only），彻底废除永久买断，按日租金起租，支持长租折扣与平滑扩建租金补差；
2. 3D 原生高亮：通过 `@minecraft/debug-utilities` 的 `DebugBox` 绘制结构方块彩色三维线框（本人青绿、他人红、预览黄），`DebugText` 渲染空间名牌；
3. 平台插槽全面闭环：
   - 空间边界托管至 `area.registerArea`；
   - 治理审计托管至 `activity-log`（`activity.record` 归档，`activity.query` 支撑 `land.auditLog`）；
   - 租金与门票秒级划转至 `economy.account.debit` / `credit`；
   - 交互控制台挂载至 `gui` MenuNavigator SPA；
4. 商业门票与增益插槽（防爆/抑怪/回血/留言板）。
```

---

## 16. `gamemode-area`（区域游戏模式切换与背包隔离）

```markdown
请实现 official module: `gamemode-area`。
权威规范：docs/superpowers/specs/modules/gamemode-area-design.md
【关键要求】：
1. 挂接空间插槽：实现 `AreaFeatureHandler` 并注册至 `area.registerFeature`（特性名 `gamemode`）；
2. 背包安全隔离：进入创造区前调用 `inventory.switch` 暂存生存背包并载入创造专用背包；离开时反向置换；
3. 边界安全处理：玩家下线、死亡或异常移出时必须安全还原模式与背包，防止将创造物品带回生存区。
```

---

## 17. `fly-area`（区域飞行赋权）

```markdown
请实现 official module: `fly-area`。
权威规范：docs/superpowers/specs/modules/fly-area-design.md
【关键要求】：
1. 挂接空间插槽：注册至 `area.registerFeature`（特性名 `fly`）；
2. 进出生命周期：`onEnter` 赋予 `mayFly` 飞行能力，`onLeave` 剥离飞行能力；
3. 下线清理：离线时清理状态，杜绝带飞逃逸。
```

---

## 18. `clean`（区域与全服掉落物预警清理）

```markdown
请实现 official module: `clean`。
权威规范：docs/superpowers/specs/modules/clean-design.md
【关键要求】：
1. 严格生命周期分工：
   - `registerCommands`：注册 `!clean` OP 手动清理指令；
   - `registerEvents`：调用 `area.registerFeature` 挂接 `clean` 空间特性；
   - `init`：启动世界加载完成后的全服掉落物阈值周期扫描；
2. 优雅清理机制：超限时广播 10 秒倒计时；将常规物品实体优先移入 `recycle_bin` 公共回收箱，高危/经验球实体物理销毁。
```

---

## 19. `peace-area`（怪物拦截与和平空间保护）

```markdown
请实现 official module: `peace-area`。
权威规范：docs/superpowers/specs/modules/peace-area-design.md
【关键要求】：
1. 挂接空间插槽：注册至 `area.registerFeature`（特性名 `peace`）；
2. 生成拦截与周期兜底：监听 `entitySpawn`，在怪物露面前调用 `area.byPoint` 判定并 `remove()` 拦截；`onTick` 兜底清除游荡怪物；
3. 白名单安全豁免：铁傀儡、雪傀儡、友好生物与玩家宠物绝对不受影响。
```

---

## 20. `daily-task`（状态：Deferred 搁置）

> **说明**：该模块已在架构决策中明确标记为 **deferred（搁置）**，当前波次**不需要开仓实现**。  
> 规格见 [daily-task-design.md](../specs/modules/daily-task-design.md)。重新激活前须另开设计修订：明确任务权威存储（自有表 vs 新模块），再写完整章节与验收项。
