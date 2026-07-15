> 总体状态：领地基础修复已完成；经济系统和合作社系统仍需按阶段重构。  
> 详细方案：[docs/coop-reform-plan.md](docs/coop-reform-plan.md)、[docs/economic-reform-plan.md](docs/economic-reform-plan.md)、[docs/land-audit-and-plan.md](docs/land-audit-and-plan.md)

# 修复清单

## 一、领地系统

### 已完成

- [x] 修复申请入口未初始化选点会话。
- [x] 修复创建土地后详情页状态键不一致。
- [x] 修复创建失败统一显示“请重试”，保留服务端错误。
- [x] 修复数据库加载失败时清空已有土地缓存。
- [x] 修复普通土地更新导致成员角色被提升为 Admin。
- [x] 修复折扣购买后删除土地的退款套利。
- [x] 修复并发删除重复退款。
- [x] 修复并发转让产生多个 Owner。
- [x] 选点会话绑定维度，禁止跨维度选点。
- [x] 清理玩家离开和过期的选点会话。
- [x] 增加土地缓存定时刷新和权威快照状态。
- [x] 修复土地事件订阅清理。
- [x] 增加实体攻击和掉落物拾取保护。
- [x] 使用项目 Permission 等级代替通用 `op`/`admin` 标签绕过。
- [x] 增强容器方块保护。
- [x] 购买和退款后同步 Money 缓存。
- [x] 增加 DB Bearer Token 支持。
- [x] 为 GUI 增加导航器 session token，防止关闭页面后异步请求重新打开旧 GUI。

### 待完成

详细方案：[docs/land-audit-and-plan.md](docs/land-audit-and-plan.md)

#### P0

- [ ] GUI 删除失效（plan.md 历史项，仍未解）
- [ ] GUI 转让离线目标 MSG 不可见（同上）
- [ ] `LandDatabase.ts` 死字段 `memoryStore/writeJSON/readJSON` 清理
- [ ] `createLandTransaction` 双 `validateLandInput` 合并
- [ ] `LandCore.calculatePrice` 改远端报价
- [ ] `LandApi` typed result（删/转/接受邀请等）

#### P1

- [ ] 角色枚举 / 权限矩阵单源化
- [ ] `playerInteractWithBlock` 重复订阅合并
- [ ] 爆炸防护批量查询优化
- [ ] `_config` 改为定期从服务端刷新
- [ ] 移除 `land.managers` 冗余字段

#### P2 远见（挑 1-2 落地）

- [ ] **A.** 领地名片（一键邀请 + 离线信箱）
- [ ] **B.** 领地粒子护盾（彩色边界 + 标题栏）
- [ ] **C.** 土地二级市场（listings 表 + 撮合）
- [ ] **D.** 公共广场 + 新人引导

#### 验收

- [ ] Bedrock 手动验证启动期间保护是否 fail-closed。
- [ ] Bedrock 手动验证实体攻击、拾取、投射物、TNT、火焰、流体和自动化装置。
- [ ] Bedrock 手动验证模块 disable/re-enable 不重复监听。
- [ ] 为土地 API 增加完整 typed error/result。（→ 步骤 5）
- [ ] 为土地写操作增加幂等键和版本冲突处理。（→ server 已带幂等，client typed 后 6）

## 二、经济系统

### P0

- [x] 重构 Money 缓存为 `{ balance, version, loadedAt, loading }` 快照。
- [x] 区分 `getCached()` 与加载账户，未加载余额不再作为缓存有效值。
- [x] 使用账户版本阻止旧请求覆盖新缓存。
- [x] 经济交易返回完整账户快照、版本和 transaction ID。
- [x] 土地购买接口沿用交易后的最终余额。
- [x] 转账接口返回 source/target 双方账户快照。
- [x] 增加交易幂等键，防止 HTTP 超时重试重复扣款。
- [x] 限制 `sourcePlayerId` 必须与操作者一致。
- [ ] 将土地、合作社商店、红包和合作社交易改为服务端领域事务。

### P1

- [x] 移除或限制不安全的 `Money.set()` 读改写接口。
- [ ] 统一双账户流水的 before/after balance 表达。
- [ ] 合作社商店购买保证扣款、库存和物品交付一致。
- [ ] 合作社商店出售保证扣物品和入账一致。
- [x] 红包创建保证扣款和红包创建一致。
- [x] 红包领取保证红包状态和入账一致。
- [x] 合作社银行保证玩家账户和合作社账户一致。
- [ ] 统一货币单位为 `Money.UNIT`。
- [ ] 统一经济 API 错误码和网络错误处理。

## 三、合作社系统

详细方案见：[docs/coop-reform-plan.md](docs/coop-reform-plan.md)

### P0 止血

- [x] 服务端补齐合作社 Owner/Admin/Member 权限校验基础。
- [x] 成员模型从玩家名称迁移到 `player_id` 和名称快照。
- [x] 新 API 禁止客户端直接修改合作社 `money` 和成员数组。
- [x] 创建合作社改为扣费、建社、建 Owner、建账户同一事务。
- [x] CID 冲突不得覆盖已有合作社。
- [x] 银行存取款改为原子领域交易。
- [x] 解散前检查银行余额和库存资产。
- [x] 解散后保留历史记录和审计日志。
- [ ] 修复商品上架、补货、下架和回收库存的复制/丢失风险。
- [ ] 上架托管库存时立即扣除玩家物品。
- [ ] 将“回收”功能明确重构为“求购”,完全移除原来的“回收”。
- [ ] 上架物品时显示错误:

```error
TypeError: Provided value cannot be bound to SQLite
at query (D:\#WorkPlace\#MCBEProjects\ScriptsForMinecraftServer\db
at handle (D:\#WorkPlace\#MCBEProjects\ScriptsForMinecraftServer\d
process.processTicksAndRejections (node:internal/process/task_q
code: 'ERR_INVALID_ARG_TYPE' }
```

- [ ] 合作社在银行取款或存款均显示金额不正确（实际上没问题）

```log
请求： [*] [HTTP] POST /api/sfmc/coops/111/treasury/withdraw 409 1ms
```

### P1 统一架构

#### GUI需要重构

- [ ] 重构gui页面，遵循易用、美观、方便原则，不浪费每一个为此插件而创造的接口
- [ ] CoopGUI 全面迁移到 `runTask()`、`rebuild()`、`replace()`。
- [ ] 社长不应该能把自己提升权限 gui问题

- [x] 引入服务端合作社能力矩阵基础。
- [ ] 与领地、频道、经济系统达成联动，丰富功能
- [ ] 引入合作社缓存、版本和错误状态。
- [ ] 合作社 API 改为 typed result。
- [ ] 删除或隔离旧 `Database.ts` 和 `is_op` 数据模型。
- [x] 增加合作社审计日志和 transaction ID 关联。
- [x] 独立合作社账户表，不再直接 PATCH `sfmc_coops.money`。
- [x] 成员加入、邀请和银行入账使用 player_id，支持离线账户。

### P2 扩展

#### 合作社商店需要重构、增加领地角色等特色功能、强化合作社经济系统、增强玩家关系性与社交属性

- [ ] 实现库存出售订单。
- [ ] 实现成员求购订单。
- [ ] 实现支付、交付、退款和失败状态。

- [ ] 支持合作社绑定多块领地。
- [ ] 支持合作社角色到领地角色的映射。
- [ ] 增加解散时按贡献比例分配资产的可选方案。
- [ ] 增加大额提现审批。
- [ ] 增加合作社工资、分红、任务和贡献值。

## 四、统一测试

- [ ] 余额缓存首次加载和并发刷新测试。
- [x] 交易超时重试幂等测试。
- [ ] 领地并发删除和转让测试。
- [ ] 领地成员角色保持测试。
- [ ] 领地过期成员权限测试。
- [x] 合作社未授权调用测试。
- [x] 合作社 CID 冲突回滚测试。
- [x] 合作社并发存取款基础事务测试。
- [x] 合作社解散资产保护测试。
- [ ] 合作社库存托管和订单测试。
- [x] 合作社手续费比例权限测试。
- [x] DB token 鉴权测试。
- [x] Bedrock GUI 关闭、UserBusy、网络失败和快速重复点击测试。

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
