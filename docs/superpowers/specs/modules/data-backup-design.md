# data-backup — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 定期将 Minecraft 世界全局参数（种子、难度、游戏规则、维度特征）、在线玩家核心元数据快照以及全服通用计分板（Scoreboards）快照持久化至平台底层引导表与快照表，提供高危计分板灾难恢复命令（`scoreboard restore`），为故障排查、容灾恢复与跨模块数据一致性提供基础事实底座。

**Non-goals:**
- 不承担 BDS 磁盘物理存档目录（LevelDB）的文件级归档备份（该能力明确归属于平台运维与 CLI 编排范畴）
- 不做实时逐分变更流式同步，统一采用周期代际快照策略
- **严禁覆盖/篡改由专管业务模块托管的权威计分板**（如 `economy` 的 `sfmc_money` 权威余额）

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `data-backup` |
| npm | `@sfmc-bds/module-data-backup` |
| manifest.id | `data-backup` |
| configKey | `data_backup` |
| enabledByDefault | true |
| canDisable | **false**（平台基础设施，强制保持激活） |
| manifest.requires | `[]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `scoreboard restore` | `scoreboard.restore` | OP (3) | 从数据库最新一致性快照重建缺失的 Objective 与分数（高危灾难恢复操作） |

## 4. Data

使用平台级公共表与快照表（在 manifest 中声明 `db:read|write` 权限）：

| 表名 | 语义 | 关键列 |
|------|------|--------|
| `sfmc_players` | 玩家基础信息、进服时间与元数据快照 upsert | id, name, xuid, last_online, ... |
| `sfmc_world` | 世界种子、生成属性、难度、游戏规则（gamerules JSON）及环境快照 | id, seed, difficulty, gamerules, ... |
| `sfmc_scoreboards` | 全服通用计分板代际快照（换代更新或带 snapshot_id，杜绝无界追加） | snapshot_id, objective, participant, score, updated_at |

每次计分板备份必须**可还原为单一一致快照**（先换代/清空旧代再批量插入，或 restore 时仅定位最新 `snapshot_id`），杜绝旧版读全历史冗余行的缺陷。

## 5. Config

`configs/data_backup.json`：

```json
{
  "world_interval_ticks": 600,
  "scoreboard": {
    "enabled": true,
    "interval_ticks": 6000,
    "ignore_objectives": [
      "sfmc_money"
    ]
  }
}
```

- `world_interval_ticks`：世界状态与玩家快照同步周期（默认 600 ticks / 30秒）；
- `scoreboard.interval_ticks`：计分板全量一致性快照周期（默认 6000 ticks / 5分钟）；
- `scoreboard.ignore_objectives`：**核心保护名单**。默认排除 `sfmc_money` 等由专管业务模块拥有权威性的 Objective；备份与 restore 时均跳过此类计分板，严禁覆盖经济权威余额并破坏流水对账一致性。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `backup.createSnapshot` | `{ scope?: "all" \| "world" \| "scoreboard" }` | `{ ok: boolean, snapshotId: string }` | 供运维或自动化脚本手动触发全量/局域一致性快照刷盘 |
| `backup.restoreScoreboard` | `{ objective?: string, snapshotId?: string }` | `{ ok: boolean, restoredCount: number }` | 程序化触发从快照恢复通用计分板（跳过 ignore_objectives） |
| `backup.getScoreboardSnapshot` | `{ objective?: string, participant?: string, snapshotId?: string }` | `{ snapshotId: string, scores: Array<{ objective: string, participant: string, score: number }> }` | **离线计分板快照检索**：供排行榜看板、外部后台等只读查询已归档的通用计分板数据 |
| `backup.getPlayerSnapshot` | `{ playerId: string }` | `{ player: Record<string, unknown> \| null }` | **离线玩家元数据检索**：查询 DB 中持久化的玩家最后已知信息与在线状态 |
| `backup.getWorldSnapshot` | `{}` | `{ world: Record<string, unknown> \| null }` | **世界环境快照检索**：读取 DB 中记录的世界种子、难度与游戏规则快照 |

**架构职责与实时性边界说明：**
- **实时权威业务（如钱包余额）**：由 `economy` 模块通过引擎原生计分板内存提供微秒级响应，防范网络延迟与双花漏洞；业务消费方必须调用 `economy.account.get`，严禁越级穿透读取 `data-backup` 离线代际快照；
- **离线历史与全服归档（如等级榜、离线玩家、世界环境参数）**：统一调用本模块 `backup.*` 只读服务，无需直接拼装 SQL 查库。

### requires

无。

## 7. Lifecycle notes

- `afterWorldLoad`: **true**（必须在世界与实体完全装载后方可读取原生属性与计分板）
- **同步机制与生命周期序列**：
  1. 模块 `init` 阶段执行一次世界元数据与计分板全量快照；
  2. 每 600 ticks 刷新在线玩家与世界 gamerules 状态；
  3. 监听 `playerSpawn`（首次进服），触发玩家元数据快照 upsert 写入；
  4. 每 6000 ticks 执行计分板换代备份（跳过 `ignore_objectives` 名单）；
  5. **`scoreboard restore` 灾难恢复流程**：
     - 查询 DB 最新一代 `sfmc_scoreboards` 快照；
     - 过滤掉 `ignore_objectives` 中的受保护计分板；
     - 重建游戏内缺失的 Objective；
     - 对参与者赋值（在线玩家通过实体句柄，离线/虚拟参与者通过原生字符串标识）；
  6. 停机 `cleanup` 阶段执行终态同步刷盘。

## 8. Acceptance criteria

- [ ] 模块默认激活且不可被管理员指令禁用（`canDisable: false` 契约对齐）
- [ ] 世界参数、玩家元数据与计分板快照周期持久化成功
- [ ] 计分板备份与 `scoreboard restore` 往返可用，数据完整重建
- [ ] 严格排除 `sfmc_money` 等业务权威 Objective，不篡改玩家资金与流水
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 差异增量备份、导出离线快照压缩包

## 10. Legacy reference（仅参考）

- `packages/data-backup/`（基础世界与玩家数据快照）
- `packages/scoreboard-sync/`（计分板同步与还原整合归并）
