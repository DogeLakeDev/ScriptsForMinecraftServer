import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';
import path from 'path';

const CFG_PATH = path.join(path.dirname(process.argv[1]), '..', 'configs', 'panel_config.json');

function readMode() {
  try {
    const raw = require('fs').readFileSync(CFG_PATH, 'utf-8');
    return JSON.parse(raw).db_view_mode || 'http';
  } catch { return 'http'; }
}

const DB_HOST = '127.0.0.1';
const DB_PORT = 3001;

function DbView({ logH, logW }) {
  const [mode] = useState(readMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [tableView, setTableView] = useState(null); // { name, columns, rows } or null

  useEffect(() => {
    loadTables();
  }, []);

  function loadTables() {
    setLoading(true); setError(null); setTableView(null);
    if (mode === 'http') {
      fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/db/tables`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => { setTables(d.tables || []); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    } else {
      try {
        const path = require('path');
        const dbDir = path.join(__dirname, '..', 'db-server');
        const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
        const db = new Database(path.join(dbDir, 'sfmc_data.db'));
        const list = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        const result = list.map(t => {
          const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM "' + t.name + '"').get();
          return { name: t.name, rows: cnt.cnt };
        });
        db.close();
        setTables(result); setLoading(false);
      } catch (e) {
        setError('直连模式需要 better-sqlite3\n请运行: npm install better-sqlite3\n' + e.message);
        setLoading(false);
      }
    }
  }

  function loadTable(name) {
    setLoading(true); setError(null);
    if (mode === 'http') {
      fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/db/table/${encodeURIComponent(name)}`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => { setTableView({ name, columns: d.columns || [], rows: d.rows || [] }); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    } else {
      try {
        const path = require('path');
        const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
        const dbDir = path.join(__dirname, '..', 'db-server');
        const db = new Database(path.join(dbDir, 'sfmc_data.db'));
        const columns = db.prepare('PRAGMA table_info("' + name + '")').all();
        const rows = db.prepare('SELECT * FROM "' + name + '" LIMIT 20').all();
        db.close();
        setTableView({ name, columns, rows }); setLoading(false);
      } catch (e) {
        setError(e.message); setLoading(false);
      }
    }
  }

  const maxItems = Math.max(3, logH + 4);

  useInput((input, key) => {
    if (loading) return;
    if (key.escape) {
      if (tableView) { setTableView(null); return; }
      return;
    }
    if (tableView) {
      if (key.upArrow || key.downArrow) return;
      if (input === 'b') { setTableView(null); return; }
      return;
    }
    if (key.upArrow || key.downArrow) return;
    if (input === 'r') { loadTables(); return; }
    const n = parseInt(input, 10);
    if (n >= 1 && n <= tables.length) { loadTable(tables[n - 1].name); }
  });

  if (loading) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { color: T.muted }, '正在加载数据库表清单...'),
    );
  }

  if (error) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { color: T.error }, `错误: ${error}`),
      h(Text, { color: T.muted }, '按 r 重新加载'),
    );
  }

  if (tableView) {
    const cols = tableView.columns;
    const rows = tableView.rows;
    const colNames = cols.map(c => c.name || c.cid);
    const startIdx = 0;
    const visible = rows.slice(startIdx, startIdx + maxItems);

    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { bold: true, color: T.primary }, `📋 ${tableView.name} (${rows.length} 行)`),
      h(Text, { color: T.muted }, `列: ${colNames.join(', ')}`),
      rows.length === 0
        ? h(Text, { color: T.muted }, '(空表)')
        : h(Box, { flexDirection: 'column' },
            ...visible.map((row, i) => {
              const vals = colNames.map(c => {
                const v = row[c];
                if (v === null || v === undefined) return 'NULL';
                const s = String(v);
                return s.length > logW ? s.slice(0, logW) : s;
              });
              return h(Text, { key: i, color: T.text },
                `  ${startIdx + i + 1}. ${vals.join(' | ')}`);
            }),
          ),
      h(Text, { color: T.muted, marginTop: 1 }, 'b:返回  Esc:返回'),
    );
  }

  const startIdx = 0;
  const visible = tables.slice(startIdx, startIdx + maxItems);

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { bold: true, color: T.primary },
      `🗄️ 数据库 (${tables.length} 表)  模式: ${mode === 'http' ? 'HTTP' : '直连'}`),
    h(Text, { color: T.muted }, '输入编号查看表数据  r:刷新'),
    ...visible.map((t, i) =>
      h(Text, { key: t.name, color: T.text },
        `  ${startIdx + i + 1}. ${t.name}  (${t.rows} 行)`),
    ),
  );
}

export { DbView };
