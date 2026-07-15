审计范围
本次为只读静态审计，覆盖 scriptsforminecraftserver/scripts/ 的 50 余个 TypeScript 文件、模块 catalog、启动流程、配置/HTTP、持久化、事件订阅、定时任务、命令/权限及核心业务模块。未修改文件、未启动服务、未执行构建。
整体判断：项目已经具备较完整的模块化骨架、配置热重载、HTTP 数据层和主要游戏功能，但运行时生命周期、数据一致性和长期存储仍有几处会直接影响稳定性的缺口。当前更接近“功能丰富的持续迭代版本”，而非可安全长期无人值守运行的版本。
---

高优先级问题
---

~~1. ### **热启用** afterWorldLoad 模块时不会执行初始化~~

- ModuleRegistry.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/libs/ModuleRegistry.ts:127) 的 bootModule() 仅在 !afterWorldLoad 时调用 init()。
- 配置热重载后的 reconcile() 通过 bootModule() 启用模块，因此在线启用 onlineTime、creative、land、chat、activityLog、scoreboardSync 等模块时，命令和事件可能注册，但**核心初始化不会运行。**
- 例如 onlineTime 不会启动计时器，chat 不会初始化默认频道或 QQ 桥接，scoreboardSync 不会执行备份。
- **建议：ModuleRegistry 维护 worldLoaded 状态；已加载世界后启用任意模块，都完整运行其生命周期。**

~~2. ### 在线时长模块每秒为每名玩家写一次数据库~~

- OnlineTime.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/doge/OnlineTime.ts:161) 每秒遍历玩家并调用 persist()。
- 10 人在线即每分钟 600 次 PATCH，每小时 36,000 次；网络抖动时请求会重叠，无队列、批处理、退避或版本控制。
- 这会让 SAPI HTTP、Node 服务和 SQLite WAL 承担不必要压力，也会使线上时长统计容易出现乱序覆盖。
- **建议：内存累计，按 30 至 60 秒批量保存，并在离开、shutdown 时强制 flush；后端增加批量 endpoint 或原子累加语义。**

3. ### 合作社资金和经济操作不具备事务性

- CoopCore.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/coop/CoopCore.ts:219) 先读取合作社余额，再改玩家计分板，随后更新数据库。
- registerCoop() 在数据库创建成功前就扣除 1000 货币，CoopCore.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/coop/CoopCore.ts:148)。
- 并发购买、出售、存款、取款会发生 read-modify-write 竞争，可能丢失资金更新；请求失败也会留下“玩家已扣款、合作社未入账”或“玩家已收款、合作社未扣款”的不一致。
- 建议：将合作社银行和商品交易移动到 db-server 的单个事务 endpoint，由 SQLite 原子校验余额、更新库存、写流水；SAPI 仅在事务成功后发放/扣除游戏内物品和货币，并定义补偿策略。

4. ~~土地~~与~~旧合作社 Database 类并不持久化

- LandDatabase.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/land/LandDatabase.ts:89) 和 coop/Database.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/coop/Database.ts:62) 都使用进程内 Map。
- ~~LandCore 仍直接使用该 LandDatabase，意味着领地数据在脚本/BDS 重启后会丢失。~~
- 合作社生产逻辑目前主要使用 API，但同目录保留的旧内存 Database 容易被误用，造成两套数据源。
- 建议：阶段 D 首先~~迁移领地到 db-server；~~删除或明确隔离废弃的 coop/Database.ts，避免未来回归到内存存储。

~~5. ActivityLog 禁用后仍保留后台计时器~~

- ActivityLog.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/data/ActivityLog.ts:617) 创建 flush interval 和 cleanup interval，但未保存 run ID。
- cleanup() (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/data/ActivityLog.ts:603) 只取消事件订阅，不清理计时器，也未重置 initialized。
- 模块被禁用后仍持续请求 db-server；后续重新启用时也无法以干净状态重建。
- 建议：存储所有 interval/timeout ID，cleanup 时取消；决定队列策略，例如 shutdown 时尽力 flush、禁用时丢弃或保留待发送队列。

~~6. OnlineTime 的订阅没有清理，且离开落库路径不可靠~~

- OnlineTime.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/doge/OnlineTime.ts:60) 注册 playerSpawn，但 stop() 仅停止计时器，没有退订。
- 热禁用/启用会重复订阅。
- entry.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/entry.ts:309) 在 playerLeave 后尝试通过 world.getEntity(event.playerId) 获取玩家。离开事件触发时实体可能已不可用，导致玩家快照与 OnlineTime.onPlayerLeave() 不执行。
- 建议：OnlineTime 自己维护 { playerId, name } 和可持久化的会话状态，按 player ID 写 API；不要依赖离开后的 Player 实体。

## 中优先级问题

~~1. 配置快速轮询可重入~~

- ConfigManager.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/libs/ConfigManager.ts:73) 每 40 tick 调用 \_fastPoll()。
- HTTP 超过两秒时，新的轮询会在上一次未完成时叠加；reloadAll() 又会并行发起 10 个请求。
- 建议：增加 pollInFlight / reloadInFlight 锁；将多个热重载信号合并为一次 reload。

2. HTTP 客户端硬编码地址，与实际配置模型不一致

- HttpDB.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/libs/HttpDB.ts:13) 固定 127.0.0.1:3001。
- 这与项目中可配置 db host/port 的设计不一致，也使非默认端口、远程后端或多实例部署失效。
- 建议：从 bootstrap 配置读取 host/port，或明确 db-server 必须固定同机同端口，并删除无效配置项。

~~3. manifest 与实际依赖版本漂移~~

- manifest.json (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/behavior\_packs/ScriptsForMinecraftServer/manifest.json:26) 仍声明 @minecraft/server 2.9.0-beta 与 UI 2.1.0。
- package.json (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/package.json:31) 实际编译依赖是 Server/UI 2.10.0-beta...preview.30 / 2.2.0-beta...preview.30。
- 这会造成“本地能编译、目标 BDS 加载失败或 API 行为不同”的风险。
- 建议：将 manifest 依赖版本作为发布校验项，和 package lock/build SDK 一致。

~~4. QA 模块在无题目或停用时可能继续运行~~

- QA.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/doge/QA.ts:65) 无题目时仍会计算随机范围并访问 this.nowQuestion!。
- nextQuestion() 设置的“答题结束 timeout”没有保存到实例，QA.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/doge/QA.ts:94)；stop() 无法取消它，模块禁用后仍可能结束答题并重新安排下一题。
- 建议：为全部 timeout 建立集合；无有效题目时延迟重试并记录一次诊断日志。
  ~~5. 计分板同步只备份，恢复函数未接入启动流程~~
- entry.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/entry.ts:193) 初始化 ScoreboardSync.init()。
- Scoreboards.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/data/Scoreboards.ts:32) 的 init() 只将当前世界写回数据库；load() 没有被启动流程调用。
- 如果目标是“备份与恢复”，现在更像“启动时覆盖远端快照”。
- 建议：明确权威源和恢复策略。推荐默认只做周期备份，恢复改为管理员显式动作，避免意外覆盖现有世界计分板。
  ~~6. 权限未注册时默认放行~~
- Permission.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/libs/Permission.ts:38) 对未知权限名返回 true。
- 拼写错误或遗漏注册会直接变成未授权访问，而不是安全失败。
- 已存在 holorint 命名拼写，entry.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/entry.ts:257)、HoloGUI.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/holo/HoloGUI.ts:21)，当前两侧一致但可读性差。
- 建议：未知权限默认拒绝并记录告警；启动时校验所有 Command.register() 使用的权限都已注册。
  ~~7. 模块元数据和实际实现存在漂移~~
- feature-inventory-switcher 声明依赖 core-httpdb，catalog.json (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/modules/catalog.json:240)，实际仍使用 world DynamicProperty。
- feature-land 标注依赖 HTTP，但土地数据仍是内存 Map。
- feature-coop 的旧 Database 与新 API 并存。
- 建议：为 catalog 增加“storage/remote dependency”校验或审计字段，避免模块面板描述和运行行为不一致。
  性能与维护性风险
- 行为日志订阅约 20 类事件，包含实体生成、受伤、命中、物品掉落/拾取等高频事件；队列没有长度、内存字节数或降级上限。ActivityLog.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/data/ActivityLog.ts:51)
- MonitorReporter 每 30 秒对三个维度完整 getEntities() 计数；实体数很高时是 O(n) 扫描。MonitorReporter.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/doge/MonitorReporter.ts:34)
- 合作社商店获取商品时先取所有合作社，再逐社顺序请求商品，属于 N+1 HTTP 查询。CoopCore.ts (/D:/#WorkPlace/#MCBEProjects/ScriptsForMinecraftServer/scriptsforminecraftserver/scripts/coop/CoopCore.ts:266)
- Clean、Fly、AFK、CreativeArea 都会扫描玩家/实体；单独看可接受，但需要在线上按人数、实体数和 tick 耗时一起测量。
- any、直接 runCommand、静默 catch {} 在核心模块中较多，导致 API 版本升级或配置错误时可观察性不足。
- 全息、聊天、AFK 等仍直接调用 sendMessage()；聊天消息可例外，但系统通知应统一走 Msg，才能保留声音、系统转发和统一格式。
