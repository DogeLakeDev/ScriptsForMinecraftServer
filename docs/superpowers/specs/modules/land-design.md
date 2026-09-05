# land — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only（旧包已从磁盘删除）。

## 1. Goal / Non-goals

**Goal:** 构建**全服土地租赁契约（Leasehold Contract / 只租不卖）与新生代开拓庄园生态（Settlement & Territory Engine）**。
- **确立「只租不卖」根本法则**：彻底废除永久买断制，以定期土地租赁契约消除死服僵尸鬼城与地皮垄断；零买断首付门槛，按日租金起租，支持长租折扣（月租9折、季租8折）；
- **物理守护基石（Land Totem）与高精度选点**：放置基石即签订契约起租，右键通过 DDUI 拖动滑块实时扩建；为建筑党保留 3D 精确选点；
- **扩建平滑补差机制**：中途扩建时，仅需补缴剩余有效租期内的日租金差额，前期投入零浪费；
- **双轨充能续租与 7 天休眠保护**：支持节操币或原版矿物（煤/铁/金/绿宝石/钻石）双轨充能续约；到期未续租进入 **7 天欠租休眠保护期**（建筑封存受保护，增益与商业暂停），7天内补交即刻复苏，超期彻底终止契约并自然回收地皮；
- **原生级 3D 硬件加速线框（DebugDrawer）**：深度基于 `@minecraft/debug-utilities`，渲染原版结构方块级的彩色立体线框（`DebugBox`）与 3D 空间浮空名牌（`DebugText`），零实体、零卡顿、完美贴合方块边缘；
- **领地增益插槽（Land Perks）**：提供防爆、抑怪、舒适度回血、防雷防火等环境增益，空间托管至 `area` 微内核；
- **商业地标与门票造血**：支持开启公开地标（`/land tp`），门票收入秒级全额划转至主人钱包或组织公账（`coop:<id>`），配套庄园留言簿与点赞榜；
- **平台中枢服务深度闭环**：空间边界由 `area` 空间微内核托管，治理审计全量归入 `activity-log`，资金两阶段结算通达 `economy`，交互控制台无缝嵌入 `gui` DDUI SPA 路由。

**Non-goals:**
- **严禁开放永久买断私产**，所有地皮一律以租赁契约（`lease_until`）形式存续；
- **严禁自建私有审计日志表**（废除旧 `sfmc_land_audit_logs`），变动与治理事件全量委托平台 `activity-log`；
- **严禁自建玩家坐标移动轮询循环**，空间索引与进出边界事件统一由 `area` 微内核空间引擎派发；
- 领地重叠校验必须对当前维度**全部既有有效契约领地**进行 AABB 空间碰撞检测；
- 数据表全量采用 `sfmc_lands*` 统一命名空间。

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `land` |
| npm | `@sfmc-bds/module-land` |
| manifest.id | `land` |
| configKey | `land` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["economy", "activity-log"]` |

## 3. Player surface & 视觉交互

| 权限 | 等级 | 用途 |
|------|------|------|
| `land.use` / `land.gui.use` | Any (0) | 领地起租、管理、扩建、续约与控制台交互 |
| `land.tp` | Any (0) | 传送至已公开的领地地标（支付门票） |
| `land.admin` / `land.gui.admin` | OP (3) | 管理员强行介入、公共广场配置与违规回收 |

### 3.1 租赁契约与圈地方式

1. **物理基石辐射起租（Totem Core Lease，新手与移动端首选）**：
   - 放置特殊的【守护基石】方块（新手进服赠送初级基石，商城或合成可得）；
   - 放置瞬间在基石中心生成初始领地（默认垂直通天模式 $Y = -64 \sim 320$，初始水平半径 16 格），弹出 DDUI 租赁契约面板；
   - 自由选择起租天数（默认 7 天），世界中立刻浮现青绿色 `DebugBox` 结构线框；
   - 右键基石呼出 DDUI 控制台：拖动【扩建滑块】，世界中的 `DebugBox` 线框随着手指实时放大缩小，当场计算剩余天数的租金补差；
   - 拆除基石（仅限主人）或在菜单中解除契约，领地即时安全注销。
2. **高精度 3D 选点框选（Precision Box Lease，建筑党专属）**：
   - 手持圈地工具敲选两点，世界中实时连出明黄色 `DebugBox` 预览虚框；
   - 输入 `!land lease <name> <days>` 签订租赁契约。

### 3.2 硬件级 3D 视觉高亮体系（DebugDrawer）

基于 `@minecraft/debug-utilities`（若未开启则优雅降级为粒子边界）：
- **所有权色彩区分**：
  - 本人庄园：安全青绿 `{ red: 0.2, green: 1.0, blue: 0.4, alpha: 0.6 }`
  - 他人领地：警示警戒红 `{ red: 1.0, green: 0.2, blue: 0.2, alpha: 0.5 }`
  - 公共广场/集市：明亮天空蓝 `{ red: 0.2, green: 0.7, blue: 1.0, alpha: 0.5 }`
  - 选点/扩建预览：高亮金黄 `{ red: 1.0, green: 0.8, blue: 0.2, alpha: 0.8 }`
- **空间 3D 悬浮名牌（DebugText）**：
  - 在基石上方或入口上空投射 3D 浮空字：`§a[史蒂夫的庄园 Lv.2] §7(契约剩余 28天)`；
- **智能视距生命周期**：
  - 玩家进入领地周边 16 格或手持管理工具时自动挂载渲染，离开视野后自动调用 `removeShape()` 释放。

## 4. Data

全量数据表统一使用 `sfmc_lands*` 命名空间：

| 表名 | 关键列 / 语义 |
|------|----------------|
| `sfmc_lands` | `id` VARCHAR(64) PK，`owner_id`（`player:<xuid>` 或 `coop:<id>`），`name`，`dimension`，`min_x`，`min_y`，`min_z`，`max_x`，`max_y`，`max_z`，`core_x`，`core_y`，`core_z`，`level`（1~5），`status`（`active`\|`dormant`\|`terminated`），`daily_rent`（当前每日租金），`lease_until`（Unix ms，租赁截止期），`grace_until`（Unix ms，休眠宽限截止期），`ticket_price`，`is_public`，`likes_count`，`version`，`created_at`，`updated_at` |
| `sfmc_land_members` | `land_id`，`player_id`，`role`（owner/admin/member/guest），`permissions_json`，`updated_at` |
| `sfmc_land_perks` | `land_id`，`perk_id`（noboom/peace/fireproof/heal/nofall），`enabled`（BOOLEAN），`settings_json` |
| `sfmc_land_guestbook` | `id` PK，`land_id`，`visitor_id`，`visitor_name`，`message`，`is_like`，`created_at` |
| `sfmc_land_operations` | `request_id` PK，`operation_type`（lease/renew/expand/ticket/disband），`status`，`response_json`，`created_at` |

## 5. Config

`configs/land.json`：

```json
{
  "base_daily_rent": 10,
  "rent_per_100_blocks": 2,
  "max_lands_per_player": 5,
  "land_count_multiplier": [1.0, 1.5, 2.0, 3.0, 3.0],
  "long_term_discounts": {
    "30": 0.9,
    "90": 0.8
  },
  "grace_period_days": 7,
  "default_claim_mode": "vertical",
  "totem": {
    "item_type": "minecraft:respawn_anchor",
    "item_name": "§e§l守护基石 §7[放置即起租]",
    "initial_radius": 16,
    "max_level": 5,
    "level_radius": [16, 24, 32, 48, 64]
  },
  "mineral_rates": {
    "minecraft:coal": 0.5,
    "minecraft:iron_ingot": 2,
    "minecraft:gold_ingot": 5,
    "minecraft:emerald": 20,
    "minecraft:diamond": 30
  },
  "plaza": {
    "name": "自由广场",
    "welcome": "欢迎来到公共安全广场",
    "dimension": "minecraft:overworld",
    "range": [0, 64, 0, 100, 128, 100]
  },
  "default_permissions": {
    "allow_place": true,
    "allow_destroy": true,
    "attack_entity": true,
    "open_container": true,
    "use_door": true,
    "use_button": true,
    "use_redstone": true,
    "interact_entity": true,
    "pickup_item": true
  }
}
```

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `land.byId` / `land.byPos` | `{ id: string }` / `{ dimension, x, y, z }` | 领地契约详情 | 按 ID 或三维坐标检索领地 |
| `land.listByOwner` | `{ ownerId: string, limit?, offset? }` | `Land[]` | 查询名下租赁领地（支持个人与组织公账） |
| `land.listMembers` | `{ landId: string }` | `Member[]` | 领地授权成员列表 |
| `land.getPlayerRole` | `{ landId: string, playerId: string }` | `{ role, permissions }` | 查询玩家在目标领地的权限掩码 |
| `land.validateBox` | `{ dimension, min, max, excludeLandId? }` | `{ valid, dailyRent, conflict? }` | AABB 碰撞检测与日租金计算 |
| `land.createLease` | `{ playerId: string, dimension, min, max, days: number, isTotem?: boolean }` | `{ ok, landId, leaseUntil }` | 签订新领地租赁契约（扣除首期租金） |
| `land.renewLease` | `{ landId: string, days?: number, mineralItem?: any }` | `{ ok, newExpiry }` | 续签契约（支持货币扣除与矿物投入双轨） |
| `land.expandLease` | `{ landId: string, newMin, newMax }` | `{ ok, feeDiff }` | 扩建领地（按剩余天数平滑补交租金差额） |
| `land.terminateLease`| `{ landId: string, playerId: string }` | `{ ok }` | 主动解除契约（注销领地、归还基石） |
| `land.teleport` | `{ playerId: string, landId: string }` | `{ ok, feePaid }` | 传送至公开地标并扣除门票转入主人账户 |
| `land.leaseStatus` | `{ landId: string }` | `{ remainingDays, dailyRent, status, isGracePeriod }` | 查询租赁有效倒计时与契约状态 |
| `land.getPerks` / `setPerk` | `{ landId: string, perkId?: string, enabled?: boolean }` | `{ perks }` | 查询与配置庄园环境增益开关 |
| `land.guestbook.list` / `sign` | `{ landId: string, message?: string, isLike?: boolean }` | `{ ok }` | 庄园留言板与点赞操作 |
| `land.auditLog` | `{ landId: string }` | `ActivityRecord[]` | 委托 `activity-log` 检索领地历史治理审计日志 |
| `land.openMainMenu` | `{ playerId: string }` | `{ ok }` | 为玩家弹出领地 SPA 租赁控制台（DDUI） |

### requires

| name | 来自 | 用途 |
|------|------|------|
| `economy.account.get` | [economy-design.md](./economy-design.md) | 校验起租、续约、扩建补差与门票访客余额（支持个人与公账） |
| `economy.account.debit` / `credit` | 同上 | 租金扣除、门票秒级划转、扩建扣费 |
| `activity.record` / `activity.query` | [activity-log-design.md](./activity-log-design.md) | **治理审计与日志检索**：归档起租续费等事件，并支撑 `land.auditLog` 查询 |
| `area.registerArea` | [area-design.md](./area-design.md) | **空间引擎注册**：契约生效时挂接 Area 实例，托管边界与增益 |
| `area.unregisterArea` | 同上 | 契约终止时从空间引擎同步销毁区域 |
| `gui.registerMenuItem` | [gui-design.md](./gui-design.md) | **导航中枢自挂接**：启动期自主向主菜单注入 SPA 庄园入口 |

## 7. Lifecycle notes & 核心租赁运作机制

- `afterWorldLoad`: **true**（需在世界加载后挂载方块放置、交互监听与 `debugDrawer` 形状更新）；
- **起租与 DDUI 实时联动装配**：
  1. 玩家放置【守护基石】$\to$ 碰撞检测 $\to$ 呼出 DDUI 契约签署面板；
  2. 滑块选择租期天数（如 30 天，享 9 折优惠），价格标签实时打表联动；
  3. 确认后调用 `economy.account.debit` 扣除首期租金，记录两阶段操作流水；
  4. 插入 `sfmc_lands`（`status: 'active'`, `lease_until = now + days * 86400000`）；
  5. 调用 `area.registerArea` 挂接空间微内核；
  6. 通过 `debugDrawer.addShape(new DebugBox(...))` 在世界中渲染安全青绿结构线框；
  7. 调用 `activity.record` 归档 `land.lease_start` 审计事件。
- **扩建平滑补差算法（Expansion Differential Calculation）**：
  - 玩家在控制台拖动面积滑块时，世界中的 `DebugBox` 线框随手指滑动实时放大缩小；
  - 剩余有效天数 $D_{\text{rem}} = \max(0, \lfloor (\text{lease\_until} - \text{now}) / 86400000 \rfloor)$；
  - 扩建差价 $= (R_{\text{new}} - R_{\text{old}}) \times D_{\text{rem}}$；
  - 确认后仅扣除这笔差价，面积向外扩展，`lease_until` 保持完全不变。
- **欠租与 7 天休眠保护状态机（Lease Expiration State Machine）**：
  - **定时扫描调度**（每小时周期任务）：
    - 若 `now > lease_until` 且 `status == 'active'`：
      - 状态流转为 `status: 'dormant'`，设定 `grace_until = now + 7 * 86400000`；
      - 暂停领地内环境增益与公共门票传送，向主人推送欠租离线/在线预警；
      - **核心保证：建筑结构依然处于不可破坏保护之中**，防止退服悲剧；
    - 若玩家在宽限期内补交租金（`renewLease`）：
      - 状态瞬间恢复为 `status: 'active'`，`lease_until = now + renewedDays * 86400000`，增益重新激活；
    - 若 `now > grace_until` 且仍未补交租金：
      - 状态流转为 `status: 'terminated'`；
      - 契约正式终止！调用 `area.unregisterArea` 销毁空间保护，清除 `DebugBox`；
      - 地皮重新归入大自然或允许全服新玩家拓荒，彻底杜绝死服僵尸鬼城！
      - 调用 `activity.record` 归档 `land.lease_terminated`。
- **门票结算流水线（两阶段无双花）**：
  - 访客发起 `/land tp <name>` $\to$ `economy.account.debit` 扣减访客门票 $\to$ `economy.account.credit` 全额划入领地主人（个人或合作社公账）$\to$ 安全传送并派发迎宾 Title。

## 8. Acceptance criteria

- [ ] 彻底确立土地租赁契约制，无永久买断地皮
- [ ] 放置守护基石自动生成领地并签署契约，支持 DDUI 滑块实时扩建补差
- [ ] `@minecraft/debug-utilities` 的 `DebugBox` / `DebugText` 硬件级线框与 3D 浮空名牌渲染正常（不支持时优雅降级为粒子边界）
- [ ] 欠租 7 天休眠保护机制有效（建筑受保护，增益暂停，7天内续租满血复活，超时终止契约自然回收）
- [ ] 续租充能支持节操币与原版矿物（煤/铁/金/绿宝石/钻石）双轨折算
- [ ] 门票商业系统生效，访客传送费秒级入账主人钱包或组织公账（`coop:<id>`）
- [ ] 彻底移除旧 `sfmc_land_audit_logs` 表，治理与变更全量由 `activity.record` 审计
- [ ] 领地空间全面托管至 `area` 微内核，进出 Actionbar 提示与环境增益派发生效
- [ ] 启动期成功向 `gui` 挂载 SPA 租赁控制台，无需 `gui` 内部硬编码
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 领地子摊位转租系统（Sub-lease）
- 违约清退时原主人室内贵重容器打包进“云端失物招领箱”

## 10. Legacy reference（仅参考）

- `packages/land/`（彻底废除旧版买断制，全面重构为「只租不卖」现代土地租赁契约生态）
