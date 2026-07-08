/**
 * Holoprint Router — 全息投影 API 路由模块
 *
 * 为 db-server 提供 /api/hpbe/* 端点的路由处理。
 * 由于 db-server 使用原生 http 模块，本模块采用函数式路由，
 * 通过包装原始 handler 来实现请求拦截和分发。
 */

const { parseMcStructure } = require('./nbtParser');

// ---------- DDL ----------

/**
 * 返回 Holoprint 相关的建表 SQL 语句数组
 */
function getHoloprintDDL() {
  return [
    `
    CREATE TABLE IF NOT EXISTS hpbe_projections (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      owner_id        TEXT NOT NULL,
      visibility      TEXT NOT NULL DEFAULT 'private',
      structure_data  TEXT NOT NULL DEFAULT '',
      size_x          INTEGER NOT NULL DEFAULT 0,
      size_y          INTEGER NOT NULL DEFAULT 0,
      size_z          INTEGER NOT NULL DEFAULT 0,
      palette         TEXT NOT NULL DEFAULT '[]',
      blocks          TEXT NOT NULL DEFAULT '[]',
      block_entities  TEXT NOT NULL DEFAULT '[]',
      scale           REAL NOT NULL DEFAULT 1.0,
      opacity         REAL NOT NULL DEFAULT 1.0,
      offset_x        REAL NOT NULL DEFAULT 0.0,
      offset_y        REAL NOT NULL DEFAULT 0.0,
      offset_z        REAL NOT NULL DEFAULT 0.0,
      rotation        INTEGER NOT NULL DEFAULT 0,
      dimension       TEXT NOT NULL DEFAULT 'overworld',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS hpbe_pack_meta (
      id                INTEGER PRIMARY KEY DEFAULT 1,
      pack_version      INTEGER NOT NULL DEFAULT 1,
      last_generated_at INTEGER
    );
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_hpbe_projections_owner 
      ON hpbe_projections(owner_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_hpbe_projections_visibility 
      ON hpbe_projections(visibility);
    `,
  ];
}

// ---------- 工具函数 ----------

/**
 * 生成 UUID v4
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * 尝试解析请求 body 中的 base64 结构数据
 */
function parseStructureFromBody(bodyData) {
  if (!bodyData) return null;

  // 如果直接提供了 buffer / base64
  let buffer = null;

  if (bodyData.buffer && typeof bodyData.buffer === 'string') {
    // base64 编码的 buffer
    buffer = Buffer.from(bodyData.buffer, 'base64');
  } else if (bodyData.base64 && typeof bodyData.base64 === 'string') {
    buffer = Buffer.from(bodyData.base64, 'base64');
  } else if (bodyData.structureData && typeof bodyData.structureData === 'string') {
    buffer = Buffer.from(bodyData.structureData, 'base64');
  }

  if (!buffer) return null;

  return parseMcStructure(buffer);
}

// ---------- 路由处理 ----------

/**
 * 注册 Holoprint API 路由到请求处理链中
 *
 * @param {Function} handleRouter - 原始的请求处理函数 (req, res) => void
 * @param {Object}   db           - better-sqlite3 数据库实例
 * @param {Function} query        - SQL 查询函数 (sql, params) => rows | { changes }
 * @param {Function} body         - 请求体解析函数 (req) => Promise<Object>
 * @param {Function} json         - JSON 响应函数 (res, data, status) => void
 * @returns {Function} 新的请求处理函数，可直接用于 http.createServer()
 */
function registerHoloprintRoutes(handleRouter, db, query, body, json) {
  // 初始化 Holoprint 表
  const ddl = getHoloprintDDL();
  for (const sql of ddl) {
    try {
      db.exec(sql);
    } catch (err) {
      console.error('[Holoprint] 建表失败:', err.message);
    }
  }

  // 确保 hpbe_pack_meta 有初始行
  const existing = query('SELECT id FROM hpbe_pack_meta WHERE id = 1');
  if (existing.length === 0) {
    query('INSERT INTO hpbe_pack_meta (id, pack_version, last_generated_at) VALUES (1, 1, NULL)');
  }

  /**
   * 统一请求处理入口
   */
  return async function holoprintHandler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method;
    const params = url.searchParams;

    // —— 只拦截 /api/hpbe/* 路径，其余交由原始 handler ——
    if (!path.startsWith('/api/hpbe/') && path !== '/api/hpbe') {
      return handleRouter(req, res);
    }

    try {
      // ========== POST /api/hpbe/upload ==========
      if (method === 'POST' && path === '/api/hpbe/upload') {
        const reqBody = await body(req);

        // 解析结构数据
        let parsed;
        try {
          parsed = parseStructureFromBody(reqBody);
        } catch (parseErr) {
          json(res, { success: false, error: '解析结构文件失败: ' + parseErr.message }, 400);
          return;
        }

        if (!parsed) {
          json(res, { success: false, error: '缺少有效的结构数据 (base64/buffer/structureData)' }, 400);
          return;
        }

        const id = uuid();
        const now = Date.now();
        const name = reqBody.name || `projection_${id.slice(0, 8)}`;
        const ownerId = reqBody.ownerId || reqBody.owner_id || 'unknown';
        const visibility = reqBody.visibility || 'private';
        const scale = reqBody.scale ?? 1.0;
        const opacity = reqBody.opacity ?? 1.0;
        const offsetX = reqBody.offsetX ?? reqBody.offset_x ?? 0;
        const offsetY = reqBody.offsetY ?? reqBody.offset_y ?? 0;
        const offsetZ = reqBody.offsetZ ?? reqBody.offset_z ?? 0;
        const rotation = reqBody.rotation ?? 0;
        const dimension = reqBody.dimension || 'overworld';

        // 存储原始 base64 数据
        const structureData = reqBody.base64 || reqBody.buffer || reqBody.structureData || '';

        query(
          `INSERT INTO hpbe_projections (
            id, name, owner_id, visibility, structure_data,
            size_x, size_y, size_z, palette, blocks, block_entities,
            scale, opacity, offset_x, offset_y, offset_z, rotation, dimension,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, name, ownerId, visibility, structureData,
            parsed.size.x, parsed.size.y, parsed.size.z,
            JSON.stringify(parsed.palette),
            JSON.stringify(parsed.blocks),
            JSON.stringify(parsed.block_entities),
            scale, opacity, offsetX, offsetY, offsetZ, rotation, dimension,
            now, now,
          ]
        );

        // 更新 pack 版本
        query('UPDATE hpbe_pack_meta SET pack_version = pack_version + 1, last_generated_at = ? WHERE id = 1', [now]);

        json(res, {
          success: true,
          projection: {
            id,
            name,
            size: parsed.size,
            palette_count: parsed.palette.length,
            block_count: parsed.blocks.length,
          },
        });
        return;
      }

      // ========== GET /api/hpbe/projections ==========
      if (method === 'GET' && path === '/api/hpbe/projections') {
        let sql = 'SELECT * FROM hpbe_projections WHERE 1=1';
        const values = [];

        const ownerId = params.get('owner_id');
        if (ownerId) {
          sql += ' AND owner_id = ?';
          values.push(ownerId);
        }

        const visibility = params.get('visibility');
        if (visibility) {
          sql += ' AND visibility = ?';
          values.push(visibility);
        }

        sql += ' ORDER BY created_at DESC';

        const rows = query(sql, values);
        json(res, { projections: rows });
        return;
      }

      // ========== GET /api/hpbe/projections/:id ==========
      if (method === 'GET' && path.startsWith('/api/hpbe/projections/')) {
        const id = path.slice('/api/hpbe/projections/'.length);
        if (!id) {
          json(res, { success: false, error: '缺少 projection ID' }, 400);
          return;
        }

        const rows = query('SELECT * FROM hpbe_projections WHERE id = ?', [id]);
        if (rows.length === 0) {
          json(res, { success: false, error: '未找到该投影' }, 404);
          return;
        }

        json(res, { projection: rows[0] });
        return;
      }

      // ========== PUT /api/hpbe/projections/:id ==========
      if (method === 'PUT' && path.startsWith('/api/hpbe/projections/')) {
        const id = path.slice('/api/hpbe/projections/'.length);
        if (!id) {
          json(res, { success: false, error: '缺少 projection ID' }, 400);
          return;
        }

        // 检查是否存在
        const existing = query('SELECT id FROM hpbe_projections WHERE id = ?', [id]);
        if (existing.length === 0) {
          json(res, { success: false, error: '未找到该投影' }, 404);
          return;
        }

        const reqBody = await body(req);
        const now = Date.now();

        // 构建动态 UPDATE
        const allowedFields = {
          name: 'name',
          visibility: 'visibility',
          scale: 'scale',
          opacity: 'opacity',
          offsetX: 'offset_x',
          offset_x: 'offset_x',
          offsetY: 'offset_y',
          offset_y: 'offset_y',
          offsetZ: 'offset_z',
          offset_z: 'offset_z',
          rotation: 'rotation',
          dimension: 'dimension',
        };

        const sets = [];
        const vals = [];
        for (const [jsField, dbCol] of Object.entries(allowedFields)) {
          if (reqBody[jsField] !== undefined) {
            sets.push(`${dbCol}=?`);
            vals.push(reqBody[jsField]);
          }
        }

        if (sets.length === 0) {
          json(res, { success: false, error: '没有提供可更新的字段' }, 400);
          return;
        }

        sets.push('updated_at=?');
        vals.push(now);
        vals.push(id);

        query(`UPDATE hpbe_projections SET ${sets.join(', ')} WHERE id=?`, vals);
        json(res, { success: true });
        return;
      }

      // ========== DELETE /api/hpbe/projections/:id ==========
      if (method === 'DELETE' && path.startsWith('/api/hpbe/projections/')) {
        const id = path.slice('/api/hpbe/projections/'.length);
        if (!id) {
          json(res, { success: false, error: '缺少 projection ID' }, 400);
          return;
        }

        const info = query('DELETE FROM hpbe_projections WHERE id = ?', [id]);
        if (info.changes === 0) {
          json(res, { success: false, error: '未找到该投影' }, 404);
          return;
        }

        json(res, { success: true });
        return;
      }

      // ========== POST /api/hpbe/generate ==========
      if (method === 'POST' && path === '/api/hpbe/generate') {
        const now = Date.now();
        query('UPDATE hpbe_pack_meta SET pack_version = pack_version + 1, last_generated_at = ? WHERE id = 1', [now]);

        const meta = query('SELECT pack_version, last_generated_at FROM hpbe_pack_meta WHERE id = 1');
        json(res, {
          success: true,
          pack_version: meta[0]?.pack_version || 1,
          last_generated_at: now,
        });
        return;
      }

      // ========== GET /api/hpbe/pack-version ==========
      if (method === 'GET' && path === '/api/hpbe/pack-version') {
        const rows = query('SELECT pack_version, last_generated_at FROM hpbe_pack_meta WHERE id = 1');
        if (rows.length === 0) {
          json(res, { pack_version: 1, last_generated_at: null });
          return;
        }
        json(res, { pack_version: rows[0].pack_version, last_generated_at: rows[0].last_generated_at });
        return;
      }

      // ========== GET /api/hpbe/materials/:id ==========
      if (method === 'GET' && path.startsWith('/api/hpbe/materials/')) {
        const id = path.slice('/api/hpbe/materials/'.length);
        if (!id) {
          json(res, { success: false, error: '缺少 projection ID' }, 400);
          return;
        }

        const rows = query('SELECT palette, blocks FROM hpbe_projections WHERE id = ?', [id]);
        if (rows.length === 0) {
          json(res, { success: false, error: '未找到该投影' }, 404);
          return;
        }

        let palette;
        let blocks;
        try {
          palette = typeof rows[0].palette === 'string' ? JSON.parse(rows[0].palette) : rows[0].palette;
          blocks = typeof rows[0].blocks === 'string' ? JSON.parse(rows[0].blocks) : rows[0].blocks;
        } catch (parseErr) {
          json(res, { success: false, error: '解析 palette/blocks 数据失败' }, 500);
          return;
        }

        if (!Array.isArray(palette) || !Array.isArray(blocks)) {
          json(res, { success: false, error: '投影数据格式异常' }, 500);
          return;
        }

        // 统计每种 palette 索引的出现次数
        const countMap = {};
        for (const block of blocks) {
          const idx = block.palette_index;
          countMap[idx] = (countMap[idx] || 0) + 1;
        }

        // 组装材料列表
        const materials = palette.map((entry, index) => ({
          name: entry.name || 'unknown',
          states: entry.states || {},
          count: countMap[index] || 0,
          palette_index: index,
        }));

        json(res, { materials });
        return;
      }

      // ========== 未匹配的 /api/hpbe/* ==========
      json(res, { success: false, error: 'not_found' }, 404);
    } catch (err) {
      console.error('[Holoprint] 错误:', err);
      json(res, { success: false, error: err.message }, 500);
    }
  };
}

module.exports = { registerHoloprintRoutes, getHoloprintDDL };
