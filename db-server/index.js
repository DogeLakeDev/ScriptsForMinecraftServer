/**
 * DogeChat 数据库服务 — HTTP REST API
 * SQLite (bun:sqlite) + Node.js http
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { Database } = require('bun:sqlite');

// 加载外部配置 JSON（覆盖 process.env）
try {
  const cfgPath = path.join(__dirname, '..', 'configs', 'db_config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  for (const [k, v] of Object.entries(cfg)) {
    const envKey = k.replace(/([A-Z])/g, '_$1').toUpperCase();
    process.env[envKey] = String(v);
    console.info(`[DogeDB] 配置 ${k} -> process.env.${envKey} = ${v}`);
  }
} catch (e) {
  console.warn('[DogeDB] 未找到 configs/db_config.json，使用默认值');
}

const PORT = parseInt(process.env.DB_PORT || '3001', 10);
const DB_PATH = path.join(__dirname, 'sfmc_data.db');
const QQ_BRIDGE_HOST = '127.0.0.1';
const QQ_BRIDGE_PORT = parseInt(process.env.QQ_BRIDGE_PORT || '3003', 10);

let db;

// 监控面板内存存储（SAPI 上报，Panel 拉取）
let _monitorMetrics = null;
let _monitorPlayers = [];

// ---------- 数据库初始化 ----------

async function initDB() {
  db = new Database(DB_PATH);
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA busy_timeout = 5000');

  const fkList = db.prepare("PRAGMA foreign_key_list('sfmc_chat_messages')").all();
  if (fkList.length > 0) {
    db.run('DROP TABLE IF EXISTS sfmc_chat_messages');
    console.log('[DogeDB] 已迁移 sfmc_chat_messages（移除无效 FK）');
  }

  db.run(`
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
        subscribed_channels TEXT DEFAULT '',
        
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

      CREATE TABLE IF NOT EXISTS sfmc_chat_redpackets (
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

      DROP TABLE IF EXISTS sfmc_coop_data;
      `);
  // 配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS sfmc_config_modules (
      name TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      name TEXT DEFAULT '',
      dimension TEXT NOT NULL,
      start_x REAL NOT NULL, start_z REAL NOT NULL,
      end_x REAL NOT NULL, end_z REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_peace_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family TEXT NOT NULL,
      exclude_family TEXT DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_grids (
      name TEXT PRIMARY KEY,
      start_x INTEGER, start_y INTEGER, start_z INTEGER,
      size_h INTEGER, size_v INTEGER,
      direction INTEGER, face INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_banned_items (
      item_id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_clean (
      id INTEGER PRIMARY KEY CHECK(id=1),
      item_max INTEGER NOT NULL DEFAULT 192,
      poll_interval INTEGER NOT NULL DEFAULT 60,
      updated_at INTEGER NOT NULL
    );
  `);
  db.run("INSERT OR IGNORE INTO sfmc_config_clean(id, item_max, poll_interval, updated_at) VALUES(1, 192, 60, 0)");
  db.run(`

    CREATE TABLE IF NOT EXISTS sfmc_config_permissions (
      player_name TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight INTEGER NOT NULL DEFAULT 1,
      question TEXT NOT NULL,
      answers TEXT NOT NULL,
      msg_right TEXT DEFAULT '',
      msg_wrong TEXT DEFAULT '',
      explanation TEXT DEFAULT '',
      min_rank INTEGER DEFAULT NULL,
      max_rank INTEGER DEFAULT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      min_rank INTEGER DEFAULT NULL, max_rank INTEGER DEFAULT NULL,
      type TEXT NOT NULL, amount INTEGER DEFAULT 0,
      item_type TEXT DEFAULT '', item_aux INTEGER DEFAULT 0,
      cmd TEXT DEFAULT '',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES sfmc_config_qa_questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_punishments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'cmd', cmd TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES sfmc_config_qa_questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_shop_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT NULL,
      name TEXT NOT NULL, type TEXT NOT NULL,
      image TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES sfmc_config_shop_categories(id)
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      item_type TEXT NOT NULL, item_aux INTEGER DEFAULT 0,
      price INTEGER NOT NULL, remark TEXT DEFAULT '',
      sell_flag INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES sfmc_config_shop_categories(id)
    );
    -- Coop 表
    CREATE TABLE IF NOT EXISTS sfmc_coops (
      cid TEXT PRIMARY KEY,
      name TEXT NOT NULL, owner_name TEXT NOT NULL,
      notice TEXT DEFAULT '', money INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_members (
      cid TEXT NOT NULL, player_name TEXT NOT NULL,
      is_op INTEGER DEFAULT 0, joined_at INTEGER NOT NULL,
      PRIMARY KEY (cid, player_name),
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_items (
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL, name TEXT NOT NULL,
      item_type TEXT NOT NULL, item_aux INTEGER DEFAULT 0,
      item_nbt TEXT DEFAULT '', type INTEGER NOT NULL,
      groups TEXT DEFAULT '[]', des TEXT DEFAULT '',
      num INTEGER DEFAULT 0, sv INTEGER DEFAULT 0,
      money INTEGER DEFAULT 0, is_true INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_bank_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT NOT NULL, player_name TEXT NOT NULL,
      type INTEGER NOT NULL, amount INTEGER NOT NULL,
      note TEXT DEFAULT '', created_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_groups (
      groupid TEXT PRIMARY KEY,
      displayname TEXT NOT NULL,
      displaydescribe TEXT DEFAULT '',
      icon TEXT DEFAULT '', type_function TEXT DEFAULT ''
    );
  `);
  // 从 /configs/ JSON 文件导入初始配置（仅空表时执行）
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name='sfmc_config_modules'");
  if (tables.length > 0) {
    const cnt = query('SELECT COUNT(*) as c FROM sfmc_config_modules');
    if (cnt[0].c === 0) {
      const cfgDir = path.join(__dirname, '..', 'configs');
      const now = Date.now();
      const _ = (q, p) => { try { query(q, p); } catch (e) { console.warn('[DogeDB] config:', e.message); } };
      try {
        const m = JSON.parse(fs.readFileSync(path.join(cfgDir, 'modules.json'), 'utf-8'));
        for (const [k, v] of Object.entries(m.modules)) _( 'INSERT OR REPLACE INTO sfmc_config_modules (name, enabled, updated_at) VALUES (?,?,?)', [k, v ? 1 : 0, now]);
      } catch (e) {}
      try {
        const s = JSON.parse(fs.readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8'));
        for (const [k, v] of Object.entries(s)) _('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', [k, String(v), now]);
      } catch (e) {}
      try {
        const a = JSON.parse(fs.readFileSync(path.join(cfgDir, 'areas.json'), 'utf-8'));
        for (const r of a) _('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?,?,?,?,?,?,?,?)', [r.module, r.name || '', r.dimension, r.start_x, r.start_z, r.end_x, r.end_z, now]);
      } catch (e) {}
      try {
        const p = JSON.parse(fs.readFileSync(path.join(cfgDir, 'peace_filters.json'), 'utf-8'));
        for (const r of p) _('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?,?,?)', [r.family, r.exclude_family || '', now]);
      } catch (e) {}
      try {
        const g = JSON.parse(fs.readFileSync(path.join(cfgDir, 'grids.json'), 'utf-8'));
        for (const r of g) _('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [r.name, r.start_x, r.start_y, r.start_z, r.size_h, r.size_v, r.direction, r.face, now]);
      } catch (e) {}
      try {
        const b = JSON.parse(fs.readFileSync(path.join(cfgDir, 'banned_items.json'), 'utf-8'));
        for (const i of b) _('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?,?)', [i, now]);
      } catch (e) {}
      try {
        const c = JSON.parse(fs.readFileSync(path.join(cfgDir, 'clean.json'), 'utf-8'));
        _('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1,?,?,?)', [c.item_max ?? 192, c.poll_interval ?? 60, now]);
      } catch (e) {}
      try {
        const perm = JSON.parse(fs.readFileSync(path.join(cfgDir, 'permissions.json'), 'utf-8'));
        for (const r of perm) _('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?,?,?)', [r.player_name, r.level, now]);
      } catch (e) {}
      try {
        const q = JSON.parse(fs.readFileSync(path.join(cfgDir, 'questions.json'), 'utf-8'));
        for (const r of q) {
          const res2 = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [r.weight ?? 1, r.question, JSON.stringify(r.answers || []), r.msg_right || '', r.msg_wrong || '', r.explanation || '', r.min_rank ?? null, r.max_rank ?? null, now]);
          const qid = res2[0]?.id;
          if (qid && r.rewards) { for (const rw of r.rewards) _('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [qid, rw.min_rank ?? null, rw.max_rank ?? null, rw.type, rw.amount ?? 0, rw.item_type || '', rw.item_aux ?? 0, rw.cmd || '', now]); }
          if (qid && r.punishments) { for (const pw of r.punishments) _('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?,?,?,?)', [qid, pw.type || 'cmd', pw.cmd, now]); }
        }
      } catch (e) {}
      try {
        const sh = JSON.parse(fs.readFileSync(path.join(cfgDir, 'shop.json'), 'utf-8'));
        if (sh.categories) { for (const r of sh.categories) _('INSERT INTO sfmc_config_shop_categories (id, parent_id, name, type, image, sort_order, updated_at) VALUES (?,?,?,?,?,?,?)', [r.id, r.parent_id ?? null, r.name, r.type, r.image || '', r.sort_order ?? 0, now]); }
      } catch (e) {}
      console.log('[DogeDB] 初始配置已从 /configs/ 导入');
    }
  }
  console.log('[DogeDB] 数据库已就绪');
}

/**
 * 从 /configs/ JSON 文件重新导入所有配置到 SQLite（控制台 reload 命令使用）
 * 每次都会重新导入（不检查表是否为空），并更新 updated_at 触发 SAPI 轮询
 */
function reloadConfigsFromJson() {
  const cfgDir = path.join(__dirname, '..', 'configs');
  const now = Date.now();
  const _ = (q, p) => { try { query(q, p); } catch (e) { console.warn('[ConfigReload]', e.message); } };
  const log = (table, count) => console.log(`[ConfigReload] ${table}: ${count}个`);
  try {
    const m = JSON.parse(fs.readFileSync(path.join(cfgDir, 'modules.json'), 'utf-8'));
    let c = 0; for (const [k, v] of Object.entries(m.modules)) { _( 'INSERT OR REPLACE INTO sfmc_config_modules (name, enabled, updated_at) VALUES (?,?,?)', [k, v ? 1 : 0, now]); c++; } log('modules', c);
  } catch (e) { console.warn('[ConfigReload] modules.json 失败:', e.message); }
  try {
    const s = JSON.parse(fs.readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8'));
    let c = 0; for (const [k, v] of Object.entries(s)) { _('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', [k, String(v), now]); c++; } log('settings', c);
  } catch (e) { console.warn('[ConfigReload] settings.json 失败:', e.message); }
  try {
    const a = JSON.parse(fs.readFileSync(path.join(cfgDir, 'areas.json'), 'utf-8'));
    let c = 0; for (const r of a) { _('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?,?,?,?,?,?,?,?)', [r.module, r.name || '', r.dimension, r.start_x, r.start_z, r.end_x, r.end_z, now]); c++; } log('areas', c);
  } catch (e) { console.warn('[ConfigReload] areas.json 失败:', e.message); }
  try {
    const p = JSON.parse(fs.readFileSync(path.join(cfgDir, 'peace_filters.json'), 'utf-8'));
    let c = 0; for (const r of p) { _('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?,?,?)', [r.family, r.exclude_family || '', now]); c++; } log('peace_filters', c);
  } catch (e) { console.warn('[ConfigReload] peace_filters.json 失败:', e.message); }
  try {
    const g = JSON.parse(fs.readFileSync(path.join(cfgDir, 'grids.json'), 'utf-8'));
    let c = 0; for (const r of g) { _('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [r.name, r.start_x, r.start_y, r.start_z, r.size_h, r.size_v, r.direction, r.face, now]); c++; } log('grids', c);
  } catch (e) { console.warn('[ConfigReload] grids.json 失败:', e.message); }
  try {
    const b = JSON.parse(fs.readFileSync(path.join(cfgDir, 'banned_items.json'), 'utf-8'));
    let c = 0; for (const i of b) { _('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?,?)', [i, now]); c++; } log('banned_items', c);
  } catch (e) { console.warn('[ConfigReload] banned_items.json 失败:', e.message); }
  try {
    const c = JSON.parse(fs.readFileSync(path.join(cfgDir, 'clean.json'), 'utf-8'));
    _('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1,?,?,?)', [c.item_max ?? 192, c.poll_interval ?? 60, now]);
    log('clean', 1);
  } catch (e) { console.warn('[ConfigReload] clean.json 失败:', e.message); }
  try {
    const perm = JSON.parse(fs.readFileSync(path.join(cfgDir, 'permissions.json'), 'utf-8'));
    let c = 0; for (const r of perm) { _('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?,?,?)', [r.player_name, r.level, now]); c++; } log('permissions', c);
  } catch (e) { console.warn('[ConfigReload] permissions.json 失败:', e.message); }
  try {
    const q = JSON.parse(fs.readFileSync(path.join(cfgDir, 'questions.json'), 'utf-8'));
    let c = 0; for (const r of q) {
      const res2 = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [r.weight ?? 1, r.question, JSON.stringify(r.answers || []), r.msg_right || '', r.msg_wrong || '', r.explanation || '', r.min_rank ?? null, r.max_rank ?? null, now]);
      const qid = res2[0]?.id;
      if (qid && r.rewards) { for (const rw of r.rewards) _('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [qid, rw.min_rank ?? null, rw.max_rank ?? null, rw.type, rw.amount ?? 0, rw.item_type || '', rw.item_aux ?? 0, rw.cmd || '', now]); }
      if (qid && r.punishments) { for (const pw of r.punishments) _('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?,?,?,?)', [qid, pw.type || 'cmd', pw.cmd, now]); }
      c++;
    }
    log('questions', c);
  } catch (e) { console.warn('[ConfigReload] questions.json 失败:', e.message); }
  try {
    const sh = JSON.parse(fs.readFileSync(path.join(cfgDir, 'shop.json'), 'utf-8'));
    let c = 0;
    if (sh.categories) { for (const r of sh.categories) { _('INSERT INTO sfmc_config_shop_categories (id, parent_id, name, type, image, sort_order, updated_at) VALUES (?,?,?,?,?,?,?)', [r.id, r.parent_id ?? null, r.name, r.type, r.image || '', r.sort_order ?? 0, now]); c++; } }
    if (sh.items) { for (const r of sh.items) { _('INSERT INTO sfmc_config_shop_items (category_id, item_type, item_aux, price, remark, sell_flag, updated_at) VALUES (?,?,?,?,?,?,?)', [r.category_id, r.item_type, r.item_aux ?? 0, r.price, r.remark || '', r.sell_flag ?? 0, now]); c++; } }
    log('shop', c);
  } catch (e) { console.warn('[ConfigReload] shop.json 失败:', e.message); }
  // 发送热重载信号，SAPI 端 fastPoll 每 2 秒检查此值
  query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', ['_reload_signal', String(now), now]);
  console.log(`[ConfigReload] 已发送热重载信号 (${now})，SAPI 将在 2 秒内生效`);
}
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

/** 转发消息到 QQ Bridge 独立进程 */
function forwardToQQBridge(channelId, fromName, content, fromId) {
  const payload = JSON.stringify({ channelId, fromName, content, fromId });
  const options = {
    hostname: QQ_BRIDGE_HOST,
    port: QQ_BRIDGE_PORT,
    path: '/forward',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };
  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => console.warn(`[DogeDB] QQ Bridge forward → ${res.statusCode}: ${body.slice(0, 100)}`));
    }
  });
  req.on('error', (err) => console.warn(`[DogeDB] QQ Bridge 不可达: ${err.message}`));
  req.write(payload);
  req.end();
}

// 预编译语句缓存
const _stmtCache = new Map();
const _STMT_CACHE_MAX = 200;

function query(sql, params = []) {
  let stmt = _stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    if (_stmtCache.size >= _STMT_CACHE_MAX) {
      const first = _stmtCache.keys().next().value;
      _stmtCache.delete(first);
    }
    _stmtCache.set(sql, stmt);
  }
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
      } else if (method === 'PATCH' || method === 'PUT') {
        const raw = await body(req);
        const data = raw.channel || raw;
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
          { key: 'minSentAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
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
        // Forward to QQ bridge if enabled
        for (const m of messages) {
          forwardToQQBridge(m.channelId, m.fromName, m.content, m.fromid);
        }
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
      } else if (method === 'PATCH' || method === 'PUT') {
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
          onlinetime_last_date, onlinetime_last_month, active_channel, subscribed_channels, updated_at
        ) VALUES ${players.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          players.flatMap(p => [
            p.id, p.name, p.permission,
            p.clientSystemInfoLocal || '', p.clientSystemInfoMaxRenderDistance || 0,
            p.clientSystemInfoMemoryTier_level || 0, p.clientSystemInfo_PlatformType || '',
            p.graphicsMode || '', p.dynamicPropertyTotalByteCount || 0, p.ping || 0,
            p.spawnPoint || '', p.tags || '', p.level || 0, p.totalXp || 0,
            p.afkStep || 0, p.afkLastLocation || '',
            p.onlinetimeSession || 0, p.onlinetimeToday || 0, p.onlinetimeMonth || 0, p.onlinetimeTotal || 0,
            p.onlinetimeLastDate || '', p.onlinetimeLastMonth || '', p.activeChannel || '',
            p.subscribedChannels || '', Date.now()
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
      } else if (method === 'PATCH' || method === 'PUT') {
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
          subscribedChannels: 'subscribed_channels',
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

    // ────── /api/sfmc/configs/import ──────
    if (path === '/api/sfmc/configs/import') {
      if (method === 'POST') {
        const { table, rows } = await body(req);
        if (!table || !Array.isArray(rows) || rows.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const now = Date.now();
        for (const r of rows) { r.updated_at = now; }
        if (table === 'modules') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_modules (name, enabled, updated_at) VALUES (?, ?, ?)', [r.name, r.enabled ? 1 : 0, now]); }
        } else if (table === 'settings') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', [r.key, String(r.value), now]); }
        } else if (table === 'areas') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [r.module, r.name || '', r.dimension, r.start_x, r.start_z, r.end_x, r.end_z, now]); }
        } else if (table === 'peace_filters') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?, ?, ?)', [r.family, r.exclude_family || '', now]); }
        } else if (table === 'grids') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.name, r.start_x, r.start_y, r.start_z, r.size_h, r.size_v, r.direction, r.face, now]); }
        } else if (table === 'banned_items') {
          for (const r of rows) { query('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?, ?)', [r.item_id, now]); }
        } else if (table === 'clean') {
          if (rows.length > 0) { query('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1, ?, ?, ?)', [rows[0].item_max ?? 192, rows[0].poll_interval ?? 60, now]); }
        } else if (table === 'permissions') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?, ?, ?)', [r.player_name, r.level, now]); }
        } else if (table === 'qa_questions') {
          for (const r of rows) {
            const qi = r.id || null;
            const res2 = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', [r.weight ?? 1, r.question, JSON.stringify(r.answers || []), r.msg_right || '', r.msg_wrong || '', r.explanation || '', r.min_rank ?? null, r.max_rank ?? null, now]);
            const qid = res2[0]?.id;
            if (qid && r.rewards) {
              for (const rw of r.rewards) { query('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [qid, rw.min_rank ?? null, rw.max_rank ?? null, rw.type, rw.amount ?? 0, rw.item_type || '', rw.item_aux ?? 0, rw.cmd || '', now]); }
            }
            if (qid && r.punishments) {
              for (const p of r.punishments) { query('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?, ?, ?, ?)', [qid, p.type || 'cmd', p.cmd, now]); }
            }
          }
        } else if (table === 'shop_categories') {
          for (const r of rows) { query('INSERT INTO sfmc_config_shop_categories (id, parent_id, name, type, image, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [r.id, r.parent_id ?? null, r.name, r.type, r.image || '', r.sort_order ?? 0, now]); }
        } else if (table === 'shop_items') {
          for (const r of rows) { query('INSERT INTO sfmc_config_shop_items (category_id, item_type, item_aux, price, remark, sell_flag, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [r.category_id, r.item_type, r.item_aux ?? 0, r.price, r.remark || '', r.sell_flag ?? 0, now]); }
        } else if (table === 'coop_shop_groups') {
          for (const r of rows) { query('INSERT OR REPLACE INTO sfmc_coop_shop_groups (groupid, displayname, displaydescribe, icon, type_function, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [r.groupid, r.displayname, r.displaydescribe || '', r.icon || '', r.type_function || '', now]); }
        } else { json(res, { success: false, error: 'unknown_table' }, 400); return; }
        json(res, { success: true, count: rows.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/configs/updated-since/:ts ──────
    if (path.startsWith('/api/sfmc/configs/updated-since/')) {
      if (method === 'GET') {
        const ts = parseInt(path.slice('/api/sfmc/configs/updated-since/'.length), 10);
        if (isNaN(ts)) { json(res, { success: false, error: 'invalid_ts' }, 400); return; }
        const result = {};
        const configTables = ['sfmc_config_modules', 'sfmc_config_settings', 'sfmc_config_areas', 'sfmc_config_permissions', 'sfmc_config_qa_questions', 'sfmc_config_shop_categories', 'sfmc_config_shop_items', 'sfmc_config_clean', 'sfmc_config_banned_items', 'sfmc_config_grids', 'sfmc_config_peace_filters'];
        for (const tbl of configTables) {
          const rows = query(`SELECT * FROM ${tbl} WHERE updated_at > ?`, [ts]);
          if (rows.length > 0) result[tbl.replace('sfmc_config_', '')] = rows;
        }
        json(res, { updated: result, timestamp: Date.now() });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/settings ──────
    if (path === '/api/sfmc/settings') {
      if (method === 'GET') { json(res, { settings: query('SELECT * FROM sfmc_config_settings') }); return; }
      else { json(res, { success: false, error: 'not_found' }, 404); return; }
    }
    if (path.startsWith('/api/sfmc/settings/')) {
      const key = path.slice('/api/sfmc/settings/'.length);
      if (method === 'GET') {
        const rows = query('SELECT value FROM sfmc_config_settings WHERE key = ?', [key]);
        json(res, { value: rows.length > 0 ? rows[0].value : null });
      } else if (method === 'PATCH' || method === 'PUT') {
        const { value } = await body(req);
        query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(value ?? ''), Date.now()]);
        try {
          const sPath = require('path').join(__dirname, '..', 'configs', 'settings.json');
          const sData = JSON.parse(fs.readFileSync(sPath, 'utf-8'));
          sData[key] = value;
          fs.writeFileSync(sPath, JSON.stringify(sData, null, 2) + '\n');
          console.log(`[ConfigSync] settings.json: ${key} = ${JSON.stringify(value)}`);
        } catch (e) { console.warn(`[ConfigSync] settings.json 同步失败: ${e.message}`); }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/modules ──────
    if (path === '/api/sfmc/modules') {
      if (method === 'GET') { json(res, { modules: query('SELECT * FROM sfmc_config_modules') }); return; }
      else { json(res, { success: false, error: 'not_found' }, 404); return; }
    }
    if (path.startsWith('/api/sfmc/modules/')) {
      const name = path.slice('/api/sfmc/modules/'.length);
      if (method === 'PATCH' || method === 'PUT') {
        const { enabled } = await body(req);
        query('INSERT OR REPLACE INTO sfmc_config_modules (name, enabled, updated_at) VALUES (?, ?, ?)', [name, enabled ? 1 : 0, Date.now()]);
        try {
          const mPath = require('path').join(__dirname, '..', 'configs', 'modules.json');
          const mData = JSON.parse(fs.readFileSync(mPath, 'utf-8'));
          mData.modules[name] = !!enabled;
          fs.writeFileSync(mPath, JSON.stringify(mData, null, 2) + '\n');
          console.log(`[ConfigSync] modules.json: ${name} = ${!!enabled}`);
        } catch (e) { console.warn(`[ConfigSync] modules.json 同步失败: ${e.message}`); }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/areas ──────
    if (path === '/api/sfmc/areas') {
      if (method === 'GET') {
        const module = params.get('module') || '';
        let sql = 'SELECT * FROM sfmc_config_areas WHERE 1=1';
        const vals = [];
        if (module) { sql += ' AND module = ?'; vals.push(module); }
        json(res, { areas: query(sql, vals) });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/coops ──────
    if (path === '/api/sfmc/coops') {
      if (method === 'GET') {
        const all = query('SELECT * FROM sfmc_coops ORDER BY updated_at DESC');
        json(res, { coops: all });
      } else if (method === 'POST') {
        const { coop } = await body(req);
        if (!coop?.cid) { json(res, { success: false, error: 'cid required' }, 400); return; }
        const now = Date.now();
        query('INSERT OR REPLACE INTO sfmc_coops (cid, name, owner_name, notice, money, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [coop.cid, coop.name || '', coop.owner_name || '', coop.notice || '', coop.money ?? 0, coop.created_at || now, now]);
        if (coop.members) {
          for (const m of coop.members) {
            query('INSERT OR REPLACE INTO sfmc_coop_members (cid, player_name, is_op, joined_at) VALUES (?, ?, ?, ?)',
              [coop.cid, m.player_name, m.is_op ? 1 : 0, m.joined_at || now]);
          }
        }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/coops/')) {
      const rest = path.slice('/api/sfmc/coops/'.length);
      const parts = rest.split('/');
      const cid = parts[0];
      const sub = parts[1]; // 'members', 'shop_items', 'bank_log' etc
      const subId = parts[2];
      if (!cid) { json(res, { success: false, error: 'invalid' }, 400); return; }

      // GET/PATCH/DELETE /api/sfmc/coops/:cid
      if (!sub) {
        if (method === 'GET') {
          const rows = query('SELECT * FROM sfmc_coops WHERE cid = ?', [cid]);
          if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
          const coop = rows[0];
          coop.members = query('SELECT * FROM sfmc_coop_members WHERE cid = ?', [cid]);
          coop.shop_items = query('SELECT * FROM sfmc_coop_shop_items WHERE cid = ?', [cid]);
          json(res, { coop });
        } else if (method === 'PATCH' || method === 'PUT') {
          const data = await body(req);
          const sets = ['updated_at=?']; const vals = [Date.now()];
          if (data.name !== undefined) { sets.push('name=?'); vals.push(data.name); }
          if (data.notice !== undefined) { sets.push('notice=?'); vals.push(data.notice); }
          if (data.money !== undefined) { sets.push('money=?'); vals.push(data.money); }
          if (sets.length > 1) { vals.push(cid); query(`UPDATE sfmc_coops SET ${sets.join(', ')} WHERE cid=?`, vals); }
          json(res, { success: true });
        } else if (method === 'DELETE') {
          query('DELETE FROM sfmc_coop_members WHERE cid=?', [cid]);
          query('DELETE FROM sfmc_coop_shop_items WHERE cid=?', [cid]);
          query('DELETE FROM sfmc_coop_bank_log WHERE cid=?', [cid]);
          query('DELETE FROM sfmc_coops WHERE cid=?', [cid]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/members
      if (sub === 'members') {
        if (method === 'GET') {
          json(res, { members: query('SELECT * FROM sfmc_coop_members WHERE cid = ?', [cid]) });
        } else if (method === 'POST') {
          const { player_name, is_op } = await body(req);
          if (!player_name) { json(res, { success: false, error: 'player_name required' }, 400); return; }
          query('INSERT OR REPLACE INTO sfmc_coop_members (cid, player_name, is_op, joined_at) VALUES (?, ?, ?, ?)', [cid, player_name, is_op ? 1 : 0, Date.now()]);
          json(res, { success: true });
        } else if (method === 'DELETE' && subId) {
          query('DELETE FROM sfmc_coop_members WHERE cid=? AND player_name=?', [cid, decodeURIComponent(subId)]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/shop_items
      if (sub === 'shop_items') {
        if (method === 'GET') {
          const type = params.get('type') || '';
          let sql = 'SELECT * FROM sfmc_coop_shop_items WHERE cid=?';
          const vals = [cid];
          if (type) { sql += ' AND type=?'; vals.push(parseInt(type)); }
          json(res, { items: query(sql, vals) });
        } else if (method === 'POST') {
          const item = await body(req);
          if (!item.id) { json(res, { success: false, error: 'id required' }, 400); return; }
          query('INSERT OR REPLACE INTO sfmc_coop_shop_items (id, cid, name, item_type, item_aux, item_nbt, type, groups, des, num, sv, money, is_true, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, cid, item.name, item.item_type, item.item_aux ?? 0, item.item_nbt || '', item.type, item.groups || '[]', item.des || '', item.num ?? 0, item.sv ?? 0, item.money ?? 0, item.is_true ?? 1, item.created_at || Date.now(), Date.now()]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/bank_log
      if (sub === 'bank_log') {
        if (method === 'GET') {
          json(res, { log: query('SELECT * FROM sfmc_coop_bank_log WHERE cid=? ORDER BY created_at DESC LIMIT 100', [cid]) });
        } else if (method === 'POST') {
          const { player_name, type, amount, note } = await body(req);
          if (!player_name || !amount) { json(res, { success: false, error: 'invalid' }, 400); return; }
          query('INSERT INTO sfmc_coop_bank_log (cid, player_name, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [cid, player_name, type, amount, note || '', Date.now()]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/coop_shop_groups ──────
    if (path === '/api/sfmc/coop_shop_groups') {
      if (method === 'GET') { json(res, { groups: query('SELECT * FROM sfmc_coop_shop_groups') }); return; }
      if (method === 'POST') {
        const { group } = await body(req);
        if (!group?.groupid) { json(res, { success: false, error: 'groupid required' }, 400); return; }
        query('INSERT OR REPLACE INTO sfmc_coop_shop_groups (groupid, displayname, displaydescribe, icon, type_function) VALUES (?, ?, ?, ?, ?)',
          [group.groupid, group.displayname, group.displaydescribe || '', group.icon || '', group.type_function || '']);
        json(res, { success: true }); return;
      }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/areas (GET with module filter) ──────
    // ────── /api/sfmc/permissions ──────
    if (path === '/api/sfmc/permissions') {
      if (method === 'GET') { json(res, { permissions: query('SELECT * FROM sfmc_config_permissions') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/qa ──────
    if (path === '/api/sfmc/qa') {
      if (method === 'GET') {
        const questions = query(`SELECT q.*, 
          (SELECT json_group_array(json_object('id', r.id, 'type', r.type, 'amount', r.amount, 'item_type', r.item_type, 'item_aux', r.item_aux, 'cmd', r.cmd, 'min_rank', r.min_rank, 'max_rank', r.max_rank)) FROM sfmc_config_qa_rewards r WHERE r.question_id = q.id) as rewards,
          (SELECT json_group_array(json_object('id', p.id, 'type', p.type, 'cmd', p.cmd)) FROM sfmc_config_qa_punishments p WHERE p.question_id = q.id) as punishments
          FROM sfmc_config_qa_questions q ORDER BY q.id`);
        json(res, { questions });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/shop ──────
    if (path === '/api/sfmc/shop') {
      if (method === 'GET') {
        const categories = query('SELECT * FROM sfmc_config_shop_categories ORDER BY sort_order, id');
        const items = query('SELECT * FROM sfmc_config_shop_items');
        json(res, { categories, items });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/clean ──────
    if (path === '/api/sfmc/clean') {
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_config_clean WHERE id=1');
        json(res, { clean: rows.length > 0 ? rows[0] : null });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/banned_items ──────
    if (path === '/api/sfmc/banned_items') {
      if (method === 'GET') { json(res, { items: query('SELECT item_id FROM sfmc_config_banned_items') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/grids ──────
    if (path === '/api/sfmc/grids') {
      if (method === 'GET') { json(res, { grids: query('SELECT * FROM sfmc_config_grids') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/peace_filters ──────
    if (path === '/api/sfmc/peace_filters') {
      if (method === 'GET') { json(res, { filters: query('SELECT * FROM sfmc_config_peace_filters') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/monitor/* ──────
    // 内存存储，SAPI 按 30 秒间隔上报，Panel 按 3 秒拉取
    if (path === '/api/sfmc/monitor/metrics') {
      if (method === 'POST') {
        const data = await body(req);
        _monitorMetrics = { tps: data.tps || 0, entities: data.entities || {}, timestamp: Date.now() };
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }
    if (path === '/api/sfmc/monitor/player-chunks') {
      if (method === 'POST') {
        const data = await body(req);
        _monitorPlayers = (data.players || []).map(p => ({ ...p, timestamp: Date.now() }));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }
    if (path === '/api/sfmc/monitor/summary') {
      if (method === 'GET') {
        const now = Date.now();
        const stale = now - 60000; // 60 秒过期
        const metrics = _monitorMetrics && _monitorMetrics.timestamp > stale ? _monitorMetrics : null;
        const players = _monitorPlayers ? _monitorPlayers.filter(p => p.timestamp > stale) : [];
        const totalChunks = players.reduce((s, p) => s + (p.chunkEstimate || 0), 0);
        json(res, {
          tps: metrics ? metrics.tps : 0,
          entities: metrics ? metrics.entities : {},
          players,
          totalChunks,
          updatedAt: now,
        });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/db/* — DB 浏览（Panel 数据查看）──────
    if (path === '/api/sfmc/db/tables') {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      const result = tables.map(t => {
        const count = db.prepare(`SELECT COUNT(*) AS cnt FROM "${t.name}"`).get();
        return { name: t.name, rows: count.cnt };
      });
      json(res, { tables: result });
      return;
    }
    if (path.startsWith('/api/sfmc/db/table/')) {
      const tname = path.slice('/api/sfmc/db/table/'.length);
      if (!tname || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tname)) {
        json(res, { success: false, error: 'invalid table name' }, 400); return;
      }
      try {
        const columns = db.prepare(`PRAGMA table_info("${tname}")`).all();
        const rows = db.prepare(`SELECT * FROM "${tname}" LIMIT 20`).all();
        json(res, { columns, rows });
      } catch (e) { json(res, { success: false, error: e.message }, 500); }
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
    try { db.run(sql); } catch (err) { console.error('[Holoprint] 建表失败:', err.message); }
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
    console.log(`[DogeDB] 控制台输入 reload 重新导入 /configs/ JSON 配置`);
  });

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 'help') {
      console.log('DB Server 可用命令:');
      console.log('  help    — 显示本帮助');
      console.log('  status  — 显示服务状态');
      console.log('  reload  — 重新导入配置文件');
      console.log('  stop    — 停止服务');
    } else if (cmd === 'status') {
      const info = db ? db.prepare("PRAGMA database_list").all() : [];
      console.log(`[DogeDB] 状态: 运行中`);
      console.log(`  HTTP 端口: ${PORT}`);
      console.log(`  数据库: ${DB_PATH}`);
      console.log(`  QQ Bridge: ${QQ_BRIDGE_HOST}:${QQ_BRIDGE_PORT}`);
      if (_monitorMetrics) {
        console.log(`  TPS: ${_monitorMetrics.tps ?? '-'}`);
        console.log(`  实体数: ${_monitorMetrics.entityCount ?? '-'}`);
        console.log(`  在线玩家: ${_monitorPlayers?.length ?? '-'}`);
      }
    } else if (cmd === 'reload') {
      reloadConfigsFromJson();
    } else if (cmd === 'stop') {
      console.log('[DogeDB] 正在停止服务...');
      rl.close();
      server.close();
      if (db) db.close();
      process.exit(0);
    } else {
      console.log(`[DogeDB] 未知命令: ${cmd}，输入 help 查看帮助`);
    }
  });
  rl.on('SIGINT', () => process.exit());

  process.on('exit', () => {
    if (db) db.close();
  });
}

start().catch(err => {
  console.error('[DogeDB] 启动失败:', err);
  process.exit(1);
});
