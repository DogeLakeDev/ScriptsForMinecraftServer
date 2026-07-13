我建议把 `land` 重新设计成一个“领地服务模块”，而不是继续扩展当前的 `LandDatabase + LandCore + LandEvents + LandGUI` 结构。

当前实现适合原型，但不适合作为长期数据和权限系统。主要问题是：

- ~~数据完全存在进程内 `Map`，重启丢失。~~
- ~~创建土地和扣款不是事务。~~（L1 已将土地创建、重叠检查和土地状态写入 SQLite 事务；Minecraft 计分板经济仍由 SAPI 负责扣款。）
- 查询土地使用全量遍历，土地数量增加后性能会下降。
- ~~权限只有 4 个布尔值，无法覆盖真实管理需求。~~（L2 已加入角色能力和土地设施权限。）
- ~~`managers` 同时承担“成员”和“管理员”概念，模型不清晰。~~（`members.role` 为权威模型，`managers` 仅保留为兼容投影。）
- ~~删除土地时，管理员也可以获得退款，存在经济权限问题。~~
- ~~价格公式使用 `Function()` 执行，不应保留。~~
- ~~领地重叠检查、范围检查、土地创建都在 SAPI 本地完成，无法防止并发创建。~~
- ~~保护事件已扩展到可靠的方块交互、实体交互和爆炸拦截。~~桶、活塞、火焰、流体等仍受当前 SAPI 事件能力限制，待后续专项处理。

**推荐的新结构**

```text
land/
  LandModule.ts             # 模块生命周期入口
  domain/
    Land.ts                 # 领域模型和状态
    LandPolicy.ts            # 权限、价格、限制规则
    LandGeometry.ts          # 范围、重叠、边界、分区计算
  application/
    LandService.ts          # 创建、删除、转让、邀请、设置权限
    LandProtectionService.ts # 事件授权判断
    LandQueryService.ts      # 位置查询、玩家土地查询
  infrastructure/
    LandApi.ts               # db-server HTTP API
    LandCache.ts             # 本地只读缓存
    LandMapper.ts            # API 数据转领域对象
  presentation/
    LandCommands.ts
    LandGUI.ts
  events/
    LandEvents.ts
```

关键原则：

- SAPI 不再拥有土地的最终数据。
- db-server 是土地数据和交易规则的权威源。
- SAPI 只保存短期会话、只读缓存和事件处理所需的索引。
- 所有写操作都经过 `LandService`，GUI 和命令不能直接操作数据库。
- 所有权限判断必须使用统一的 `LandPolicy`。

**新的数据模型**

建议拆成多张表，而不是把所有内容塞在一个 JSON 对象里。

```text
sfmc_lands
  id
  owner_player_id
  owner_name_snapshot
  dimension
  min_x
  min_y
  min_z
  max_x
  max_y
  max_z
  name
  status
  created_at
  updated_at
  expires_at
  protection_profile
  version

sfmc_land_members
  land_id
  player_id
  player_name_snapshot
  role
  created_at
  expires_at

  ~~sfmc_land_permissions~~
  land_id
  permission_key
  subject_type
  subject_id
  allowed
  updated_at

  ~~sfmc_land_invites~~
  id
  land_id
  inviter_id
  invitee_id
  role
  expires_at
  status

sfmc_land_transactions
  id
  land_id
  player_id
  type
  amount
  refund_amount
  reason
  created_at

  ~~sfmc_land_audit_logs~~
  id
  land_id
  actor_id
  action
  payload
  created_at
```

`status` 建议至少包括：

```text
active
frozen
transferring
expired
deleted
```

不要直接物理删除土地。删除后保留记录和审计信息，必要时再做归档清理。

**角色设计**

当前 `managers: string[]` 不够用。建议角色分为：

```text
owner       所有权、转让、删除、财务
admin       成员和权限管理
builder     放置、破坏、建造
container   容器和工作站
visitor     进入和查看
redstone    红石设备
entity      实体交互
```

权限则改成字符串能力：

```text
land.enter
land.place
land.break
land.use_container
land.use_door
land.use_button
land.use_redstone
land.attack_entity
land.interact_entity
land.pickup_item
land.manage_members
land.manage_permissions
land.rename
land.transfer
land.delete
```

这样可以支持：

- 玩家级权限
- 角色级权限
- 默认权限
- 临时权限
- 黑名单覆盖白名单
- 特定区域覆盖整个土地默认设置

**查询和性能设计**

不要每次事件都执行：

```ts
Database.getAll().find(...)
```

推荐两级查询：

1. db-server 负责创建和更新土地时做重叠检查。
2. SAPI 内存缓存按维度和区块建立索引：

```text
dimension -> chunkKey -> landId[]
```

玩家交互时：

```text
坐标 -> chunkKey -> 候选土地 -> 精确 AABB 判断
```

土地变化后由 API 返回新的土地版本，SAPI 更新缓存。这样事件判断不需要每次遍历全部土地。

db-server 端也应该增加：

```text
GET  /api/sfmc/lands
GET  /api/sfmc/lands/:id
GET  /api/sfmc/lands/by-owner/:playerId
GET  /api/sfmc/lands/at/:dimension/:x/:y/:z
POST /api/sfmc/lands/validate
POST /api/sfmc/lands
PATCH /api/sfmc/lands/:id
DELETE /api/sfmc/lands/:id
POST /api/sfmc/lands/:id/transfer
POST /api/sfmc/lands/:id/members
DELETE /api/sfmc/lands/:id/members/:playerId
```

**创建流程**

当前流程需要改成服务端事务：

```text
1. 玩家设置 pos1 / pos2
2. SAPI 只做预览验证
3. 玩家确认
4. SAPI 调用 POST /lands
5. db-server 在事务中：
   - 验证坐标合法
   - 验证土地数量
   - 验证与现有土地不重叠
   - 计算最终价格
   - 扣除玩家货币
   - 写入土地
   - 写入交易日志
6. 返回土地对象
7. SAPI 更新缓存并清理申请会话
```

重要的是：价格不能由客户端传入，必须由 db-server 根据配置和坐标重新计算。

**必须修复的单项功能**

1. **价格计算**
   - 删除 `Function()`。
   - 改成有限表达式解析器，或者只允许固定公式配置。
   - 限制最大结果、负数、Infinity、NaN。
   - 使用整数计算，避免小数经济问题。
   - 价格配置应由 db-server 管理。

2. **删除和退款**
   - 只有 owner 可以删除。
   - admin 只能在明确的全局管理权限下删除。
   - manager 不应该自动获得退款。
   - 删除、退款、审计日志必须在同一个事务中完成。

3. **管理者管理**
   - 当前在线玩家选择方式无法管理离线玩家。
   - 改为输入玩家名或选择历史玩家。
   - 通过 player ID 作为真实主键，名字仅作为快照。
   - 加入邀请、过期和接受流程。

4. **重叠检测**
   - 创建土地必须由 db-server 原子检查。
   - 同一时间两个玩家创建相交土地时，只允许一个成功。
   - 需要明确是否允许 Y 轴重叠：
     - 普通领地：通常按 XZ 平面判断。
     - 立体领地：按 XYZ 判断。
   - 建议第一版固定为 XZ 领地，减少保护逻辑复杂度。

5. **保护事件**
   第一阶段至少覆盖：

   - 放置/破坏方块
   - 容器、门、活板门、按钮、拉杆、压力板
   - 工作台、熔炉、酿造台、唱片机
   - 实体交互
   - 实体攻击
   - 物品拾取
   - 桶装水/岩浆
   - 活塞推动
   - 火焰扩散
   - 爆炸
   - 流体流动
   - 投射物

   对无法可靠取消的事件，应使用“事件前检查 + 事件后回滚/补偿”，并在文档中明确限制。

6. **土地边界反馈**
   增加：

   - 进入土地提示
   - 离开土地提示
   - 当前土地查询命令
   - 边界粒子或临时边框
   - 土地名称和所有者显示
   - 保护失败时显示具体权限原因

7. **缓存一致性**
   - 每块土地带 `version`。
   - SAPI 缓存只接受更高版本。
   - API 修改成功后主动刷新对应土地。
   - 热重载或 db-server 重启后重新拉取完整快照。
   - 缓存失效时保护逻辑应选择 fail-open 或 fail-closed，并配置化。保护模块建议默认 fail-closed，但要避免数据库短暂故障导致全服无法建造，可以采用“已有缓存继续使用，新区域拒绝写操作”。

**可以加入的创新功能**

1. **土地模板**
   - 玩家保存一套权限模板。
   - 新土地自动使用模板。
   - 例如“私人住宅”“公共商店”“红石工厂”。

2. **土地租赁**
   - 所有者出租土地或子区域。
   - 支持租期、租金、自动到期。
   - 到期后自动冻结而不是立即删除。

3. **子区域**
   - 土地内部划分更小区域。
   - 商店区、农场区、公共区可以拥有不同权限。
   - 这比让玩家购买大量小土地更灵活。

4. **合作建设**
   - 角色级权限。
   - 临时施工权限。
   - 施工结束后自动回收权限。

5. **土地市场**
   - 转让、出售、挂牌。
   - 交易由 db-server 事务完成。
   - 记录完整交易历史。

6. **保护审计**
   - 记录被拒绝的操作。
   - 玩家可以查看“谁尝试打开了我的箱子”。
   - 高频失败事件需要采样，不能全部写数据库。

7. **活跃度和维护**
   - 记录最近访问时间。
   - 长期无人使用的土地进入提醒、冻结、回收候选。
   - 回收前支持申诉和续期。

8. **地图/领地可视化**
   - 通过粒子显示边界。
   - 管理面板查看土地占用和冲突。
   - 后期可以导出为地图数据。

**建议的实现阶段**

**阶段 L1：基础重构**

- ~~db-server 新增 `sfmc_lands` 和成员表。~~
- ~~实现创建、查询、更新、删除 API。~~
- ~~服务端完成重叠检查、价格计算和事务。~~
- ~~SAPI 改为 API + 缓存。~~
- ~~保留现有 GUI 流程，先不加入复杂新功能。~~

**阶段 L2：权限完整化**

- ~~角色和权限模型。~~
- ~~邀请、管理者、转让。~~
- ~~扩展容器、门、按钮、实体交互保护。~~
- ~~增加审计日志。~~

**阶段 L3：体验和性能**

- ~~区块索引缓存。~~
- ~~边界提示和可视化。~~（已实现进入/离开提示和 `!land here`，粒子边界仍可后续增强。）
- ~~批量查询。~~
- ~~缓存版本控制。~~
- ~~保护事件耗时指标。~~

**阶段 L4：创新功能**

- 子区域。
- 租赁。
- 土地模板。
- 市场和活跃度回收。
- 管理面板地图视图。

我建议第一版不要直接实现租赁、市场和子区域。先把“持久化、原子创建、正确退款、角色权限、事件保护、缓存查询”做好，否则新功能只会把数据一致性问题扩大。
