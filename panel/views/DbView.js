import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getJson } from '../api/client.js';
import { SectionTitle, StatusLine } from '../ui/Feedback.js';
import { useMonitor } from '../monitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CFG_PATH = path.join(ROOT_DIR, 'configs', 'panel_config.json');
const requireDb = createRequire(path.join(ROOT_DIR, 'db-server', 'package.json'));

function readMode() {
  try {
    const raw = fs.readFileSync(CFG_PATH, 'utf-8');
    return JSON.parse(raw).db_view_mode || 'http';
  } catch { return 'http'; }
}

function readDbPath() {
  try {
    const configured = JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8')).db_path;
    return configured ? path.resolve(configured) : path.join(ROOT_DIR, 'db-server', 'sfmc_data.db');
  } catch {
    return path.join(ROOT_DIR, 'db-server', 'sfmc_data.db');
  }
}

function DbView({ logH, logW, inputActive = true }) {
  const monitor = useMonitor();
  const [mode] = useState(readMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [tableView, setTableView] = useState(null); // { name, columns, rows } or null
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    loadTables();
  }, []);

  function loadTables() {
    setLoading(true); setError(null); setTableView(null); setScroll(0);
    if (mode === 'http') {
      getJson('/api/sfmc/db/tables')
        .then(d => { setTables(d.tables || []); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    } else {
      try {
        const Database = requireDb('better-sqlite3');
        const db = new Database(readDbPath(), { readonly: true });
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
    setLoading(true); setError(null); setScroll(0);
    if (mode === 'http') {
      getJson(`/api/sfmc/db/table/${encodeURIComponent(name)}`)
        .then(d => { setTableView({ name, columns: d.columns || [], rows: d.rows || [] }); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    } else {
      try {
        const Database = requireDb('better-sqlite3');
        const db = new Database(readDbPath(), { readonly: true });
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
  const pageSize = Math.max(1, maxItems - 1);

  useInput((input, key) => {
    if (loading) return;
    if (key.escape) {
      if (tableView) { setTableView(null); return; }
      return;
    }
    if (tableView) {
      if (key.upArrow) { setScroll((s) => Math.max(0, s - 1)); return; }
      if (key.downArrow) { setScroll((s) => Math.min(Math.max(0, tableView.rows.length - maxItems), s + 1)); return; }
      if (key.pageUp) { setScroll((s) => Math.max(0, s - pageSize)); return; }
      if (key.pageDown) { setScroll((s) => Math.min(Math.max(0, tableView.rows.length - maxItems), s + pageSize)); return; }
      if (key.home) { setScroll(0); return; }
      if (key.end) { setScroll(Math.max(0, tableView.rows.length - maxItems)); return; }
      if (input === 'b') { setTableView(null); return; }
      return;
    }
    if (key.upArrow) { setScroll((s) => Math.max(0, s - 1)); return; }
    if (key.downArrow) { setScroll((s) => Math.min(Math.max(0, tables.length - maxItems), s + 1)); return; }
    if (key.pageUp) { setScroll((s) => Math.max(0, s - pageSize)); return; }
    if (key.pageDown) { setScroll((s) => Math.min(Math.max(0, tables.length - maxItems), s + pageSize)); return; }
    if (key.home) { setScroll(0); return; }
    if (key.end) { setScroll(Math.max(0, tables.length - maxItems)); return; }
    if (input === 'r') { loadTables(); return; }
    const n = parseInt(input, 10);
    if (n >= 1 && n <= tables.length) { loadTable(tables[n - 1].name); }
  }, { isActive: inputActive });

  if (loading) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(SectionTitle, { detail: '运行数据与持久化表' }, '数据中心'),
      monitor && h(Text, { color: T.muted }, `在线玩家 ${monitor.players.length}  | TPS ${monitor.tps > 0 ? monitor.tps.toFixed(1) : 'N/A'}  | 实体 ${Object.values(monitor.entities).reduce((sum, value) => sum + (value || 0), 0)}  | 区块 ${monitor.totalChunks}`),
      h(StatusLine, { kind: 'loading' }, '正在加载数据库表清单...'),
    );
  }

  if (error) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(SectionTitle, { detail: '运行数据与持久化表' }, '数据中心'),
      monitor && h(Text, { color: T.muted }, `在线玩家 ${monitor.players.length}  | TPS ${monitor.tps > 0 ? monitor.tps.toFixed(1) : 'N/A'}  | 实体 ${Object.values(monitor.entities).reduce((sum, value) => sum + (value || 0), 0)}  | 区块 ${monitor.totalChunks}`),
      h(StatusLine, { kind: 'error' }, `无法加载数据库: ${error}`),
      h(Text, { color: T.muted }, '按 r 重新加载'),
    );
  }

  if (tableView) {
    const cols = tableView.columns;
    const rows = tableView.rows;
    const colNames = cols.map(c => c.name || c.cid);
    const startIdx = Math.min(scroll, Math.max(0, rows.length - maxItems));
    const visible = rows.slice(startIdx, startIdx + maxItems);

    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(SectionTitle, { detail: `${rows.length} 行` }, tableView.name),
      h(Text, { color: T.muted }, `列: ${colNames.join(', ')}`),
      rows.length === 0
        ? h(StatusLine, { kind: 'empty' }, '该表没有数据')
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
      h(Text, { color: T.muted, marginTop: 1 }, `第 ${startIdx + 1}-${Math.min(rows.length, startIdx + maxItems)} 行  ↑↓逐行 PgUp/Dn翻页 Home/End首尾 b/Esc返回`),
    );
  }

  const startIdx = Math.min(scroll, Math.max(0, tables.length - maxItems));
  const visible = tables.slice(startIdx, startIdx + maxItems);

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(SectionTitle, { detail: '运行数据与持久化表' }, '数据中心'),
    monitor && h(Text, { color: T.text }, `在线玩家 ${monitor.players.length}  | TPS ${monitor.tps > 0 ? monitor.tps.toFixed(1) : 'N/A'}  | 实体 ${Object.values(monitor.entities).reduce((sum, value) => sum + (value || 0), 0)}  | 区块 ${monitor.totalChunks}`),
    h(SectionTitle, { detail: `${tables.length} 表 | ${mode === 'http' ? 'HTTP' : '直连'}` }, '数据库表'),
    h(Text, { color: T.muted }, `输入编号查看表数据  第 ${startIdx + 1}-${Math.min(tables.length, startIdx + maxItems)}/${tables.length}  ↑↓逐行 PgUp/Dn翻页 r刷新`),
    ...visible.map((t, i) =>
      h(Text, { key: t.name, color: T.text },
        `  ${startIdx + i + 1}. ${t.name}  (${t.rows} 行)`),
    ),
  );
}

export { DbView };
