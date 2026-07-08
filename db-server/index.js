/**
 * DogeChat 数据库服务 — HTTP REST API
 * SQLite (better-sqlite3) + Node.js http
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = parseInt(process.env.DB_PORT || '3001', 10);
const DB_PATH = path.join(__dirname, 'sfmc_data.db');

let db;

// ---------- 数据库初始化 ----------

async function initDB() {
  db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL'); // 并发补丁
  db.pragma('busy_timeout = 5000');

  // 迁移：旧版 sfmc_chat_messages 有 FK 约束引用 channels(id)，
  // 但 channels 的 PK 是 (id, name)，导致 FK 不合法。移除约束。
  const fkList = db.pragma('foreign_key_list(sfmc_chat_messages)');
  if (fkList.length > 0) {
    db.exec('DROP TABLE IF EXISTS sfmc_chat_messages');
    console.log('[DogeDB] 已迁移 sfmc_chat_messages（移除无效 FK）');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sfmc_world (
      allow_cheats INTEGER NOT NULL DEFAULT 0,
      game_rules TEXT NOT NULL DEFAULT '',
      seed TEXT DEFAULT '',
      default_spawn_location TEXT NOT NULL DEFAULT '',
      difficulty TEXT NOT NULL DEFAULT '',
      day INTEGER NOT NULL DEFAULT 0,
      ticking_areas_count INTEGER DEFAULT 0,
      absolute_time INTEGER NOT NULL DEFAULT 0,
      structures_from_addon TEXT DEFAULT '',
      structures_from_world TEXT DEFAULT '',
      dynamic_property_total_byte_count INTEGER DEFAULT 0,
      moon_phase INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sfmc_chat_channels (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      prefix TEXT NOT NULL,
      owner_id TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      config_allow_chat INTEGER NOT NULL DEFAULT 1,
      config_slow_mode INTEGER NOT NULL DEFAULT 0,
      config_is_broadcast INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (id, name)
    );
    
    CREATE INDEX IF NOT EXISTS idx_channels_id ON sfmc_chat_channels(id);
    CREATE INDEX IF NOT EXISTS idx_channels_name ON sfmc_chat_channels(name, created_at ASC);

    CREATE TABLE IF NOT EXISTS sfmc_players (
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        permission INTEGER DEFAULT 0,
        client_system_info_local TEXT DEFAULT '',
        client_system_info_maxRenderDistance INTEGER DEFAULT 0,
        client_system_info_memoryTier_level TEXT DEFAULT '',
        client_system_info_PlatformType TEXT DEFAULT '',
        graphicsMode TEXT DEFAULT '',
        dynamicPropertyTotalByteCount INTEGER DEFAULT 0,
        ping INTEGER DEFAULT 0,

        spawnPoint TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        level INTEGER DEFAULT 0,
        totalXp INTEGER DEFAULT 0,

        afk_step INTEGER DEFAULT 0,
        afk_last_location TEXT DEFAULT '',
        onlinetime_session INTEGER DEFAULT 0,
        onlinetime_today INTEGER DEFAULT 0,
        onlinetime_month INTEGER DEFAULT 0,
        onlinetime_total INTEGER DEFAULT 0,
        onlinetime_last_date INTEGER DEFAULT 0,
        onlinetime_last_month INTEGER DEFAULT 0,
        active_channel TEXT NOT NULL DEFAULT '',
        
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_players_id ON sfmc_players(id);
      CREATE INDEX IF NOT EXISTS idx_players_name ON sfmc_players(name);

    CREATE TABLE IF NOT EXISTS sfmc_chat_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      from_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      attachment TEXT,
      show_timestamp INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON sfmc_chat_messages(channel_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS sfmc_chat_redpacket (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        total_count INTEGER NOT NULL,
        remaining_count INTEGER NOT NULL,
        receivers TEXT NOT NULL DEFAULT '[]',
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_redpackets_id ON sfmc_chat_redpackets(id);

      CREATE TABLE IF NOT EXISTS sfmc_scoreboards (
        objective_id      TEXT NOT NULL,
        objective_display TEXT NOT NULL DEFAULT '',
        participants  TEXT DEFAULT '',
        updated_at        INTEGER NOT NULL,
        PRIMARY KEY (objective_id)
      );

      CREATE TABLE IF NOT EXISTS sfmc_activities (
        id              TEXT PRIMARY KEY,
        timestamp       INTEGER NOT NULL,
        dimension       TEXT NOT NULL DEFAULT '',
        source_type     TEXT NOT NULL,
        source_id     TEXT DEFAULT '',
        source_name     TEXT NOT NULL DEFAULT '',
        source_x        REAL,
        source_y        REAL,
        source_z        REAL,
        event_type      TEXT NOT NULL,
        target_type     TEXT DEFAULT '',
        target_id     TEXT DEFAULT '',
        target_name     TEXT DEFAULT '',
        target_x        REAL,
        target_y        REAL,
        target_z        REAL,
        detail          TEXT DEFAULT '{}',
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_source ON sfmc_activities(source_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_event ON sfmc_activities(event_type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_target ON sfmc_activities(target_id, timestamp);

      CREATE TABLE IF NOT EXISTS sfmc_coop_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
  `);
  console.log('[DogeDB] 数据库已就绪');
}

// ---- Holoprint ----
const { registerHoloprintRoutes, getHoloprintDDL } = require('./holoprint/router');

// ---------- 工具 ----------

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (chunk) => { b += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(b)); }
      catch { resolve({}); }
    });
  });
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  // 判断是否为查询操作（SELECT / WITH）
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    // .all() 直接返回所有行数组
    return stmt.all(params);
  } else {
    const info = stmt.run(params);
    return { changes: info.changes };
  }
}

// ---------- 路由（按资源路径分组） ----------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method;
  const params = url.searchParams;

  try {
    // ────── /api/health ──────
    if (path === '/api/health') {
      if (method === 'GET') { json(res, { status: 'ok', uptime: process.uptime() }); }
      else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/world ──────
    if (path === '/api/sfmc/world') {
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_world');
        json(res, { world: rows.length > 0 ? rows[0] : null });
      } else if (method === 'POST') {
        const data = (await body(req)).data;
        if (!data) { json(res, { success: false, error: 'invalid' }, 400); return; }
        query(`INSERT OR REPLACE INTO sfmc_world (
            allow_cheats, game_rules, seed, default_spawn_location, difficulty,
            day, ticking_areas_count, absolute_time, structures_from_addon,
            structures_from_world, dynamic_property_total_byte_count, moon_phase, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          data.allowCheats ? 1 : 0, data.gameRules, data.seed || '',
          JSON.stringify(data.defaultSpawnLocation), data.difficulty, data.day,
          data.tickingAreasCount ?? 0, data.absoluteTime,
          data.structuresFromAddon || '', data.structuresFromWorld || '',
          data.dynamicPropertyTotalByteCount ?? 0, data.moonPhase, data.updatedAt
        ]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/channels ──────
    if (path === '/api/sfmc/channels') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_chat_channels WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (name LIKE ? OR id LIKE ?)', transform: v => `%${v}%`, repeat: 2 },
          { key: 'type', sql: ' AND type = ?', transform: v => v, repeat: 1 },
          { key: 'ownerId', sql: ' AND owner_id = ?', transform: v => v, repeat: 1 },
          { key: 'minCreatedAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
          { key: 'maxCreatedAt', sql: ' AND created_at <= ?', transform: v => Number(v), repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY created_at ASC';
        json(res, { channels: query(sql, values) });
      } else if (method === 'POST') {
        const { channels } = await body(req);
        if (!Array.isArray(channels) || channels.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (channels.length > 90) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_channels (
            id, name, type, prefix, owner_id, created_at,
            config_allow_chat, config_slow_mode, config_is_broadcast, updated_at
          ) VALUES ${channels.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          channels.flatMap(ch => [
            String(ch.id ?? ''),
            String(ch.name ?? ''),
            String(ch.type ?? ''),
            String(ch.prefix ?? ''),
            String(ch.ownerId || ch.ownerid || ''),
            Number(ch.createdAt) || Date.now(),
            Number(ch.configAllowChat ?? (ch.config?.allowChat ? 1 : 0)) || 0,
            Number(ch.configSlowMode ?? (ch.config?.slowMode || 0)) || 0,
            Number(ch.configIsBroadcast ?? (ch.config?.isBroadcast ? 1 : 0)) || 0,
            Date.now()
          ]));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/channels/')) {
      const id = path.slice('/api/sfmc/channels/'.length);
      if (!id) { json(res, { success: false, error: 'missing_id' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_chat_channels WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { channel: rows[0] });
      } else if (method === 'PATCH') {
        const data = (await body(req)).channel || (await body(req));
        if (!data || typeof data !== 'object') { json(res, { success: false, error: 'invalid' }, 400); return; }
        const sets = ['updated_at=?'];
        const vals = [Date.now()];
        const colMap = {
          name: 'name', prefix: 'prefix', ownerId: 'owner_id', ownerid: 'owner_id',
          createdAt: 'created_at',
          configAllowChat: 'config_allow_chat', configSlowMode: 'config_slow_mode', configIsBroadcast: 'config_is_broadcast',
        };
        for (const [jsField, dbCol] of Object.entries(colMap)) {
          if (data[jsField] !== undefined) { sets.push(`${dbCol}=?`); vals.push(data[jsField]); }
        }
        if (data.config?.allowChat !== undefined) { sets.push('config_allow_chat=?'); vals.push(data.config.allowChat ? 1 : 0); }
        if (data.config?.slowMode !== undefined) { sets.push('config_slow_mode=?'); vals.push(data.config.slowMode); }
        if (data.config?.isBroadcast !== undefined) { sets.push('config_is_broadcast=?'); vals.push(data.config.isBroadcast ? 1 : 0); }
        if (sets.length > 1) { vals.push(id); query(`UPDATE sfmc_chat_channels SET ${sets.join(', ')} WHERE id=?`, vals); }
        json(res, { success: true });
      } else if (method === 'DELETE') {
        query('DELETE FROM sfmc_chat_channels WHERE id = ?', [id]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/messages ──────
    if (path === '/api/sfmc/messages') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_chat_messages WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (content LIKE ?)', transform: v => `%${v}%`, repeat: 1 },
          { key: 'type', sql: ' AND type = ?', transform: v => v, repeat: 1 },
          { key: 'channelId', sql: ' AND channel_id = ?', transform: v => v, repeat: 1 },
          { key: 'from', sql: ' AND from_id = ?', transform: v => v, repeat: 1 },
          { key: 'minCreatedAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
          { key: 'maxCreatedAt', sql: ' AND created_at <= ?', transform: v => Number(v), repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY created_at ASC';
        json(res, { messages: query(sql, values) });
      } else if (method === 'POST') {
        const { messages } = await body(req);
        if (!Array.isArray(messages) || messages.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (messages.length > 100) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_messages (
            id, channel_id, from_id, from_name, type, content, attachment, show_timestamp, created_at
          ) VALUES ${messages.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          messages.flatMap(m => [
            m.id, m.channelId, m.fromid, m.fromName,
            m.type || 'text', m.content, m.attachment || null,
            m.showTimestamp ? 1 : 0, m.timestamp
          ]));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/redpacket ──────
    if (path === '/api/sfmc/redpacket') {
      if (method === 'GET') {
        json(res, { redpackets: query('SELECT * FROM sfmc_chat_redpackets') });
      } else if (method === 'POST') {
        const rp = (await body(req)).redpacket;
        if (!rp?.id) { json(res, { success: false, error: 'invalid' }, 400); return; }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_redpackets (
            id, sender_id, sender_name, total_amount, remaining_amount,
            total_count, remaining_count, receivers, target_type, target_id, created_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          rp.id, rp.senderid, rp.senderName, rp.totalAmount, rp.remainingAmount,
          rp.totalCount, rp.remainingCount, JSON.stringify(rp.receivers),
          rp.targetType, rp.targetId, rp.createdAt, rp.expiresAt
        ]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/redpacket/')) {
      const id = path.slice('/api/sfmc/redpacket/'.length);
      if (!id) { json(res, { success: false, error: 'missing_id' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_chat_redpackets WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { redpacket: rows[0] });
      } else if (method === 'PATCH') {
        const { remainingAmount, remainingCount, receivers } = await body(req);
        query('UPDATE sfmc_chat_redpackets SET remaining_amount=?, remaining_count=?, receivers=? WHERE id=?',
          [remainingAmount, remainingCount, JSON.stringify(receivers || []), id]);
        json(res, { success: true });
      } else if (method === 'DELETE') {
        query('DELETE FROM sfmc_chat_redpackets WHERE id = ?', [id]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/players ──────
    if (path === '/api/sfmc/players/saveField') {
      if (method === 'POST') {
        const { playerId, field, value } = await body(req);
        if (!playerId || !field) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const bind = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
        query(`UPDATE sfmc_players SET ${field.replace(/:/g, '_')}=?, updated_at=? WHERE id=?`, [bind, Date.now(), playerId]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/players/saveAll') {
      if (method === 'POST') {
        const { players } = await body(req);
        if (!Array.isArray(players)) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const now = Date.now();
        for (const p of players) {
          query(
            `INSERT OR REPLACE INTO sfmc_players (id, name, active_channel, updated_at) VALUES (?, ?, ?, ?)`,
            [p.id || p.playerId, p.name || '', p.activeChannel || '', now]
          );
        }
        json(res, { success: true, count: players.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/players') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_players WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (name LIKE ? OR id LIKE ?)', transform: v => `%${v}%`, repeat: 2 },
          { key: 'name', sql: ' AND name LIKE ?', transform: v => `%${v}%`, repeat: 1 },
          { key: 'id', sql: ' AND id = ?', transform: v => v, repeat: 1 },
          { key: 'active_channel', sql: ' AND active_channel = ?', transform: v => v, repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY updated_at ASC';
        json(res, { players: query(sql, values) });
      } else if (method === 'POST') {
        const { players } = await body(req);
        if (!Array.isArray(players) || players.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (players.length > 110) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        query(`INSERT OR REPLACE INTO sfmc_players (
          id, name, permission,
          client_system_info_local, client_system_info_maxRenderDistance,
          client_system_info_memoryTier_level, client_system_info_PlatformType,
          graphicsMode, dynamicPropertyTotalByteCount, ping,
          spawnPoint, tags, level, totalXp,
          afk_step, afk_last_location,
          onlinetime_session, onlinetime_today, onlinetime_month, onlinetime_total,
          onlinetime_last_date, onlinetime_last_month, active_channel, updated_at
        ) VALUES ${players.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          players.flatMap(p => [
            p.id, p.name, p.permission,
            p.clientSystemInfoLocal || '', p.clientSystemInfoMaxRenderDistance || 0,
            p.clientSystemInfoMemoryTier_level || 0, p.clientSystemInfo_PlatformType || '',
            p.graphicsMode || '', p.dynamicPropertyTotalByteCount || 0, p.ping || 0,
            p.spawnPoint || '', p.tags || '', p.level || 0, p.totalXp || 0,
            p.afkStep || 0, p.afkLastLocation || '',
            p.onlinetimeSession || 0, p.onlinetimeToday || 0, p.onlinetimeMonth || 0, p.onlinetimeTotal || 0,
            p.onlinetimeLastDate || '', p.onlinetimeLastMonth || '', p.activeChannel || '',
            Date.now()
          ]));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/players/')) {
      const id = path.slice('/api/sfmc/players/'.length);
      if (!id) { json(res, { success: false, error: 'invalid' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_players WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { player: rows[0] });
      } else if (method === 'PATCH') {
        const { player } = await body(req);
        if (!player || typeof player !== 'object') { json(res, { success: false, error: 'invalid' }, 400); return; }
        const FIELD_MAP = {
          permission: 'permission',
          clientSystemInfoLocal: 'client_system_info_local',
          clientSystemInfoMaxRenderDistance: 'client_system_info_max_render_distance',
          clientSystemInfoMemoryTier_level: 'client_system_info_memory_tier_level',
          clientSystemInfoPlatformType: 'client_system_info_platform_type',
          graphicsMode: 'graphics_mode',
          dynamicPropertyTotalByteCount: 'dynamic_property_total_byte_count',
          ping: 'ping', spawnPoint: 'spawn_point', tags: 'tags',
          level: 'level', totalXp: 'total_xp',
          afkStep: 'afk_step', afkLastLocation: 'afk_last_location',
          onlinetimeSession: 'onlinetime_session', onlinetimeToday: 'onlinetime_today',
          onlinetimeMonth: 'onlinetime_month', onlinetimeTotal: 'onlinetime_total',
          onlinetimeLastDate: 'onlinetime_last_date', onlinetimeLastMonth: 'onlinetime_last_month',
          activeChannel: 'active_channel',
        };
        const sets = ['updated_at=?'];
        const vals = [Date.now()];
        for (const [jsField, dbCol] of Object.entries(FIELD_MAP)) {
          if (player[jsField] !== undefined) { sets.push(`${dbCol}=?`); vals.push(player[jsField]); }
        }
        if (sets.length > 1) { vals.push(id); query(`UPDATE sfmc_players SET ${sets.join(', ')} WHERE id=?`, vals); }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/scoreboards ──────
    if (path === '/api/sfmc/scoreboards') {
      if (method === 'GET') {
        json(res, { entries: query('SELECT * FROM sfmc_scoreboards') });
      } else if (method === 'POST') {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries)) { json(res, { success: false, error: 'entries array required' }, 400); return; }
        const now = Date.now();
        for (const e of entries) {
          query(
            'INSERT OR REPLACE INTO sfmc_scoreboards (objective_id, objective_display, participants, updated_at) VALUES (?, ?, ?, ?)',
            [e.objectiveId || e.id, e.objectiveDisplay || e.displayName || '', JSON.stringify(e.participantIds || e.participants || []), now]
          );
        }
        json(res, { success: true, count: entries.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/activities ──────
    if (path === '/api/sfmc/activities/batch') {
      if (method === 'POST') {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries) || entries.length === 0) { json(res, { success: false, error: 'entries array required' }, 400); return; }
        const now = Date.now();
        const insert = `INSERT OR IGNORE INTO sfmc_activities (
          id, timestamp, dimension, source_type, source_id, source_name,
          source_x, source_y, source_z, event_type,
          target_type, target_id, target_name, target_x, target_y, target_z, detail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        for (const e of entries) {
          query(insert, [
            e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`, e.timestamp || now,
            e.dimension || '', e.sourceType || 'unknown', e.sourceid || '', e.sourceName || '',
            e.sourceX ?? null, e.sourceY ?? null, e.sourceZ ?? null,
            e.eventType || 'unknown', e.targetType || '', e.targetid || '', e.targetName || '',
            e.targetX ?? null, e.targetY ?? null, e.targetZ ?? null,
            typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail || {}), now
          ]);
        }
        json(res, { success: true, count: entries.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities/cleanup') {
      if (method === 'POST') {
        const { keepDays = 30, keepAdmin = true } = await body(req);
        const cutoff = Date.now() - keepDays * 86400000;
        if (keepAdmin) {
          const r = query('DELETE FROM sfmc_activities WHERE timestamp < ? AND event_type NOT LIKE ?', [cutoff, 'admin.%']);
          json(res, { success: true, deleted: r.changes || 0 });
        } else {
          const r = query('DELETE FROM sfmc_activities WHERE timestamp < ?', [cutoff]);
          json(res, { success: true, deleted: r.changes || 0 });
        }
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities/stats') {
      if (method === 'GET') {
        const id = params.get('id') || '';
        const from = params.get('from') || '';
        const to = params.get('to') || '';
        let cond = 'WHERE 1=1';
        const vals = [];
        if (id) { cond += ' AND source_id = ?'; vals.push(id); }
        if (from) { cond += ' AND timestamp >= ?'; vals.push(parseInt(from)); }
        if (to) { cond += ' AND timestamp <= ?'; vals.push(parseInt(to)); }
        const totalRow = query(`SELECT COUNT(*) as total FROM sfmc_activities ${cond}`, vals);
        const byEvent = query(`SELECT event_type, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY event_type ORDER BY count DESC`, vals);
        const byDate = query(`SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY date ORDER BY date DESC LIMIT 30`, vals);
        json(res, { total: totalRow[0]?.total || 0, byEvent, byDate });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities') {
      if (method === 'GET') {
        const id = params.get('id') || '';
        const event = params.get('event') || '';
        const from = params.get('from') || '';
        const to = params.get('to') || '';
        const sourceName = params.get('name') || '';
        const limit = Math.min(parseInt(params.get('limit') || '200', 10), 1000);
        const offset = parseInt(params.get('offset') || '0', 10);
        let sql = 'SELECT * FROM sfmc_activities WHERE 1=1';
        const vals = [];
        if (id) { sql += ' AND source_id = ?'; vals.push(id); }
        if (event) { sql += ' AND event_type = ?'; vals.push(event); }
        if (from) { sql += ' AND timestamp >= ?'; vals.push(parseInt(from)); }
        if (to) { sql += ' AND timestamp <= ?'; vals.push(parseInt(to)); }
        if (sourceName) { sql += ' AND source_name = ?'; vals.push(sourceName); }
        sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        vals.push(limit, offset);
        const rows = query(sql, vals);
        json(res, { entries: rows, count: rows.length, limit, offset });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/coop/:key ──────
    if (path.startsWith('/api/sfmc/coop/')) {
      if (method === 'GET') {
        const key = path.slice('/api/sfmc/coop/'.length);
        const rows = query('SELECT value FROM sfmc_coop_data WHERE key = ?', [key]);
        json(res, { value: rows.length > 0 ? rows[0].value : null });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // 未匹配 → 404
    json(res, { success: false, error: 'not_found' }, 404);
  } catch (err) {
    console.error('[DogeDB] 错误:', err);
    json(res, { success: false, error: err.message }, 500);
  }
}

// ---------- 启动 ----------

async function start() {
  await initDB();

  // 执行 Holoprint DDL
  const holoDDL = getHoloprintDDL();
  for (const sql of holoDDL) {
    try { db.exec(sql); } catch (err) { console.error('[Holoprint] 建表失败:', err.message); }
  }
  // 确保 hpbe_pack_meta 有初始行
  const hpbeExisting = query('SELECT id FROM hpbe_pack_meta WHERE id = 1');
  if (hpbeExisting.length === 0) {
    query('INSERT INTO hpbe_pack_meta (id, pack_version, last_generated_at) VALUES (1, 1, NULL)');
  }

  // 用 Holoprint 路由包装原始 handler
  const holoHandler = registerHoloprintRoutes(handle, db, query, body, json);
  const server = http.createServer(holoHandler);

  server.listen(PORT, () => {
    console.log(`[DogeDB] HTTP 服务已启动，端口 ${PORT}`);
    console.log(`[DogeDB] API 健康检查: http://127.0.0.1:${PORT}/api/health`);
  });

  process.on('exit', () => {
    if (db) db.close();
  });
}

start().catch(err => {
  console.error('[DogeDB] 启动失败:', err);
  process.exit(1);
});
