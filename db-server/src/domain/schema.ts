/**
 * domain/schema.ts — 数据库 schema 初始化(唯一真源)
 *
 * 所有 CREATE TABLE / CREATE INDEX 语句集中于此。
 * 调用方式:initSchema(db) — 在 openDatabase 之后、createQuery 之前执行。
 *
 * 事务描述:
 *   - 无业务 Tx(本文件只做 DDL,不涉及业务事务)
 *
 * 业务域(按文件内 db.exec 块编号):
 *   (1) 世界备份        (2) 玩家备份    (3) 计分板
 *   (4) 玩家行为日志    (5) 聊天频道    (6) 聊天消息
 *   (7) 红包            (8) 合作社主体/成员/邀请/账户
 *   (9) 合作社商店项/商店组 (10) 合作社账变流水/审计
 *   (11) 领地主体/成员/权限 (12) 领地邀请/审计/请求幂等
 *   (13) 玩家指令用量   (14) 价格指数
 *   (15) 每日任务/统计  (16) 经济账户/流水/幂等
 *
 *   完整表名以 `sfmc_` 前缀,具体见下方每个 db.exec 块。
 *
 * 备注: ALTER / DROP 不在此处;如需迁移请新建 tools/migrate-*.ts,
 *       保持本文件只做"全新初始化"。
 */

import type { DatabaseSync } from "node:sqlite";

export function initSchema(db: DatabaseSync): void {
  // (1 世界备份数据
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_world (
      allow_cheats INTEGER NOT NULL DEFAULT 0, -- 允许作弊的选项
      game_rules TEXT NOT NULL DEFAULT '', -- 世界规则(json)
      seed TEXT DEFAULT '', -- 种子
      default_spawn_location TEXT NOT NULL DEFAULT '', -- 默认出生点
      difficulty TEXT NOT NULL DEFAULT '', -- 难度
      day INTEGER NOT NULL DEFAULT 0, -- 游戏天数（世界）
      ticking_areas_count INTEGER DEFAULT 0, -- 常加载区域数量
      absolute_time INTEGER NOT NULL DEFAULT 0, -- 游戏内时间（当前）
      structures_from_addon TEXT DEFAULT '', -- 来自模组的结构（在对应行为包内）
      structures_from_world TEXT DEFAULT '', -- 来自世界的结构 包含保存在内存与磁盘中的
      dynamic_property_total_byte_count INTEGER DEFAULT 0, -- 动态数据（世界）字节数
      moon_phase INTEGER NOT NULL DEFAULT 0, -- 月相（当前）
      updated_at TEXT NOT NULL DEFAULT '' -- 更新时间戳
    )`);

  // (2 玩家备份数据
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_players (
      id TEXT NOT NULL, -- 实体id标识符
      name TEXT NOT NULL, -- 名称
      permission INTEGER DEFAULT 0, -- 权限等级（0=访客,1=成员,2=OP,3=管理员）TODO: 暂未适配自定义脚本权限
      client_system_info_local TEXT DEFAULT '', -- 客户端系统信息->本地化语言
      client_system_info_maxRenderDistance INTEGER DEFAULT 0, -- 客户端系统信息->最大渲染距离
      client_system_info_memoryTier_level TEXT DEFAULT '', -- 客户端信息->内存等级 详细请查看官方文档
      client_system_info_PlatformType TEXT DEFAULT '', -- 客户端系统信息->平台类型
      graphicsMode TEXT DEFAULT '', -- 图形模式
      dynamicPropertyTotalByteCount INTEGER DEFAULT 0, -- 动态属性总字节数
      ping INTEGER DEFAULT 0, -- 延迟（ms）
      spawnPoint TEXT DEFAULT '', -- 出生点坐标
      tags TEXT DEFAULT '', -- 玩家标签
      level INTEGER DEFAULT 0, -- 等级
      totalXp INTEGER DEFAULT 0, -- 总经验值
      afk_step INTEGER DEFAULT 0, -- AFK累计步数
      afk_last_location TEXT DEFAULT '', -- AFK最后位置
      onlinetime_session INTEGER DEFAULT 0, -- 在线时间->本次会话（秒）
      onlinetime_today INTEGER DEFAULT 0, -- 在线时间->今日（秒）
      onlinetime_month INTEGER DEFAULT 0, -- 在线时间->本月（秒）
      onlinetime_total INTEGER DEFAULT 0, -- 在线时间->累计（秒）
      onlinetime_last_date INTEGER DEFAULT 0, -- 在线时间->上次记录日期
      onlinetime_last_month INTEGER DEFAULT 0, -- 在线时间->上次记录月份
      active_channel TEXT NOT NULL DEFAULT '', -- 当前活跃聊天频道
      subscribed_channels TEXT DEFAULT '', -- 订阅的频道列表
      updated_at INTEGER NOT NULL, -- 玩家数据更新时间戳
      PRIMARY KEY (id, name) -- 联合主键：实体id+名称
    )`);
  // 玩家表索引：按id查、按name查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_players_id ON sfmc_players(id);
    CREATE INDEX IF NOT EXISTS idx_players_name ON sfmc_players(name)`);

  // (3 计分板数据
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_scoreboards (
      objective_id TEXT NOT NULL, -- 计分板目标id（主键）
      objective_display TEXT NOT NULL DEFAULT '', -- 计分板显示名称
      participants TEXT DEFAULT '', -- 参与者列表（json）
      updated_at INTEGER NOT NULL, -- 更新时间戳
      PRIMARY KEY (objective_id) -- 主键
    )`);

  // (4 玩家行为日志
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_activities (
      id TEXT PRIMARY KEY, -- 唯一id
      timestamp INTEGER NOT NULL, -- 事件发生时间戳
      dimension TEXT NOT NULL DEFAULT '', -- 维度（overworld/nether/end）
      source_type TEXT NOT NULL, -- 事件源类型（如player、entity、block等）
      source_id TEXT DEFAULT '', -- 事件源实体/方块id
      source_name TEXT NOT NULL DEFAULT '', -- 事件源名称
      source_x REAL, -- 事件源x坐标
      source_y REAL, -- 事件源y坐标
      source_z REAL, -- 事件源z坐标
      event_type TEXT NOT NULL, -- 事件类型（如chat、command、death、join等）
      target_type TEXT DEFAULT '', -- 目标类型
      target_id TEXT DEFAULT '', -- 目标实体id
      target_name TEXT NOT NULL DEFAULT '', -- 目标名称
      target_x REAL, -- 目标x坐标
      target_y REAL, -- 目标y坐标
      target_z REAL, -- 目标z坐标
      detail TEXT DEFAULT '{}', -- 事件详细信息（json）
      created_at INTEGER NOT NULL -- 记录创建时间戳
    )`);
  // 活动表索引：按源id查、按事件类型查、按目标id查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_sfmc_act_source ON sfmc_activities(source_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_sfmc_act_event ON sfmc_activities(event_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_sfmc_act_target ON sfmc_activities(target_id, timestamp)`);

  // (5 聊天频道配置
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_chat_channels (
      id TEXT NOT NULL, -- 频道唯一id
      name TEXT NOT NULL, -- 频道名称
      type TEXT NOT NULL, -- 频道类型
      prefix TEXT NOT NULL, -- 频道前缀符号
      owner_id TEXT DEFAULT '', -- 频道所有者玩家id
      created_at INTEGER NOT NULL, -- 频道创建时间戳
      config_allow_chat INTEGER NOT NULL DEFAULT 1, -- 配置->是否允许聊天
      config_slow_mode INTEGER NOT NULL DEFAULT 0, -- 配置->慢模式间隔（秒）
      config_is_broadcast INTEGER NOT NULL DEFAULT 0, -- 配置->是否为广播频道
      updated_at INTEGER NOT NULL, -- 频道配置更新时间戳
      PRIMARY KEY (id, name) -- 联合主键
    )`);
  // 频道表索引：按id查、按name+创建时间查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_channels_id ON sfmc_chat_channels(id);
    CREATE INDEX IF NOT EXISTS idx_channels_name ON sfmc_chat_channels(name, created_at ASC)`);

  // (6 聊天消息记录
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_chat_messages (
      id TEXT PRIMARY KEY, -- 消息唯一id
      channel_id TEXT NOT NULL, -- 所属频道id
      from_id TEXT NOT NULL, -- 发送者玩家id
      from_name TEXT NOT NULL, -- 发送者名称
      type TEXT NOT NULL DEFAULT 'text', -- 消息类型
      content TEXT NOT NULL, -- 消息内容
      attachment TEXT, -- 附件信息
      show_timestamp INTEGER NOT NULL DEFAULT 0, -- 是否在消息列表显示时间戳
      created_at INTEGER NOT NULL -- 消息发送时间戳
    )`);
  // 消息表索引：按频道+时间查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON sfmc_chat_messages(channel_id, created_at ASC)`);

  // (7 聊天红包记录
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_chat_redpackets (
      id TEXT PRIMARY KEY, -- 红包唯一id
      sender_id TEXT NOT NULL, -- 发红包玩家id
      sender_name TEXT NOT NULL, -- 发红包玩家名称
      total_amount REAL NOT NULL, -- 红包总金额
      remaining_amount REAL NOT NULL, -- 剩余金额
      total_count INTEGER NOT NULL, -- 红包总个数
      remaining_count INTEGER NOT NULL, -- 剩余个数
      receivers TEXT NOT NULL DEFAULT '[]', -- 已领取玩家列表（json）
      target_type TEXT NOT NULL, -- 红包目标类型（all/channel/player等）
      target_id TEXT NOT NULL, -- 红包目标id
      created_at INTEGER NOT NULL, -- 红包创建时间戳
      expires_at INTEGER NOT NULL -- 红包过期时间戳
    )`);
  // 红包表索引：按id查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_redpackets_id ON sfmc_chat_redpackets(id)`);

  // (8 合作社核心表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coops (
      cid TEXT PRIMARY KEY, -- 合作社唯一id
      name TEXT NOT NULL, -- 合作社名称
      owner_player_id TEXT NOT NULL, -- 社长玩家id
      owner_name_snapshot TEXT NOT NULL DEFAULT '', -- 社长名称快照
      status TEXT NOT NULL DEFAULT 'active', -- 状态（active/inactive/dissolved）
      notice TEXT DEFAULT '', -- 合作社公告
      created_at INTEGER NOT NULL, -- 创建时间戳
      updated_at INTEGER NOT NULL, -- 更新时间戳
      fee_bps INTEGER NOT NULL DEFAULT 500, -- 税率（基点，500=5%）
      version INTEGER NOT NULL DEFAULT 1 -- 乐观锁版本号
    )`);
  // 合作社成员表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_members (
      cid TEXT NOT NULL, -- 合作社id
      player_id TEXT NOT NULL, -- 成员玩家id
      player_name_snapshot TEXT NOT NULL DEFAULT '', -- 成员名称快照
      role TEXT NOT NULL DEFAULT 'member', -- 角色（member/admin/owner）
      joined_at INTEGER NOT NULL, -- 加入时间戳
      expires_at INTEGER, -- 成员资格过期时间戳（null=永不过期）
      status TEXT NOT NULL DEFAULT 'active', -- 状态（active/expired/kicked）
      version INTEGER NOT NULL DEFAULT 1, -- 乐观锁版本号
      PRIMARY KEY (cid, player_id), -- 联合主键
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 确保每个玩家只有一个active合作社成员记录
  db.exec(/* sql */ `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sfmc_one_active_coop_member ON sfmc_coop_members(player_id) WHERE status='active'`);
  // 合作社邀请表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_invites (
      id TEXT PRIMARY KEY, -- 邀请唯一id
      cid TEXT NOT NULL, -- 合作社id
      inviter_id TEXT NOT NULL, -- 邀请人玩家id
      invitee_id TEXT NOT NULL, -- 被邀请人玩家id
      invitee_name_snapshot TEXT NOT NULL DEFAULT '', -- 被邀请人名称快照
      role TEXT NOT NULL DEFAULT 'member', -- 邀请角色
      status TEXT NOT NULL DEFAULT 'pending', -- 状态（pending/accepted/rejected/expired）
      expires_at INTEGER NOT NULL, -- 邀请过期时间戳
      created_at INTEGER NOT NULL, -- 创建时间戳
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 邀请表索引：按被邀请人+状态+过期时间查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_sfmc_coop_invites_target ON sfmc_coop_invites(invitee_id,status,expires_at)`);
  // 合作社账户表（经济系统）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_accounts (
      cid TEXT PRIMARY KEY, -- 合作社id
      balance INTEGER NOT NULL DEFAULT 0, -- 账户余额
      version INTEGER NOT NULL DEFAULT 1, -- 乐观锁版本号
      updated_at INTEGER NOT NULL, -- 账户更新时间戳
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 合作社商店物品表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_items (
      id TEXT PRIMARY KEY, -- 物品唯一id
      cid TEXT NOT NULL, -- 所属合作社id
      name TEXT NOT NULL, -- 物品名称
      item_type TEXT NOT NULL, -- 物品类型标识符（如minecraft:diamond）
      item_aux INTEGER DEFAULT 0, -- 物品附加值/数据值
      item_nbt TEXT DEFAULT '', -- 物品NBT数据
      type INTEGER NOT NULL, -- 物品交易类型（0=收购,1=出售,2=交换）
      groups TEXT DEFAULT '[]', -- 所属商品分组
      des TEXT DEFAULT '', -- 物品描述
      num INTEGER DEFAULT 0, -- 当前库存数量
      sv INTEGER DEFAULT 0, -- 销售/收购限制
      money INTEGER DEFAULT 0, -- 单价
      is_true INTEGER DEFAULT 1, -- 是否上架（1=上架,0=下架）
      created_at INTEGER NOT NULL, -- 创建时间戳
      updated_at INTEGER NOT NULL, -- 更新时间戳
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 合作社银行流水表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_bank_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- 流水id（自增）
      cid TEXT NOT NULL, -- 合作社id
      actor_id TEXT NOT NULL, -- 操作人玩家id
      actor_name_snapshot TEXT NOT NULL DEFAULT '', -- 操作人名称快照
      type INTEGER NOT NULL, -- 流水类型（0=存入,1=取出,2=交易收入,3=交易支出）
      amount INTEGER NOT NULL, -- 变动金额
      note TEXT DEFAULT '', -- 备注
      transaction_id TEXT NOT NULL DEFAULT '', -- 关联事务id
      created_at INTEGER NOT NULL, -- 创建时间戳
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 合作社审计日志表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- 日志id（自增）
      cid TEXT NOT NULL, -- 合作社id
      actor_id TEXT NOT NULL, -- 操作者id
      target_id TEXT NOT NULL DEFAULT '', -- 被操作目标id
      action TEXT NOT NULL, -- 操作类型（如create/update/delete/transfer等）
      before_state TEXT NOT NULL DEFAULT '{}', -- 操作前状态（json）
      after_state TEXT NOT NULL DEFAULT '{}', -- 操作后状态（json）
      transaction_id TEXT NOT NULL DEFAULT '', -- 关联事务id
      created_at INTEGER NOT NULL, -- 日志创建时间戳
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE -- 级联删除
    )`);
  // 合作社商店分组表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_groups (
      groupid TEXT PRIMARY KEY, -- 分组唯一id
      displayname TEXT NOT NULL, -- 分组显示名称
      displaydescribe TEXT DEFAULT '', -- 分组描述
      icon TEXT DEFAULT '', -- 分组图标
      type_function TEXT DEFAULT '' -- 分组功能类型
    )`);

  // (9 领地（ LAND ）核心表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_lands (
      id TEXT PRIMARY KEY, -- 领地唯一id
      owner_player_id TEXT NOT NULL, -- 领地所有者玩家id
      owner_name_snapshot TEXT NOT NULL DEFAULT '', -- 所有者名称快照
      dimension INTEGER NOT NULL, -- 所在维度（0=主世界,1=下界,2=末地）
      min_x INTEGER NOT NULL, -- 领地范围最小x坐标
      min_y INTEGER NOT NULL, -- 领地范围最小y坐标
      min_z INTEGER NOT NULL, -- 领地范围最小z坐标
      max_x INTEGER NOT NULL, -- 领地范围最大x坐标
      max_y INTEGER NOT NULL, -- 领地范围最大y坐标
      max_z INTEGER NOT NULL, -- 领地范围最大z坐标
      name TEXT NOT NULL DEFAULT '', -- 领地名称
      status TEXT NOT NULL DEFAULT 'active', -- 领地状态（active/locked/expired/auction）
      created_at INTEGER NOT NULL, -- 领地创建时间戳
      updated_at INTEGER NOT NULL, -- 领地更新时间戳
      expires_at INTEGER, -- 领地过期时间戳（null=永不过期）
      protection_profile TEXT NOT NULL DEFAULT '{}', -- 保护配置（json）
      version INTEGER NOT NULL DEFAULT 1, -- 乐观锁版本号
      purchase_price INTEGER NOT NULL DEFAULT 0, -- 购买价格
      refund_rate REAL NOT NULL DEFAULT 0.7, -- 退款比例（0~1）
      tax_rate INTEGER NOT NULL DEFAULT 0, -- 税率（百分比）
      tax_due_at INTEGER, -- 下一个缴税时间戳
      tax_frozen INTEGER NOT NULL DEFAULT 0 -- 税务冻结状态（0=正常,1=冻结）
    )`);
  // 领地成员表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_land_members (
      land_id TEXT NOT NULL, -- 领地id
      player_id TEXT NOT NULL, -- 成员玩家id
      player_name_snapshot TEXT NOT NULL DEFAULT '', -- 成员名称快照
      role TEXT NOT NULL DEFAULT 'admin', -- 成员角色（member/trusted/admin/owner）
      created_at INTEGER NOT NULL, -- 加入时间戳
      expires_at INTEGER, -- 成员资格过期时间戳
      PRIMARY KEY (land_id, player_id), -- 联合主键
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE -- 级联删除
    )`);
  // 领地权限表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_land_permissions (
      land_id TEXT NOT NULL, -- 领地id
      permission_key TEXT NOT NULL, -- 权限键（如 buildbreak.interact 等）
      subject_type TEXT NOT NULL, -- 权限主体类型（player/group/role/all）
      subject_id TEXT NOT NULL, -- 权限主体id
      allowed INTEGER NOT NULL DEFAULT 0, -- 是否允许（1=允许,0=拒绝,-1=未设置）
      updated_at INTEGER NOT NULL, -- 权限更新时间戳
      PRIMARY KEY (land_id, permission_key, subject_type, subject_id), -- 联合主键
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE -- 级联删除
    )`);
  // 领地邀请表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_land_invites (
      id TEXT PRIMARY KEY, -- 邀请唯一id
      land_id TEXT NOT NULL, -- 领地id
      inviter_id TEXT NOT NULL, -- 邀请人id
      invitee_id TEXT NOT NULL, -- 被邀请人id
      role TEXT NOT NULL, -- 邀请角色
      expires_at INTEGER NOT NULL, -- 邀请过期时间戳
      status TEXT NOT NULL DEFAULT 'pending', -- 状态（pending/accepted/rejected/expired）
      created_at INTEGER NOT NULL, -- 创建时间戳
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE -- 级联删除
    )`);
  // 领地邀请表索引：按被邀请人+状态+过期时间查
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_sfmc_land_invites_target ON sfmc_land_invites(invitee_id, status, expires_at)`);
  // 领地操作审计日志表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_land_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- 日志id（自增）
      land_id TEXT NOT NULL, -- 领地id
      actor_id TEXT NOT NULL, -- 操作者id
      action TEXT NOT NULL, -- 操作类型（如 claim/release/transfer/updat 等）
      payload TEXT NOT NULL DEFAULT '{}', -- 操作载荷（json）
      created_at INTEGER NOT NULL, -- 日志创建时间戳
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE -- 级联删除
    )`);
  // 领地操作请求表（异步操作）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_land_operations (
      request_id TEXT PRIMARY KEY, -- 请求唯一id
      operation_type TEXT NOT NULL, -- 操作类型（如 claim/release/upgrade 等）
      actor_id TEXT NOT NULL, -- 操作发起人id
      land_id TEXT, -- 关联领地id（可选）
      status TEXT NOT NULL, -- 请求状态（pending/processing/completed/failed）
      response_json TEXT NOT NULL, -- 操作响应结果（json）
      created_at INTEGER NOT NULL -- 请求创建时间戳
    )`);

  // (10 玩家命令使用统计
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_player_command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录id（自增）
      player_id TEXT NOT NULL, -- 玩家id
      command TEXT NOT NULL, -- 命令名称（不含/前缀）
      date TEXT NOT NULL, -- 统计日期（YYYY-MM-DD格式）
      count INTEGER DEFAULT 0, -- 当日该命令使用次数
      UNIQUE(player_id, command, date) -- 唯一约束：同一玩家同一命令同一天
    )`);

  // (11 经济系统
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_price_index (
      item_type TEXT NOT NULL, -- 物品类型标识符
      item_aux INTEGER DEFAULT 0, -- 物品附加值/数据值
      base_buy_price INTEGER NOT NULL DEFAULT 0, -- 基础收购价格
      base_sell_price INTEGER NOT NULL DEFAULT 0, -- 基础出售价格
      current_buy_price INTEGER NOT NULL DEFAULT 0, -- 当前收购价格
      current_sell_price INTEGER NOT NULL DEFAULT 0, -- 当前出售价格
      elasticity REAL DEFAULT 0.3, -- 价格弹性系数
      weekly_acquisition_cap INTEGER, -- 周收购上限
      weekly_acquired INTEGER DEFAULT 0, -- 本周已收购数量
      week_start INTEGER, -- 本周开始时间戳
      rarity TEXT DEFAULT 'common', -- 稀有度（common/uncommon/rare/epic/legendary）
      is_renewable INTEGER DEFAULT 1, -- 是否可再生
      updated_at INTEGER, -- 索引更新时间戳
      PRIMARY KEY (item_type, item_aux) -- 联合主键
    )`);
  // 经济日常任务表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_daily_tasks (
      id TEXT PRIMARY KEY, -- 任务唯一id
      item_type TEXT NOT NULL, -- 目标物品类型
      item_aux INTEGER DEFAULT 0, -- 物品附加值
      target_qty INTEGER NOT NULL, -- 目标数量
      filled_qty INTEGER DEFAULT 0, -- 已完成数量
      unit_reward INTEGER NOT NULL, -- 单位奖励金额
      created_at INTEGER, -- 任务创建时间戳
      expires_at INTEGER, -- 任务过期时间戳
      status TEXT DEFAULT 'active' -- 任务状态（active/completed/expired）
    )`);
  // 经济系统全局统计表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_stats (
      id TEXT PRIMARY KEY, -- 统计项id（目前固定为'global'）
      total_issued INTEGER DEFAULT 0, -- 累计发行货币量
      total_destroyed INTEGER DEFAULT 0, -- 累计销毁货币量
      total_supply INTEGER DEFAULT 0, -- 当前总供应量
      active_accounts INTEGER DEFAULT 0, -- 活跃账户数
      computed_at INTEGER -- 统计计算时间戳
    )`);
  // 经济账户表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_accounts (
      player_id TEXT PRIMARY KEY, -- 玩家id（主键）
      player_name_snapshot TEXT NOT NULL DEFAULT '', -- 玩家名称快照
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0), -- 账户余额（>=0）
      version INTEGER NOT NULL DEFAULT 1, -- 乐观锁版本号
      created_at INTEGER NOT NULL, -- 账户创建时间戳
      updated_at INTEGER NOT NULL -- 账户更新时间戳
    )`);
  // 经济交易流水表
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_transactions (
      id TEXT PRIMARY KEY, -- 交易唯一id
      transaction_type TEXT NOT NULL, -- 交易类型（transfer/payment/reward/purchase等）
      actor_id TEXT NOT NULL, -- 交易发起人id
      source_player_id TEXT, -- 源玩家id（付款方）
      target_player_id TEXT, -- 目标玩家id（收款方）
      amount INTEGER NOT NULL CHECK(amount > 0), -- 交易金额（>0）
      balance_before INTEGER, -- 交易前余额
      balance_after INTEGER, -- 交易后余额
      reference_type TEXT NOT NULL DEFAULT '', -- 关联业务类型
      reference_id TEXT NOT NULL DEFAULT '', -- 关联业务id
      reason TEXT NOT NULL DEFAULT '', -- 交易原因/备注
      created_at INTEGER NOT NULL -- 交易时间戳
    )`);
  // 经济幂等表（防止重复交易）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_economy_idempotency (
      actor_id TEXT NOT NULL, -- 操作者id
      idempotency_key TEXT NOT NULL, -- 幂等键
      transaction_id TEXT NOT NULL, -- 已处理的交易id
      response_json TEXT NOT NULL, -- 处理结果（json）
      created_at INTEGER NOT NULL, -- 记录创建时间戳
      PRIMARY KEY (actor_id, idempotency_key) -- 联合主键
    )`);
  // 经济相关索引
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_economy_transactions_player ON sfmc_economy_transactions(source_player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_economy_transactions_target ON sfmc_economy_transactions(target_player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sfmc_lands_owner ON sfmc_lands(owner_player_id, status);
    CREATE INDEX IF NOT EXISTS idx_sfmc_lands_location ON sfmc_lands(dimension, min_x, max_x, min_z, max_z, status)`);
}

