# 第一部分：领地系统实现方案

> 实施状态：核心代码修复已完成，db-server 回归和 SAPI 构建已通过。Bedrock 实机保护、GUI 和模块重启验收需要在实际 BDS 环境执行。

## 实施完成记录

- [x] 删除土地返回 typed result，保留服务端错误码、消息、退款、余额版本和 transaction ID。
- [x] 删除土地使用软删除、事务、Owner 校验、版本校验和幂等 requestId，重复请求不会重复退款。
- [x] 转让土地使用事务、Owner 校验、目标校验、版本校验和幂等 requestId，保证单一 Owner。
- [x] 创建土地加入幂等 requestId，避免网络重试重复扣款。
- [x] GUI 删除和转让使用 `MenuNavigator.runTask()` 防止重复提交。
- [x] 无其他在线玩家时，转让操作使用对话框提示，不再只发送 Msg。
- [x] 删除成功后使用服务端最终余额和退款结果更新缓存，失败时保留本地土地状态。
- [x] 保护系统管理员绕过统一使用项目 `Permission` 等级，不再使用 `op`/`admin` 标签。
- [x] 增加并通过土地创建、转让、删除的幂等和版本冲突 API 回归测试。
- [x] 修复 `SFMC_ROOT` 下 db-server 相对数据库路径解析，确保隔离测试使用独立 SQLite 文件。
- [ ] Bedrock 实机手动验收：保护事件、实体/TNT/流体/自动化装置、GUI 关闭和模块 disable/re-enable。
根据根目录 plan.md，领地系统的基础修复已经完成，第一部分后续工作应聚焦于：
1. 修复删除土地无效果。
2. 修复无在线玩家时转让土地的交互。
3. 完成领地系统的验收补强。
4. 为后续幂等、版本冲突和特色功能预留稳定接口。
现有实现已经具备完整的基础结构：
- SAPI 领地模块：scriptsforminecraftserver/scripts/land/
- GUI：scriptsforminecraftserver/scripts/gui/LandGUI.ts
- SAPI API 封装：scriptsforminecraftserver/scripts/api/LandApi.ts
- db-server SQLite 领域接口：db-server/index.js
- GUI 导航和异步任务封装：scripts/libs/MenuNavigator.ts
- GUI 重构约束：docs/done/landgui-reactor.md
一、删除土地修复
1. 当前调用链
删除入口位于：
- LandGUI.buildRisk()
- LandGUI.deleteLand()
- LandCore.deleteLand()
- LandDatabase.delete()
- LandApi.deleteLand()
- db-server DELETE /api/sfmc/lands/:id
当前调用链的主要问题是错误信息被压缩成了布尔值：
const deleted = await LandCore.deleteLand(land.id, this.player);
if (deleted === false) {
  Msg.error("土地删除失败。", this.player);
  return;
}
LandApi.deleteLand() 只返回：
{ ok: boolean; refund?: number; balance?: number }
因此以下错误无法区分：
- 土地不存在。
- 操作者不是 Owner。
- 土地已经被删除。
- 数据库服务不可用。
- 退款交易冲突。
- 并发删除失败。
- 本地缓存中不存在土地。
2. 方案
将删除接口改为 typed result，至少包含：
type LandDeleteError =
  | "not_found"
  | "forbidden"
  | "already_deleted"
  | "database_unavailable"
  | "version_conflict"
  | "transaction_failed"
  | "invalid_request";

interface DeleteLandResult {
  ok: boolean;
  refund?: number;
  balance?: number;
  transactionId?: string;
  land?: LandData;
  error?: LandDeleteError;
  status?: number;
  message?: string;
}
建议由 LandApi.deleteLand() 保留服务端错误码和 HTTP 状态：
export async function deleteLand(id: string, actorId: string, version?: number): Promise<DeleteLandResult>
LandCore.deleteLand() 不再返回 number | false，改为返回完整结果：
static async deleteLand(
  landId: string,
  player: Player
): Promise<DeleteLandResult>
GUI 根据错误码显示用户可理解的信息：
- forbidden：你不是土地所有者。
- not_found：土地已经不存在或已被删除。
- version_conflict：土地数据已更新，请返回后重新打开。
- database_unavailable：数据库暂时不可用，请稍后重试。
- transaction_failed：退款失败，土地未删除。
- 其他错误：显示服务端 message，并保留通用兜底文本。
3. 服务端删除事务
db-server 的删除操作应满足以下事务顺序：
BEGIN IMMEDIATE
  1. 根据 id 查询 active 土地
  2. 校验 actorId == owner_player_id
  3. 校验 version，防止旧 GUI 覆盖新状态
  4. 计算退款金额
  5. 扣除/标记土地状态
  6. 写入经济流水
  7. 写入审计日志
  8. 提交事务
COMMIT
建议不要物理删除 sfmc_lands，继续使用：
status = 'deleted'
原因：
- 保留历史审计关联。
- 避免重复删除时无法判断土地曾经存在。
- 避免外键关联和审计日志失效。
- 便于后续管理员恢复或查询历史数据。
删除必须具备幂等行为：
- 第一次删除成功：返回退款和最终余额。
- 重复删除：不得再次退款，返回 already_deleted 或 not_found。
- 并发删除：只有一个请求可以成功退款，其他请求必须返回失败且不退款。
4. 本地缓存更新
服务端删除成功后：
1. 用服务端返回的最终余额更新 Money 缓存。
2. 从 Database._registry 删除土地。
3. 重建 Owner 索引。
4. 重建 chunk 索引。
5. 清除当前 GUI 的 selectedLandId。
6. 使用 nav.replace("home") 返回土地中心。
不能在服务端请求失败时清除本地缓存，否则会造成：
- GUI 显示土地消失，但服务端仍然存在。
- 玩家重新打开 GUI 后数据恢复。
- 玩家误以为退款已经完成。
二、无在线玩家时的转让交互
1. 当前问题
当前代码：
const target = world.getPlayers().find((p) => p.id !== this.player.id);
if (!target) {
  Msg.error("没有可转让的在线玩家。", this.player);
  return;
}
这会直接发送消息。根据 plan.md，此场景应弹出对话框，而不是只发送 Msg。
2. 交互目标
无在线玩家时，使用 MenuNavigator.message() 或专用 MessageBox 显示：
- 标题：无法转让土地
- 内容：当前没有其他在线玩家，土地转让只能选择在线玩家。
- 按钮：返回土地详情
这样玩家可以在当前 GUI 流程中得到明确反馈，不依赖聊天栏或系统消息。
3. 建议实现
在 LandGUI.transferLand() 中：
const target = world.getPlayers().find((p) => p.id !== this.player.id);

if (!target) {
  await this.nav.message(
    "无法转让土地",
    "当前没有其他在线玩家。\n土地转让目前只能选择在线玩家。"
  );
  return;
}
同时建议处理以下情况：
- 只有自己在线。
- 玩家在打开 GUI 后离线。
- 目标玩家在确认转让前离线。
- 目标玩家已经成为该土地成员。
- 目标玩家 ID 与名称快照不一致。
- 转让请求发生版本冲突。
转让确认后的服务端请求仍必须再次验证：
actorId == 当前 owner
targetId != actorId
土地 status == active
GUI 中的在线玩家列表只能用于交互，不能作为权限依据。
三、转让接口完善
当前转让服务端已经使用事务并处理了 Owner 切换，但还需要补强返回结果。
建议返回：
interface TransferLandResult {
  ok: boolean;
  land?: LandData;
  transactionId?: string;
  error?: "not_found" | "forbidden" | "invalid_target" | "version_conflict" | "transaction_failed";
  status?: number;
  message?: string;
}
服务端转让事务应保证：
BEGIN IMMEDIATE
  1. 查询 active 土地
  2. 校验 actorId 是当前 Owner
  3. 校验 targetId 存在且不等于 actorId
  4. 更新 sfmc_lands.owner_player_id
  5. 将旧 Owner 的 owner 角色改为 admin
  6. 将目标玩家写入或更新为 owner
  7. 更新 version
  8. 写入审计日志
COMMIT
需要明确处理目标玩家已有成员记录的情况，不能产生重复 Owner：
- sfmc_land_members 使用 (land_id, player_id) 主键。
- 目标玩家已有成员记录时使用更新。
- 旧 Owner 只能变为 admin。
- 目标玩家只能存在一个 owner 角色。
- 发生异常时整体回滚。
四、土地 API typed result 统一
plan.md 将“为土地 API 增加完整 typed error/result”列为验收项。这应作为删除和转让修复的一部分完成，而不是只修 GUI。
1. API 层统一结果模型
建议新增土地 API 通用错误类型：
export type LandErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_request"
  | "invalid_role"
  | "overlap"
  | "land_limit"
  | "insufficient_funds"
  | "database_unavailable"
  | "version_conflict"
  | "transaction_failed";
写操作结果统一包含：
export interface LandApiResult<T> {
  ok: boolean;
  data?: T;
  error?: LandErrorCode;
  message?: string;
  status?: number;
  transactionId?: string;
}
建议优先改造这些 API：
- createLand
- updateLand
- deleteLand
- inviteMember
- removeLandMember
- updateLandMember
- acceptInvite
- declineInvite
- revokeInvite
- transferLand

2. 错误处理原则
SAPI API 层负责：
- 解析 HTTP 状态码。
- 解析服务端错误码。
- 保留服务端 message。
- 区分网络错误与业务错误。
- 不直接向玩家发送消息。
GUI 层负责：
- 将错误码转换为玩家可理解的提示。
- 在异步请求失败后保留当前页面状态。
- 不使用本地预估金额作为最终结果。
- 只有收到服务端成功结果后才更新缓存和页面。
五、版本冲突处理
sfmc_lands 已有 version 字段，客户端模型也已有 version，但当前更新接口没有真正使用客户端版本进行冲突检测。
1. 写请求增加版本
土地更新、删除和转让请求应携带客户端读取到的版本：
interface LandMutationRequest {
  actorId: string;
  expectedVersion?: number;
}
例如：
{
  actorId: player.id,
  expectedVersion: land.version
}
2. 服务端校验
服务端执行写操作时：
UPDATE sfmc_lands
SET ...
WHERE id = ?
  AND status = 'active'
  AND version = ?
如果影响行数为 0，需要再次查询土地：
- 土地不存在：not_found
- 土地已删除：already_deleted
- 版本不同：version_conflict
- 其他情况：mutation_failed
不能简单返回通用 false，否则 GUI 无法判断是网络失败还是数据已过期。
3. 版本冲突后的 GUI 行为
发生 version_conflict 时：
1. 不修改本地旧土地。
2. 请求最新土地数据。
3. 更新 Database 缓存。
4. 弹出对话框：
土地数据已被其他操作更新。
已刷新最新数据，请重新确认本次操作。
5. 返回土地详情页面。
删除操作不建议自动重试，因为自动重试可能让玩家在没有再次确认的情况下执行危险操作。
六、幂等键设计
plan.md 要求土地写操作增加幂等键。重点应放在具有经济影响或不可逆效果的操作：
- 创建土地。
- 删除土地。
- 转让土地。
1. 请求格式
interface LandMutationRequest {
  actorId: string;
  requestId: string;
  expectedVersion?: number;
}
requestId 应由 SAPI 在一次用户操作开始时生成，并在网络重试时复用。
例如：
const requestId = `land-delete:${player.id}:${land.id}:${Date.now()}`;
更稳妥的方式是使用随机 UUID，避免时间戳碰撞。
2. 服务端幂等记录
新增幂等表：
CREATE TABLE IF NOT EXISTS sfmc_land_operations (
  request_id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  land_id TEXT,
  status TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
事务流程：
BEGIN IMMEDIATE
  1. 查询 request_id
  2. 如果已完成，直接返回历史 response_json
  3. 如果不存在，插入处理中记录
  4. 执行业务事务
  5. 将最终响应写入幂等记录
COMMIT
同一个 requestId 重试时必须返回第一次操作的结果，不能再次退款或再次转让。
3. 幂等键生命周期
建议保留至少 7 天，之后由定时清理任务删除历史记录。
对于土地删除，最好长期保留操作记录，或至少保留与经济流水相同的生命周期，便于审计和纠纷处理。
七、保护系统验收方案
plan.md 要求手动验证启动保护、实体、自动化装置和模块重启行为。建议分为以下测试组。
1. 启动期间 fail-closed
验证步骤：
1. 启动 BDS，但让 db-server 暂时不可用。
2. 玩家尝试放置和破坏方块。
3. 玩家尝试打开容器、使用门、按钮和红石设备。
4. 确认土地缓存尚未取得权威快照时，土地保护不会默认放行。
5. db-server 恢复后，等待土地快照加载。
6. 确认正常土地权限恢复。
预期：
- Database.hasAuthoritativeSnapshot() 为 false 时，普通玩家在土地相关操作上默认拒绝。
- OP/Admin 绕过逻辑必须继续由项目 Permission 等级控制。
需要重点注意：LandPolicy.canUseAt() 目前仍保留：
if (player.hasTag("op") || player.hasTag("admin")) return true;
而 plan.md 已要求使用项目 Permission 等级替代通用标签。实施时应删除这两个标签绕过，只保留：
Permission.getPermission(player) >= Permission.OP
保护逻辑应保持一致，不能一部分使用 Permission，另一部分使用玩家标签。
2. 方块与容器
分别验证：
- 土地外普通玩家可以放置和破坏。
- 土地内访客默认不能放置和破坏。
- Builder 可以放置和破坏。
- Container 角色可以打开容器，但不能修改方块。
- 箱子、陷阱箱、木桶、潜影盒、漏斗、发射器和投掷器权限正确。
- 土地保护设置修改后立即生效。
- 保护设置修改失败时旧设置保持不变。
3. 实体与物品
分别验证：
- entity 角色可以按设置交互实体。
- entity 角色可以按设置攻击实体。
- 普通访客不能攻击受保护土地内实体。
- 普通访客不能拾取受保护土地内掉落物。
- 掉落物位于土地边界时，使用掉落物实际位置判断。
- 实体移动后，保护判断使用实体当前维度和坐标。
4. 爆炸、TNT、火焰和流体
当前 LandEvents 已处理 beforeEvents.explosion，但还需要手动确认：
- TNT 爆炸。
- 苦力怕爆炸。
- 床/重生锚爆炸。
- 火焰蔓延。
- 水和岩浆流动。
- 活塞推动。
- 发射器、投掷器、漏斗等自动化装置。
- 跨土地边界的爆炸或流体行为。
如果某类事件无法在当前 SAPI 版本中可靠取消，应采用额外策略：
- 在事件前取消整个危险行为。
- 或在事件后扫描并恢复受保护区域。
- 不能因为事件 API 缺失就默认放行。
5. 进入和离开土地
验证：
- 玩家进入土地时只提示一次。
- 玩家离开土地时只提示一次。
- 维度切换后状态正确。
- 玩家退出后重新进入不会保留错误的上一次土地状态。
- 模块 disable/re-enable 后不会重复提示或重复拦截。
八、模块生命周期验收
当前入口使用：
registerEvents: () => LandEvents.registerEvents(),
cleanup: () => {
  LandEvents.cleanup();
  LandSystem.cleanup();
}
LandEvents 已使用：
- initialized 防止重复注册。
- subscriptions 记录订阅。
- cleanup() 取消所有事件。
- scanRunId 清理边界扫描任务。
验收时需要确认：
1. disable 领地模块。
2. 在原土地内尝试操作。
3. 确认事件监听已经移除。
4. re-enable 领地模块。
5. 确认只存在一组监听。
6. 确认边界扫描任务只有一个。
7. 重复执行 enable/disable 不会产生重复保护消息。
如果模块系统支持再次启动同一模块，应确保 LandSystem.init() 的刷新定时器和 LandEvents.registerEvents() 的事件订阅都能够成对清理和重新建立。
九、GUI 具体改造点
1. 删除入口
修改：
- scriptsforminecraftserver/scripts/gui/LandGUI.ts
- scriptsforminecraftserver/scripts/land/LandCore.ts
- scriptsforminecraftserver/scripts/land/LandDatabase.ts
- scriptsforminecraftserver/scripts/api/LandApi.ts
删除流程改为：
点击删除
→ MessageBox 二次确认
→ 生成 requestId
→ 携带 actorId、expectedVersion 请求服务端
→ 服务端事务删除并退款
→ 返回最终退款、余额、transactionId
→ 更新 Money 缓存
→ 删除本地土地缓存
→ 返回土地中心
→ 显示实际退款金额
2. 无在线玩家提示
修改 LandGUI.transferLand()：
点击转让
→ 查询其他在线玩家
→ 没有目标玩家
   → 打开 MessageBox
   → 显示当前没有可转让玩家
   → 返回当前土地页面
→ 有目标玩家
   → 选择目标
   → 二次确认
   → 请求服务端
当前只有一个目标玩家时可以继续使用现有流程。后续若需要支持多个在线玩家，再将目标选择改成下拉列表。
3. 异步操作状态
所有删除和转让请求都应通过 MenuNavigator.runTask() 或等价的状态控制：
- 防止快速重复点击。
- 显示“正在处理”。
- 请求成功后刷新缓存。
- 请求失败后保留当前页面。
- 不在请求失败时误清空 selectedLandId。
当前转让没有使用 runTask()，建议一并改造，避免玩家快速重复触发转让请求。
十、建议的实施顺序
阶段 1：删除问题定位与修复
1. 为 LandApi.deleteLand() 增加完整错误结果。
2. 为 LandCore.deleteLand() 改用 typed result。
3. 修改 LandGUI.deleteLand() 显示服务端错误。
4. 检查 db-server 删除事务、退款和状态更新。
5. 增加 expectedVersion。
6. 增加删除幂等键。
7. 验证并发删除不会重复退款。
阶段 2：转让空玩家交互
1. 修改 LandGUI.transferLand()。
2. 无目标玩家时使用 MessageBox。
3. 转让请求改为 runTask()。
4. 增加转让错误码和版本冲突处理。
5. 验证目标玩家在确认前离线时不会产生错误状态。
阶段 3：统一土地 API 结果
1. 定义 LandErrorCode。
2. 定义 LandApiResult<T>。
3. 改造删除和转让 API。
4. 再逐步改造成员、邀请、创建和更新 API。
5. 统一 GUI 错误显示和网络异常处理。
阶段 4：保护和生命周期验收
1. 修复 LandPolicy 中基于标签的绕过。
2. 验证启动 fail-closed。
3. 验证实体、拾取、爆炸和自动化装置。
4. 验证模块 disable/re-enable。
5. 记录无法直接拦截的 SAPI 事件并确定补偿策略。
阶段 5：自动化回归测试
优先增加以下测试：
- 并发删除只有一次退款。
- 重复 requestId 不重复退款。
- 删除后再次删除不产生退款。
- 非 Owner 删除被拒绝。
- 旧 version 删除被拒绝。
- 并发转让只产生一个 Owner。
- 转让后旧 Owner 为 Admin。
- 无在线玩家时 GUI 显示对话框。
- 删除网络失败时本地缓存不被清空。
- 删除成功后 Money 缓存使用服务端最终余额。
- 过期成员不能继续使用土地权限。
- 模块重启不重复注册监听。
十一、验收标准
删除土地
- 点击删除后一定出现二次确认。
- 确认后请求能够到达 DELETE /api/sfmc/lands/:id。
- 删除成功后土地从数据库和本地缓存消失。
- 删除失败时显示真实业务错误。
- 退款只发生一次。
- 使用服务端返回的实际退款金额。
- Money 缓存与服务端余额一致。
- 并发删除不会重复退款。
- 旧页面不能删除已经更新过的土地。
转让土地
- 没有其他在线玩家时显示对话框。
- 不再只通过 Msg.error() 提示。
- 有在线玩家时可以正常确认转让。
- 转让后目标玩家成为 Owner。
- 原 Owner 成为 Admin。
- 不会出现多个 Owner。
- 目标玩家在确认前离线时操作失败且土地状态不变。
保护系统
- 启动期间普通玩家保护 fail-closed。
- 权限由 Permission 等级决定，不依赖 op/admin 标签。
- 方块、容器、实体、物品和自动化装置行为符合配置。
- 模块重启不会重复监听。
- 数据库不可用时不会用不完整缓存放行危险操作。
API
- 写接口返回结构化错误。
- 所有经济相关写操作支持幂等键。
- 版本冲突可识别。
- GUI 不依赖本地预估结果完成删除、转让或购买。
- 服务端事务失败时不会出现土地、余额、成员状态不一致。
十二、当前结论
第一部分不需要重新设计完整领地系统，现有架构已经足够支撑实现。应优先完成以下最小闭环：
删除土地 typed result
→ 删除事务幂等与版本校验
→ 删除 GUI 正确反馈
→ 无在线玩家转让对话框
→ 转让 typed result 与 runTask
→ Permission 绕过统一
→ 领地保护和并发回归测试
本阶段完成后，再进入 plan.md 中“更多独具特色功能”的扩展设计。扩展功能不应先于删除、转让、错误处理、事务和保护验收完成。
