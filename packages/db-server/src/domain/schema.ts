/**
 * domain/schema.ts — 数据库 Schema 初始化定义（平台核心底座表）
 *
 * 集中管理平台核心数据表的 CREATE TABLE IF NOT EXISTS 与 CREATE INDEX IF NOT EXISTS DDL 语句。
 * 调用方式：initSchema(db) —— 在 openDatabase 之后、业务查询启动前执行。
 *
 * 架构约定：
 * 业务模块（activity-log, coop, land, chat, economy 等）私有数据表均由各自模块在 SAPI 运行期通过
 * db.defineTable(...) 自主声明与维护，不在此处静态硬编码，避免列定义与索引冲突。
 *
 * 此处仅定义平台核心运行、跨服务共享（qq-bridge / HTTP 端点 / status 探活）的基础底座表：
 * 1. 世界与玩家运行期状态快照（sfmc_world, sfmc_players）
 * 2. 跨进程聊天消息聚合（sfmc_chat_messages）
 * 3. QQ 身份绑定与审批队列（sfmc_qq_*）
 */

import type { DatabaseSync } from "node:sqlite";

/**
 * 初始化数据库结构，创建平台核心底座表与索引。
 *
 * @param db SQLite 数据库连接实例。
 */
export function initSchema(db: DatabaseSync): void {
  // (1) 世界运行期状态（供 status 路由与 qq-bridge 读取，字段与 data-backup 兼容）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_world (
      id TEXT PRIMARY KEY,
      seed TEXT DEFAULT '',
      difficulty TEXT DEFAULT '',
      spawn_x INTEGER DEFAULT 0,
      spawn_y INTEGER DEFAULT 0,
      spawn_z INTEGER DEFAULT 0,
      gamerules TEXT DEFAULT '{}',
      day INTEGER DEFAULT 0,
      absolute_time INTEGER DEFAULT 0,
      moon_phase INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    )`);

  // (2) 玩家运行期状态（供 status 路由与 qq-bridge 读取，字段与 data-backup 兼容）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      xuid TEXT DEFAULT '',
      last_online INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      spawn_dimension TEXT DEFAULT '',
      spawn_x REAL,
      spawn_y REAL,
      spawn_z REAL,
      dimension TEXT DEFAULT '',
      x REAL,
      y REAL,
      z REAL,
      game_mode TEXT DEFAULT '',
      snapshot_hash TEXT DEFAULT '',
      active_channel TEXT DEFAULT '',
      subscribed_channels TEXT DEFAULT '[]',
      updated_at INTEGER DEFAULT 0
    )`);
  const playerColumns = new Map(
    (db.prepare(`PRAGMA table_info("sfmc_players")`).all() as Array<{ name: string }>).map((column) => [
      column.name,
      true,
    ])
  );
  const missingPlayerColumns: Array<[string, string]> = [
    ["spawn_dimension", "TEXT DEFAULT ''"],
    ["spawn_x", "REAL"],
    ["spawn_y", "REAL"],
    ["spawn_z", "REAL"],
    ["dimension", "TEXT DEFAULT ''"],
    ["x", "REAL"],
    ["y", "REAL"],
    ["z", "REAL"],
    ["game_mode", "TEXT DEFAULT ''"],
    ["snapshot_hash", "TEXT DEFAULT ''"],
    ["active_channel", "TEXT DEFAULT ''"],
    ["subscribed_channels", "TEXT DEFAULT '[]'"],
  ];
  for (const [name, definition] of missingPlayerColumns) {
    if (!playerColumns.has(name)) db.exec(`ALTER TABLE sfmc_players ADD COLUMN "${name}" ${definition}`);
  }
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_players_name ON sfmc_players(name)`);

  // (3) 聊天消息聚合（供 routes/messages 与 qq-bridge 双向同步）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      channel_id TEXT NOT NULL DEFAULT '',
      from_id TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL DEFAULT '',
      attachment TEXT DEFAULT NULL,
      show_timestamp INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_time ON sfmc_chat_messages(channel_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON sfmc_chat_messages(created_at ASC)`);

  // (4) QQ↔MC 身份绑定（平台表；qq-bridge / 游戏模块共用 HTTP，非模块私有表）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_qq_bind_pending (
      code TEXT PRIMARY KEY NOT NULL,
      qq_user_openid TEXT NOT NULL,
      qq_backend TEXT NOT NULL DEFAULT 'official',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_qq_bindings (
      qq_user_openid TEXT PRIMARY KEY NOT NULL,
      player_xuid TEXT NOT NULL UNIQUE,
      player_name TEXT NOT NULL DEFAULT '',
      qq_backend TEXT NOT NULL DEFAULT 'official',
      bound_at INTEGER NOT NULL
    )`);
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_qq_bind_pending_openid ON sfmc_qq_bind_pending(qq_user_openid);
    CREATE INDEX IF NOT EXISTS idx_qq_bindings_xuid ON sfmc_qq_bindings(player_xuid)`);

  // (5) QQ 入服审批 + 管理动作队列（平台表；BDS 生效由 SAPI + server-admin）
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_qq_join_requests (
      id TEXT PRIMARY KEY NOT NULL,
      applicant_openid TEXT NOT NULL,
      player_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      qq_backend TEXT NOT NULL DEFAULT 'official',
      created_at INTEGER NOT NULL,
      decided_at INTEGER,
      decided_by TEXT,
      applied_at INTEGER,
      apply_error TEXT
    )`);
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_qq_join_status ON sfmc_qq_join_requests(status, created_at)`);
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc_qq_admin_actions (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      target_name TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      requested_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      applied_at INTEGER,
      apply_error TEXT
    )`);
  db.exec(/* sql */ `
    CREATE INDEX IF NOT EXISTS idx_qq_admin_actions_status ON sfmc_qq_admin_actions(status, created_at)`);
}
