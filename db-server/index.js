/**
 * DogeChat 数据库服务 — HTTP REST API
 * SQLite (sql.js) + Node.js http
 *
 * 启动：node index.js
 * 端口：3001（可通过环境变量 DB_PORT 修改）
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const PORT = parseInt(process.env.DB_PORT || '3001', 10);
const DB_PATH = path.join(__dirname, 'doge_chat.db');

let db;

// ---------- 数据库初始化 ----------

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sfmc_chat_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      from_xuid TEXT NOT NULL,
      from_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      attachment TEXT,
      show_timestamp INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON sfmc_chat_messages(channel_id, created_at ASC)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sfmc_chat_redpackets (
      id TEXT PRIMARY KEY,
      sender_xuid TEXT NOT NULL,
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
    )
  `);

  // 计分板同步表（全量覆盖）
  db.run(`
    CREATE TABLE IF NOT EXISTS sfmc_scoreboards (
      objective_id      TEXT NOT NULL,
      objective_display TEXT NOT NULL DEFAULT '',
      participant_id    INTEGER NOT NULL,
      participant_type  TEXT NOT NULL,
      participant_name  TEXT NOT NULL DEFAULT '',
      xuid              TEXT DEFAULT '',
      score             INTEGER NOT NULL DEFAULT 0,
      updated_at        INTEGER NOT NULL,
      PRIMARY KEY (objective_id, participant_id, participant_type)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_sb_participant ON sfmc_scoreboards(participant_type, xuid)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_sb_updated ON sfmc_scoreboards(updated_at)`);

  // 行为日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS sfmc_activities (
      id              TEXT PRIMARY KEY,
      timestamp       INTEGER NOT NULL,
      dimension       TEXT NOT NULL DEFAULT '',
      source_type     TEXT NOT NULL,
      source_xuid     TEXT DEFAULT '',
      source_name     TEXT NOT NULL DEFAULT '',
      source_x        REAL,
      source_y        REAL,
      source_z        REAL,
      event_type      TEXT NOT NULL,
      target_type     TEXT DEFAULT '',
      target_xuid     TEXT DEFAULT '',
      target_name     TEXT DEFAULT '',
      target_x        REAL,
      target_y        REAL,
      target_z        REAL,
      detail          TEXT DEFAULT '{}',
      created_at      INTEGER NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_act_source ON sfmc_activities(source_xuid, timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_act_event ON sfmc_activities(event_type, timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_act_time ON sfmc_activities(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sfmc_act_target ON sfmc_activities(target_xuid, event_type)`);

  // 通用 KV 存储（暂时性数据迁移 待弃用）
  db.run(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  saveDB();
  console.log('[DogeDB] 数据库已就绪');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 每 30 秒保存一次（防止写操作丢数据）
setInterval(saveDB, 30000);

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
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } else {
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDB(); // 写操作后保存
    return { changes: db.getRowsModified() };
  }
}

// ---------- 路由 ----------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method;

  try {
    // ---- 消息历史 ----

    if (method === 'POST' && path === '/api/messages/save') {
      const { channelId, message } = await body(req);
      if (!channelId || !message?.id) { json(res, { success: false, error: 'invalid' }, 400); return; }
      query(`INSERT OR REPLACE INTO sfmc_chat_messages (id, channel_id, from_xuid, from_name, type, content, attachment, show_timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        message.id, channelId, message.fromXuid, message.fromName,
        message.type || 'text', message.content, message.attachment || null,
        message.showTimestamp ? 1 : 0, message.timestamp
      ]);
      json(res, { success: true });
      return;
    }

    if (method === 'GET' && path.startsWith('/api/messages/')) {
      const channelId = path.slice('/api/messages/'.length);
      const cutoff = parseInt(url.searchParams.get('cutoff') || '0', 10);
      const rows = query(`SELECT * FROM sfmc_chat_messages WHERE channel_id = ? AND created_at >= ? ORDER BY created_at ASC`, [channelId, cutoff]);
      json(res, {
        messages: rows.map(r => ({
          id: r.id, fromXuid: r.from_xuid, fromName: r.from_name,
          channelId: r.channel_id, type: r.type, content: r.content,
          attachment: r.attachment, showTimestamp: !!r.show_timestamp, timestamp: r.created_at,
        }))
      });
      return;
    }

    if (method === 'DELETE' && path.startsWith('/api/messages/')) {
      const channelId = path.slice('/api/messages/'.length);
      query('DELETE FROM sfmc_chat_messages WHERE channel_id = ?', [channelId]);
      json(res, { success: true });
      return;
    }

    if (method === 'POST' && path === '/api/messages/cleanup') {
      const { channels } = await body(req);
      if (channels && Array.isArray(channels)) {
        for (const c of channels) {
          query('DELETE FROM sfmc_chat_messages WHERE channel_id = ? AND created_at < ?', [c.channelId, Date.now() - c.retention]);
        }
      }
      json(res, { success: true });
      return;
    }

    // ---- 红包 ----

    if (method === 'POST' && path === '/api/redpackets/save') {
      const rp = (await body(req)).redpacket;
      if (!rp?.id) { json(res, { success: false, error: 'invalid' }, 400); return; }
      query(`INSERT OR REPLACE INTO sfmc_chat_redpackets (id, sender_xuid, sender_name, total_amount, remaining_amount, total_count, remaining_count, receivers, target_type, target_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        rp.id, rp.senderXuid, rp.senderName, rp.totalAmount, rp.remainingAmount,
        rp.totalCount, rp.remainingCount, JSON.stringify(rp.receivers),
        rp.targetType, rp.targetId, rp.createdAt, rp.expiresAt
      ]);
      json(res, { success: true });
      return;
    }

    if (method === 'POST' && path === '/api/redpackets/update') {
      const rp = (await body(req)).redpacket;
      if (!rp?.id) { json(res, { success: false, error: 'invalid' }, 400); return; }
      query(`UPDATE sfmc_chat_redpackets SET remaining_amount=?, remaining_count=?, receivers=? WHERE id=?`, [
        rp.remainingAmount, rp.remainingCount, JSON.stringify(rp.receivers), rp.id
      ]);
      json(res, { success: true });
      return;
    }

    if (method === 'GET' && path === '/api/redpackets') {
      const rows = query(`SELECT * FROM sfmc_chat_redpackets WHERE remaining_count > 0 AND expires_at > ? ORDER BY created_at DESC`, [Date.now()]);
      json(res, {
        redpackets: rows.map(r => ({
          id: r.id, senderXuid: r.sender_xuid, senderName: r.sender_name,
          totalAmount: r.total_amount, remainingAmount: r.remaining_amount,
          totalCount: r.total_count, remainingCount: r.remaining_count,
          receivers: JSON.parse(r.receivers), targetType: r.target_type,
          targetId: r.target_id, createdAt: r.created_at, expiresAt: r.expires_at,
        }))
      });
      return;
    }

    if (method === 'GET' && path.startsWith('/api/redpackets/') && path !== '/api/redpackets') {
      const packetId = path.slice('/api/redpackets/'.length);
      const rows = query('SELECT * FROM sfmc_chat_redpackets WHERE id = ?', [packetId]);
      if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
      const r = rows[0];
      json(res, {
        redpacket: {
          id: r.id, senderXuid: r.sender_xuid, senderName: r.sender_name,
          totalAmount: r.total_amount, remainingAmount: r.remaining_amount,
          totalCount: r.total_count, remainingCount: r.remaining_count,
          receivers: JSON.parse(r.receivers), targetType: r.target_type,
          targetId: r.target_id, createdAt: r.created_at, expiresAt: r.expires_at,
        }
      });
      return;
    }

    if (method === 'POST' && path === '/api/cleanup-expired-rp') {
      query('DELETE FROM sfmc_chat_redpackets WHERE expires_at <= ?', [Date.now()]);
      json(res, { success: true });
      return;
    }

    // ---- 通用 KV 存储 ----

    // GET /api/kv/:key
    if (method === 'GET' && path.startsWith('/api/kv/')) {
      const key = path.slice('/api/kv/'.length);
      const rows = query('SELECT value FROM kv_store WHERE key = ?', [key]);
      json(res, { value: rows.length > 0 ? rows[0].value : null });
      return;
    }

    // POST /api/kv/save
    if (method === 'POST' && path === '/api/kv/save') {
      const { key, value } = await body(req);
      if (!key) { json(res, { success: false, error: 'invalid' }, 400); return; }
      query('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', [key, value]);
      json(res, { success: true });
      return;
    }

    // DELETE /api/kv/:key
    if (method === 'DELETE' && path.startsWith('/api/kv/')) {
      const key = path.slice('/api/kv/'.length);
      query('DELETE FROM kv_store WHERE key = ?', [key]);
      json(res, { success: true });
      return;
    }

    // ---- 全部 KV 获取（启动时加载用） ----

    if (method === 'GET' && path === '/api/kv') {
      const rows = query('SELECT key, value FROM kv_store');
      json(res, { kv: rows });
      return;
    }

    // ---- 计分板同步（sfmc） ----

    // POST /api/sfmc/scoreboards/sync — 全量同步覆盖
    if (method === 'POST' && path === '/api/sfmc/scoreboards/sync') {
      const { entries } = await body(req);
      if (!entries || !Array.isArray(entries)) {
        json(res, { success: false, error: 'entries array required' }, 400);
        return;
      }
      const now = Date.now();
      query('DELETE FROM sfmc_scoreboards');
      const insert = `INSERT INTO sfmc_scoreboards (objective_id, objective_display, participant_id, participant_type, participant_name, xuid, score, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const e of entries) {
        query(insert, [
          e.objectiveId, e.objectiveDisplay || '',
          e.participantId, e.participantType, e.participantName || '',
          e.xuid || '', e.score ?? 0, now
        ]);
      }
      json(res, { success: true, count: entries.length });
      return;
    }

    // GET /api/sfmc/scoreboards/objectives — 列出所有记分项
    if (method === 'GET' && path === '/api/sfmc/scoreboards/objectives') {
      const rows = query(`SELECT DISTINCT objective_id, objective_display FROM sfmc_scoreboards ORDER BY objective_id`);
      json(res, { objectives: rows });
      return;
    }

    // GET /api/sfmc/scoreboards — 查询分数，支持过滤
    if (method === 'GET' && path === '/api/sfmc/scoreboards') {
      const filterObjective = url.searchParams.get('objective') || '';
      const filterName = url.searchParams.get('name') || '';
      const filterXuid = url.searchParams.get('xuid') || '';
      let sql = 'SELECT * FROM sfmc_scoreboards WHERE 1=1';
      const params = [];
      if (filterObjective) { sql += ' AND objective_id = ?'; params.push(filterObjective); }
      if (filterName) { sql += ' AND participant_name = ?'; params.push(filterName); }
      if (filterXuid) { sql += ' AND xuid = ?'; params.push(filterXuid); }
      sql += ' ORDER BY objective_id, participant_name';
      const rows = query(sql, params);
      json(res, { entries: rows });
      return;
    }

    // DELETE /api/sfmc/scoreboards — 清空所有计分板数据
    if (method === 'DELETE' && path === '/api/sfmc/scoreboards') {
      query('DELETE FROM sfmc_scoreboards');
      json(res, { success: true });
      return;
    }

    // ---- 行为日志（sfmc_activities） ----

    // POST /api/sfmc/activities/batch — 批量写入日志
    if (method === 'POST' && path === '/api/sfmc/activities/batch') {
      const { entries } = await body(req);
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        json(res, { success: false, error: 'entries array required' }, 400);
        return;
      }
      const now = Date.now();
      const insert = `INSERT OR IGNORE INTO sfmc_activities (id, timestamp, dimension, source_type, source_xuid, source_name, source_x, source_y, source_z, event_type, target_type, target_xuid, target_name, target_x, target_y, target_z, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const e of entries) {
        query(insert, [
          e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`,
          e.timestamp || now, e.dimension || '',
          e.sourceType || 'unknown', e.sourceXuid || '', e.sourceName || '',
          e.sourceX ?? null, e.sourceY ?? null, e.sourceZ ?? null,
          e.eventType || 'unknown',
          e.targetType || '', e.targetXuid || '', e.targetName || '',
          e.targetX ?? null, e.targetY ?? null, e.targetZ ?? null,
          typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail || {}),
          now
        ]);
      }
      json(res, { success: true, count: entries.length });
      return;
    }

    // GET /api/sfmc/activities — 查询日志，支持过滤
    if (method === 'GET' && path === '/api/sfmc/activities') {
      const xuid = url.searchParams.get('xuid') || '';
      const event = url.searchParams.get('event') || '';
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const sourceName = url.searchParams.get('name') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 1000);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      let sql = 'SELECT * FROM sfmc_activities WHERE 1=1';
      const params = [];
      if (xuid) { sql += ' AND source_xuid = ?'; params.push(xuid); }
      if (event) { sql += ' AND event_type = ?'; params.push(event); }
      if (from) { sql += ' AND timestamp >= ?'; params.push(parseInt(from)); }
      if (to) { sql += ' AND timestamp <= ?'; params.push(parseInt(to)); }
      if (sourceName) { sql += ' AND source_name = ?'; params.push(sourceName); }
      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      const rows = query(sql, params);
      json(res, { entries: rows, count: rows.length, limit, offset });
      return;
    }

    // GET /api/sfmc/activities/stats — 统计
    if (method === 'GET' && path === '/api/sfmc/activities/stats') {
      const xuid = url.searchParams.get('xuid') || '';
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      let cond = 'WHERE 1=1';
      const params = [];
      if (xuid) { cond += ' AND source_xuid = ?'; params.push(xuid); }
      if (from) { cond += ' AND timestamp >= ?'; params.push(parseInt(from)); }
      if (to) { cond += ' AND timestamp <= ?'; params.push(parseInt(to)); }
      const totalRow = query(`SELECT COUNT(*) as total FROM sfmc_activities ${cond}`, params);
      const byEvent = query(`SELECT event_type, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY event_type ORDER BY count DESC`, params);
      const byDate = query(`SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY date ORDER BY date DESC LIMIT 30`, params);
      json(res, { total: totalRow[0]?.total || 0, byEvent, byDate });
      return;
    }

    // POST /api/sfmc/activities/cleanup — 按保留策略清理
    if (method === 'POST' && path === '/api/sfmc/activities/cleanup') {
      const { keepDays = 30, keepAdmin = true } = await body(req);
      const cutoff = Date.now() - keepDays * 86400000;
      let deleted = 0;
      if (keepAdmin) {
        const r = query('DELETE FROM sfmc_activities WHERE timestamp < ? AND event_type NOT LIKE ?', [cutoff, 'admin.%']);
        deleted = r.changes || 0;
      } else {
        const r = query('DELETE FROM sfmc_activities WHERE timestamp < ?', [cutoff]);
        deleted = r.changes || 0;
      }
      json(res, { success: true, deleted });
      return;
    }

    // ---- 健康检查 ----

    if (method === 'GET' && path === '/api/health') {
      json(res, { status: 'ok', uptime: process.uptime() });
      return;
    }

    json(res, { success: false, error: 'not_found' }, 404);
  } catch (err) {
    console.error('[DogeDB] 错误:', err);
    json(res, { success: false, error: err.message }, 500);
  }
}

// ---------- 启动 ----------

async function start() {
  await initDB();

  const server = http.createServer(handle);

  // 每分钟清理过期红包
  setInterval(() => {
    try {
      query('DELETE FROM sfmc_chat_redpackets WHERE expires_at <= ?', [Date.now()]);
    } catch {}
  }, 60000);

  server.listen(PORT, () => {
    console.log(`[DogeDB] HTTP 服务已启动，端口 ${PORT}`);
    console.log(`[DogeDB] API 健康检查: http://127.0.0.1:${PORT}/api/health`);
  });
}

start().catch(err => {
  console.error('[DogeDB] 启动失败:', err);
  process.exit(1);
});
