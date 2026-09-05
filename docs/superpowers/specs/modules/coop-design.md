# coop — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 实现玩家合作社的全生命周期组织管理（创建、加入、转让、退出、解散）、独立公有金库资产存取，以及合作社活跃排行榜；提供紧凑高效的命令行与交互体验。

**Non-goals:**
- 首版不引入重量级全屏独立表单 GUI（由 `gui` 主菜单统一提供快捷提示与 `!coop` 交互指引）
- **暂不内置独立的合作社商店（`coopshop`）**：商品买卖与特权折扣应归并至全服主商店系统中，后续由合作社将主商店作为可选依赖进行挂接集成
- **不自建孤立金库账本（遵循 DRY）**：合作社公账直接委托 `economy` 模块统一托管（命名空间为 `coop:<cid>`）；`coop` 仅负责成员关系管理与提现权限鉴权，杜绝维护私有账本与流水
- **不自建独立审计日志表（遵循 DRY）**：合作社内的重要治理操作（创建、转让、踢人、权限变更、解散）统一通过 `activity.record` 插槽上报至平台行为日志系统（`activity-log`），消除审计数据孤岛

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `coop` |
| npm | `@sfmc-bds/module-coop` |
| manifest.id | `coop` |
| configKey | `coop` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["economy", "activity-log"]`（必选硬依赖） |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `coop` / `coop create\|join\|leave\|bank\|rank` | `coop.use` | Member | 合作社生命周期与金库/排行 |

登记 `coop.admin` = Admin（等级 2）供合作社管理与干预操作。

## 4. Data

| 表名 | 关键列 |
|------|--------|
| `sfmc_coops` | cid, name, owner_*, timestamps |
| `sfmc_coop_members` | cid, player_id, role(owner/admin/member), joined_at |
| `sfmc_coop_invites` | 邀请（若实现邀请流） |

金库资产完全委托 `economy` 模块托管，审计日志统一委托 `activity-log` 模块归档；本模块仅维护核心领域实体关系，本地零多余冗余表。

## 5. Config

首版可无文件配置；金库最大存取限额或规则限制等后续写入 `configs/coop.json`。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `coop.byId` | `{ cid }` | coop 或 null | |
| `coop.list` | `{ limit? }` | `{ items[] }` | |
| `coop.byPlayer` | `{ playerId }` | 成员关系 / coop 摘要 | |

**必须实际 `service.provide`，不得只写在 manifest。**

### requires

| name | 来自 | 用途 |
|------|------|------|
| `economy.account.get` | [economy-design.md](./economy-design.md) | 查询合作社公账（`coop:<cid>`）余额及个人钱包 |
| `economy.account.transfer` | 同上 | 金库注资存款（玩家 $\rightarrow$ `coop:<cid>`）与提现（`coop:<cid>` $\rightarrow$ 玩家） |
| `activity.record` | [activity-log-design.md](./activity-log-design.md) | 统一上报合作社治理审计日志（创建/踢人/转让/解散等） |

**金库与审计治理机制：**
- **金库资产（托管至 `economy`）**：账户标识统一采用 `coop:<cid>` 作为合法机构公账；`coop` 模块仅负责业务门禁（入会检查、提现角色校验与额度限制），资金原子划转与防双花完全由 `economy.account.transfer` 承载；
- **审计追溯（托管至 `activity-log`）**：合作社内部重大变动（如解散、移交社长、成员踢出）统一调用 `activity.record`，以 `eventType: "coop.audit"` 异步写入全平台行为时序库。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**
- 创建合作社：本地事务中插入 `sfmc_coops` 与首任社长成员关系；调用 `activity.record` 上报建社事件；`coop:<cid>` 金库公账在首次转账时自动建分，初始余额为 0。

## 8. Acceptance criteria

- [ ] `create/join/leave/bank/rank` 主路径可用
- [ ] 存入与取出金库完全通过 `economy.account.transfer` 完成，无私有余额冗余表
- [ ] 治理与权限变更操作通过 `activity.record` 异步入库，无私有审计冗余表
- [ ] 非管理成员执行取款时正确被 `coop` 业务权限拦截
- [ ] 三个 provide 服务可被调用
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 合作社专属商店（`coopshop`：剥离独立实现，未来合并入全服主商店作为可选依赖挂接）
- 完整图形 CoopGUI；邀请系统打磨

## 10. Legacy reference（仅参考）

- `packages/coop/`
