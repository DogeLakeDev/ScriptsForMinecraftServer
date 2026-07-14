# 合作社系统重构方案

> 日期：2026-07-14  
> 状态：业务规则已确认，技术方案规划中  
> 关联文档：[economic-reform-plan.md](./economic-reform-plan.md)、[landgui-reactor.md](../landgui-reactor.md)、[lands-reactor.md](../lands-reactor.md)

## 一、目标

将合作社从当前的 CRUD 数据插件重构为可靠的组织、财政和集体商店系统。

核心目标：

- db-server/SQLite 是合作社、成员、库存和资金的权威来源。
- SAPI 只负责会话、缓存、GUI 和游戏内物品交互。
- 所有写操作由服务端执行权限检查。
- 资金、合作社银行、库存和交易流水在服务端事务中保持一致。
- 合作社权限模型与领地使用同样的 Owner/Admin/普通角色思路。
- 合作社支持离线成员和基于玩家 ID 的身份识别。
- GUI 使用与 LANDGUI 相同的 `runTask()`、`rebuild()`、`replace()`、typed error 和缓存刷新模式。

## 二、已确认业务规则

### 成员关系

- 一个玩家只能加入一个有效合作社。
- 成员身份使用 `player_id`，玩家名称只作为显示快照。
- 支持离线成员、离线邀请和服务端记录的成员操作。
- 合作社至少包含 `owner`、`admin`、`member` 三类角色。
- 不再以 `is_op` 作为最终权限模型。

### 银行

- 所有成员都可以存入合作社银行。
- 所有成员都可以取出合作社银行资金。
- 提现额度、审批和大额风险控制作为后续可选能力保留。
- 银行资金属于合作社，不属于某个成员。
- 银行交易必须同时更新玩家账户、合作社账户和流水。

### 商店

- 商品成交款直接记入实际卖家账户，卖家可以离线收款。
- 合作社从每笔成交款中收取中间手续费，手续费进入合作社银行账户。
- 手续费比例由 Owner 设置并由服务端校验，普通成员不能修改；比例变更只影响之后创建的订单。
- 商店分为两个明确功能：
  - 合作社库存出售：合作社托管库存并向买家出售。
  - 成员求购：合作社发布需求，其他成员提交物品后获得付款。
- 上架库存时立即从玩家背包扣除物品，库存归合作社托管。
- 下架时将库存返还给操作人或按明确的库存所有权规则处理。
- 当前“回收”功能重新定义为“求购”，不再沿用含义不清的旧字段。
- 库存出售的成交结算必须在一个服务端事务中完成：订单状态、买家扣款、物品交付、卖家账户入账和合作社手续费入账一致。
- 求购订单的付款直接进入提交物品的成员账户；手续费仍进入合作社银行，且支持卖家离线入账。

### 领地关联

- 一个合作社可以绑定多块领地。
- 合作社可以作为领地的组织主体参与管理。
- 合作社角色可以映射到领地角色，例如：
  - 合作社 Admin -> 领地 Admin
  - 合作社建造角色 -> 领地 builder
  - 合作社仓库角色 -> 领地 container
- 领地仍由土地服务端执行最终权限判断，合作社只提供组织关系和角色来源。
- 绑定、解绑和角色映射必须有服务端权限和审计记录。

### 解散

- 默认规则：解散前必须清空合作社银行和库存资产。
- 解散时保留合作社历史、成员记录、银行流水和审计日志，不直接物理删除历史数据。
- 未来可增加第二种解散方案：按成员贡献比例分配剩余资产。
- 解散费用和分配规则必须在提交解散请求时明确展示并二次确认。

### 创建费用

- 创建合作社费用为 `1000 节操`。
- 创建成功后费用不退还。
- CID 冲突、余额不足、服务端异常时不得扣款。
- 创建、扣费、Owner 成员创建、合作社账户创建必须在一个服务端事务内完成。

## 三、当前实现评价

当前合作社由以下几层组成：

```text
CoopGUI -> CoopCore -> CoopAPI -> db-server CRUD -> SQLite
```

优点：

- 已经从旧的进程内存储迁移到 db-server/SQLite。
- 已具备合作社、成员、银行、商品、分组和日志的基本数据表。
- GUI 已覆盖创建、加入、公告、成员、银行和商店的主要入口。
- 经济系统已经有统一的 `Money` API 和 SQLite 账户表。

主要问题：

- 服务端没有合作社领域权限边界，权限主要由 GUI 隐藏按钮实现。
- 成员使用玩家名称而不是稳定 ID。
- 银行操作是多次独立 HTTP 请求，不具备原子性。
- 创建合作社可能扣款后创建失败。
- 解散会删除资产和历史记录。
- 商店库存与玩家背包不是同一事务。
- 商品上架当前可能不扣除玩家物品，存在凭空增加库存风险。
- `MenuNavigator.go()` 与合作社动态状态不兼容。
- 合作社大量异步操作没有使用统一的任务状态和错误处理。
- API 将网络错误、权限错误、空数据和不存在混为 `null`、`false` 或空数组。
- `is_op`、`player_name`、`money` 等旧字段语义过于宽泛。
- 合作社与领地、经济的身份、角色、审计和缓存模型不统一。

## 四、P0 止血问题

### 1. 服务端权限校验

所有合作社写接口都必须携带 `actorId`，服务端必须验证：

- 操作者是否是合作社成员。
- 操作者是否拥有目标能力。
- 目标成员是否存在。
- 目标角色是否允许被当前操作者修改。
- 合作社是否处于允许写入的状态。

禁止客户端直接提交并信任：

- `is_op`
- `money`
- `owner_name`
- 任意成员数组
- 任意商品库存数量

### 2. 创建事务

新增服务端领域接口：

```text
POST /api/sfmc/coops/create
```

服务端事务：

```text
BEGIN IMMEDIATE
  校验 CID 唯一性
  校验玩家不存在有效合作社
  校验玩家余额
  扣除 1000 节操
  创建合作社
  创建 Owner 成员
  创建合作社账户
  写经济流水
  写合作社审计日志
COMMIT
```

不得使用 `INSERT OR REPLACE` 覆盖已有合作社。

### 3. 银行原子交易

新增：

```text
POST /api/sfmc/coops/:cid/treasury/deposit
POST /api/sfmc/coops/:cid/treasury/withdraw
```

事务内同时完成：

- 玩家账户扣款或入账。
- 合作社账户增加或扣减。
- 合作社版本递增。
- 经济流水写入。
- 合作社银行流水写入。
- 合作社审计日志写入。

返回双方账户快照、合作社版本和 transaction ID。

### 4. 解散资产保护

默认解散条件：

- 合作社银行余额必须为零。
- 托管库存必须为空。
- 没有未完成求购订单。
- 没有待处理资金交易。

不满足条件时返回明确错误，不允许 GUI 仅通过提示绕过。

### 5. 商品托管和防复制

库存型出售流程：

```text
验证商品和数量
验证成员操作权限
从玩家背包扣除物品
创建服务端库存批次/托管记录
写库存审计
COMMIT
```

下架流程必须在服务端确认库存归属和数量后，再返还物品。任何保存失败都不能继续执行 `give` 或 `clear`。

求购流程：

```text
创建求购需求
成员提交物品
服务端验证物品类型和数量
扣除提交者物品
从合作社账户付款
写订单和流水
完成提交
```

## 五、目标数据模型

### 合作社

```text
sfmc_coops
  cid
  name
  owner_player_id
  status              active/frozen/dissolving/dissolved
  notice
  created_at
  updated_at
  version
```

### 成员

```text
sfmc_coop_members
  cid
  player_id
  player_name_snapshot
  role                owner/admin/member
  joined_at
  expires_at
  status              active/invited/removed
  version
```

约束：

- `(cid, player_id)` 唯一。
- 一个玩家只能拥有一个 active 合作社成员关系。
- Owner 必须唯一。

### 合作社账户

```text
sfmc_coop_accounts
  cid
  balance
  version
  updated_at
```

不再把合作社银行余额作为普通客户端 PATCH 字段。

### 商店库存

```text
sfmc_coop_inventory
  id
  cid
  item_type
  item_aux
  item_nbt
  quantity
  source_player_id
  status              held/listed/reserved/returned/sold
  created_at
  updated_at
```

### 商店商品与求购

```text
sfmc_coop_listings
  id
  cid
  listing_type        sell/buy_request
  item_type
  item_aux
  item_nbt
  price
  quantity
  remaining_quantity
  seller_or_requester_id
  status              active/paused/completed/cancelled
  created_at
  updated_at
```

### 订单

```text
sfmc_coop_orders
  id
  cid
  listing_id
  buyer_id
  seller_or_submitter_id
  quantity
  amount
  status              pending/paid/delivered/refunded/failed
  transaction_id
  created_at
  updated_at
```

### 审计

```text
sfmc_coop_audit_logs
  id
  cid
  actor_id
  target_id
  action
  before_state
  after_state
  transaction_id
  created_at
```

## 六、与领地和经济系统统一

### 身份统一

经济、领地和合作社全部使用 `player_id`：

```text
player_id        权限和账户主键
player_name_snapshot  显示文本
```

### 权限统一

统一采用角色和能力：

```text
Owner -> transfer/delete/manage admins
Admin -> manage members/shop/notice
Member -> view/deposit/withdraw/use allowed services
```

具体能力由 `CoopPolicy` 计算，GUI 只负责隐藏入口，db-server 负责最终校验。

### 经济统一

合作社必须复用 SQLite 经济账户和统一交易流水：

- 所有金额使用 `Money.UNIT` 的 `节操`。
- 所有领域交易返回账户余额和版本。
- 所有交易支持幂等键。
- 所有交易写入 transaction ID。
- 商品成交款进入卖家账户，合作社只收取配置的中间手续费；卖家账户允许离线创建和入账。

### 缓存统一

SAPI 端合作社缓存与土地缓存遵循相同原则：

- 只保存最后一次成功快照。
- 请求失败不能用空数组覆盖旧数据。
- 写操作使用服务端返回的新版本更新缓存。
- 版本较旧的响应不能覆盖新缓存。
- 首次加载未完成时显示加载/服务不可用，而不是空数据。

### GUI 统一

合作社 GUI 应迁移到 LANDGUI 已使用的模式：

- 所有异步写操作使用 `nav.runTask()`。
- 动态状态改变后使用 `rebuild()` 或 `replace()`。
- 不使用 `go()` 承载依赖动态状态的页面。
- 所有危险操作使用 `MessageBox`。
- 所有 API 错误显示具体错误码和恢复建议。
- 每个玩家只允许一个活动合作社导航器。

## 七、重构后的代码结构

SAPI：

```text
scripts/coop/
  CoopSystem.ts
  CoopCore.ts
  CoopPolicy.ts
  CoopCache.ts
  CoopSession.ts
  CoopInventory.ts
```

API：

```text
scripts/api/
  CoopApi.ts
  CoopTreasuryApi.ts
  CoopMarketApi.ts
```

服务端：

```text
db-server/
  services/
    coop-service.js
    coop-treasury-service.js
    coop-market-service.js
    coop-audit-service.js
```

GUI：

```text
合作社中心
├─ 当前合作社
├─ 成员与角色
├─ 公共银行
├─ 集体商店
│  ├─ 库存出售
│  ├─ 求购需求
│  ├─ 我的托管库存
│  └─ 订单与流水
├─ 领地绑定
├─ 公告与通知
└─ 设置与解散
```

## 八、实施路线

### Phase 1：止血

- [x] 服务端补齐合作社权限校验基础。
- [x] 合作社成员模型改为 `player_id`。
- [x] 新 API 禁止客户端直接 PATCH `money` 和成员数组。
- [x] 创建合作社改为服务端原子事务。
- [x] 银行存取款改为服务端原子交易。
- [x] 解散前检查银行和库存资产。
- [x] 修复 `INSERT OR REPLACE` 覆盖合作社的问题（权威合作社写入路由已禁用旧写入）。
- [ ] 修复所有商店操作忽略失败结果的问题。
- [ ] 修复商品上架未扣除物品的问题。

### Phase 2：统一架构

- [x] 引入服务端合作社能力矩阵基础。
- [ ] 引入 `CoopCache`、版本和错误状态。
- [ ] API 改为 typed result。
- [x] 增加合作社审计日志。
- [x] 增加合作社账户表。
- [x] 统一合作社银行响应、transaction ID 和经济流水。
- [ ] 将 CoopGUI 迁移到 `runTask/rebuild/replace`。
- [x] 隔离旧合作社写入路由；`Database.ts` 保留为领地数据库兼容层。

### Phase 3：商店重构

- [ ] 实现托管库存模型。
- [ ] 实现库存出售订单。
- [ ] 实现求购需求和提交订单。
- [ ] 实现支付、交付、退款和失败状态。
- [ ] 商品成交款离线入账卖家账户，手续费进入合作社银行。
- [ ] 增加库存和订单审计。

### Phase 4：领地关联

- [ ] 合作社绑定多块领地。
- [ ] 设计合作社角色到领地角色的映射。
- [ ] 绑定和解绑使用服务端权限和审计。
- [ ] 领地保护判断支持组织角色来源。
- [ ] 处理合作社成员变更后的领地权限刷新。

### Phase 5：扩展功能

- [ ] 解散时按贡献比例分配资产的可选流程。
- [ ] 大额提现审批。
- [ ] 合作社工资、分红和公共支出。
- [ ] 合作社任务和贡献值。
- [ ] 合作社公共工程和长期项目。

## 九、测试清单

### 服务端自动化测试

- [ ] 未授权调用不能修改合作社。
- [ ] 普通成员不能修改角色和商店规则。
- [ ] 一个玩家不能加入多个有效合作社。
- [ ] 创建 CID 冲突不会扣款。
- [ ] 创建异常会回滚扣款。
- [ ] 并发存款不会覆盖余额。
- [ ] 并发取款不会透支合作社账户。
- [ ] 银行交易同时写入双方账户和流水。
- [ ] 解散前有资产时被拒绝。
- [ ] 解散后保留审计和历史流水。
- [ ] 上架失败不会丢失玩家物品。
- [ ] 上架成功会扣除玩家物品。
- [ ] 下架失败不会重复返还物品。
- [ ] 库存出售不会重复发货或扣款。
- [ ] 求购提交不会重复扣物品或付款。
- [ ] 幂等请求不会重复扣款。
- [ ] 过期成员不能继续执行需要权限的操作。

### Bedrock 手动测试

- [ ] 玩家重名/改名不影响成员关系。
- [x] 服务端在线/离线邀请状态和 player_id 接受流程。
- [ ] 所有成员可以存入和取出银行。
- [ ] 银行余额和个人余额及时更新。
- [ ] 上架后背包物品正确减少。
- [ ] 下架后托管物品正确返还。
- [ ] 库存出售成交款进入卖家账户，手续费进入合作社银行。
- [ ] 求购提交正确支付成员。
- [ ] 多次快速点击不会重复交易。
- [ ] 关闭 GUI 后异步结果不会重新打开旧页面。
- [ ] 合作社绑定领地后角色权限正确同步。
- [ ] 解散时有余额或库存会被阻止。

## 十、待后续确认的细节

以下问题不阻塞第一阶段，但会影响后续设计：

- 成员取款是否需要每日额度。
- 大额取款阈值和是否需要 Owner 审批。
- 多领地绑定时合作社角色如何映射到每块领地。
- 求购价格由合作社固定、成员投标，还是允许多个求购单并存。
- 托管库存下架时返还原上架人，还是进入合作社公共库存。
- 解散时的第二种按贡献分配方案如何计算贡献。
- 成员退出时其托管库存和未完成订单如何处理。
- 手续费比例的上下限和变更是否需要成员通知或冷却期。

## 当前验证命令

```powershell
cd scriptsforminecraftserver
npm run build

cd ..\db-server
node --check index.js

cd ..
node tools/test-db-api.js
git diff --check
```
