/**
 * app.js — App 根组件 (含 useInput handler)
 *
 * 布局: TabBar (顶栏) / Sidebar + MainContent / InputArea (底部)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
const h = React.createElement;
import { T } from './theme.js';
import { services, stopAll } from './services/manager.js';
import { logBuf, flushLogs } from './log-buffer.js';
import { useLogs } from './log-buffer-hooks.js';
import { hookMouse, isMouseActive, onRightClick } from './mouse.js';
import { pushLog } from './log-buffer.js';
import { poll as pollMonitor } from './monitor.js';
import { Dashboard, SvcView, CfgList, CfgEdit, ConfirmOverlay, MonitorView, ChatView, DbView } from './views/views.js';
import { SCHEMA } from './config-schema.js';
import { PROP_SCHEMA } from './server-prop-schema.js';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CFG_DIR = path.join(ROOT_DIR, 'configs');

// ── server.properties path helpers ──

function getBdsPath() {
  try {
    const raw = fs.readFileSync(path.join(CFG_DIR, 'bds_updater.json'), 'utf-8');
    const cfg = JSON.parse(raw);
    if (cfg.bds_path) return cfg.bds_path;
  } catch {}
  return 'D:\\Minecraft\\BEServer';
}

function getPropPath() { return path.join(getBdsPath(), 'server.properties'); }

// ── .properties parser / serializer ──

function parseProperties(text, schema) {
  const fieldMap = {};
  for (const f of schema.fields) fieldMap[f.key] = f;
  const result = {};
  for (let line of text.split('\n')) {
    line = line.trim();
    const m = line.match(/^(?:#)?([^=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    const field = fieldMap[key];
    if (!field) continue;
    result[key] = field.type === 'boolean' ? val === 'true' : field.type === 'number' ? parseFloat(val) : val;
  }
  return result;
}

function stringifyProperties(data, schema) {
  const lines = [];
  let group = '';
  for (const f of schema.fields) {
    if (f.key === 'level-type' && data[f.key] == null) continue;
    if (f.comment) {
      const firstRe = /^.{0,40}[?？;；]/;
      const short = f.comment.length > 60 ? f.comment.replace(firstRe, '$&').slice(0, 60) + '…' : f.comment;
      lines.push('# ' + short);
    }
    const raw = data[f.key];
    let strVal;
    if (f.type === 'boolean') strVal = raw ? 'true' : 'false';
    else if (f.type === 'number') strVal = String(raw ?? '');
    else strVal = String(raw ?? '');
    lines.push(f.key + '=' + strVal);
    lines.push('');
  }
  return lines.join('\r\n');
}

// ── Helper ──

function truncate(s, max = 16) {
  s = String(s);
  if (s.length <= max) return s;
  return s.slice(0, max - 2) + '..';
}

function flatten(obj, p = '') {
  const r = [];
  for (const [k, v] of Object.entries(obj)) {
    const baseKey = p ? `${p}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          r.push(...flatten(item, `${baseKey}[${i}]`));
        } else {
          r.push({ key: `${baseKey}[${i}]`, value: JSON.parse(JSON.stringify(item)) });
        }
      });
    } else if (v !== null && typeof v === 'object') {
      r.push(...flatten(v, baseKey));
    } else {
      r.push({ key: baseKey, value: JSON.parse(JSON.stringify(v)) });
    }
  }
  return r;
}

function setByPath(obj, keyPath, val) {
  const tokens = keyPath.match(/[^.[\]]+/g) || [];
  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) cur = cur[tokens[i]];
  cur[tokens[tokens.length - 1]] = val;
}

function getByPath(obj, keyPath) {
  const tokens = keyPath.match(/[^.[\]]+/g) || [];
  let cur = obj;
  for (const t of tokens) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

// ── TabBar ──

const TABS = [
  { k: 'dashboard', l: '总览' },
  { k: 'monitor', l: '监控' },
  { k: 'chat', l: '频道' },
  { k: 'data', l: '数据' },
  { k: 'bds', l: 'BDS' },
  { k: 'llbot', l: 'LLBot' },
  { k: 'qq', l: 'QQ-Bridge' },
  { k: 'db', l: 'DB-Server' },
];

function TabBar({ activeTab, onTab }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return h(Box, { height: 1, backgroundColor: T.panel, flexDirection: 'row' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      TABS.map((t) =>
        h(Box, {
          key: t.k,
          backgroundColor: activeTab === t.k ? T.element : T.panel,
          paddingLeft: 2, paddingRight: 2,
        },
          h(Text, {
            color: activeTab === t.k ? T.primary : T.muted,
            bold: activeTab === t.k,
          }, t.l),
        ),
      ),
    ),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: T.muted, paddingRight: 2 }, now),
  );
}

// ── Sidebar ──

function Sidebar({ menuItems, menuFocus, setMenuFocus, svcStatus, schema }) {
  const schemaInfo = schema ? (schema.desc || schema.name) : null;
  return h(Box, { width: 20, flexDirection: 'column', backgroundColor: T.panel, margin: 1, paddingTop: 1 },
    // Service status indicators
    ...Object.entries(svcStatus).map(([name, s]) =>
      h(Box, { key: name , paddingLeft: 1 },
        h(Text, { color: s.running ? T.success : T.error }, s.running ? '●' : '○'),
        h(Text, { color: T.text }, ` ${name.padEnd(8)} ${s.running ? '运行' : '停止'}`),
      ),
    ),
    h(Box, { key: `sep` , marginTop: 1, marginBottom: 1 },
      h(Text, { color: T.separator, paddingRight: 1, paddingLeft: 1}, ` ${'─'.repeat(18)}`)),

    // Menu items
    menuItems.map((item, i) => {
      if (item.act === 'separator') {
        return h(Box, { key: `sep${i}` },
          h(Text, { color: T.separator }, ` ${'─'.repeat(18)}`),
        );
      }
      return h(Box, {
        key: item.k,
        backgroundColor: i === menuFocus ? T.focusBg : T.panel,
      },
        h(Text, { color: i === menuFocus ? T.primary : T.muted },
          ` ${item.l}`),
      );
    }),

    // Schema description at the bottom (multi-line wrap)
    schemaInfo && (() => {
      const maxW = 18;
      const lines = [];
      for (let s = schemaInfo; s.length > 0;) {
        if (s.length <= maxW) { lines.push(s); break; }
        let idx = s.lastIndexOf(' ', maxW);
        if (idx < 1) idx = maxW - 1;
        lines.push(s.slice(0, idx));
        s = s.slice(idx).trimStart();
      }
      return h(Box, { key: 'schema-info', flexGrow: 1, flexDirection: 'column', justifyContent: 'flex-end', paddingLeft: 1, paddingBottom: 1 },
        ...lines.map((line, i) => h(Text, { key: i, color: T.muted }, line)),
      );
    })(),
  );
}

// ── App ──

function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;
  const rows = stdout?.rows || 24;
  const viewH = rows - 6; // TabBar(1) + Input(4) + marginBottom(1)
  const logH = viewH - 6;
  const logW = Math.max(10, cols - 24); // sidebar(20) + padding(2) + safety(2)

  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState('dashboard');
  const [svcName, setSvcName] = useState(null);

  // Config editing
  const [cfgFiles, setCfgFiles] = useState([]);
  const [cfgIdx, setCfgIdx] = useState(-1);
  const [cfgData, setCfgData] = useState({});
  const [cfgOrig, setCfgOrig] = useState({});
  const [cfgDirty, setCfgDirty] = useState(false);
  const [cfgSchema, setCfgSchema] = useState(null);
  const [cfgFocus, setCfgFocus] = useState(0);
  const [cfgArrayIdx, setCfgArrayIdx] = useState(-1);
  const [cfgEnumPicker, setCfgEnumPicker] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBuf, setEditBuf] = useState('');
  const inputFocus = view === 'cfg_list' || editing !== null;

  const [menuFocus, setMenuFocus] = useState(-1);
  const [logScroll, setLogScroll] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [editCursor, setEditCursor] = useState(0);
  const [cfgEditVer, setCfgEditVer] = useState(0);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  // Confirm overlay state
  const [confirm, setConfirm] = useState(null);

  // Quit double-press guard
  const [quitPending, setQuitPending] = useState(false);
  const quitTimerRef = React.useRef(null);

  // Blinking cursor
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { hookMouse(setLogScroll); onRightClick(() => showToast('已复制 ✓')); return () => { }; }, []);

  // Auto-refresh + resize + monitor polling
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => {
      setTick((t) => t + 1);
      pollMonitor(tick + 1);
    }, 3000);
    const onResize = () => setTick((t) => t + 1);
    process.stdout.on('resize', onResize);
    return () => { clearInterval(h); process.stdout.removeListener('resize', onResize); };
  }, []);

  useEffect(() => { setLogScroll(0); }, [view, svcName, activeTab]);

  const svcStatus = useMemo(() => {
    const r = {};
    for (const [k, v] of Object.entries(services)) r[k] = { running: v.running, pid: v.pid };
    return r;
  }, [tick]);

  // ── Config display items ──

  const cfgItems = useMemo(() => {
    if (!cfgSchema || !cfgData) return [];
    if (cfgArrayIdx >= 0 && cfgSchema.type === 'array') {
      const item = cfgData[cfgArrayIdx];
      if (!item) return [];
      return cfgSchema.itemFields.map(f => ({
        key: f.key,
        label: f.label,
        value: f.arrayJoin ? (Array.isArray(item[f.key]) ? item[f.key].join(', ') : item[f.key]) : item[f.key],
        type: f.type,
        values: f.values,
        arrayJoin: f.arrayJoin,
      }));
    }
    if (cfgSchema.type === 'array') {
      const items = (cfgData || []).map((item, i) => ({
        label: cfgSchema.itemLabel(item),
        type: 'array_item',
        value: item,
        idx: i,
      }));
      if (items.length > 0) items.push({ label: '❌ 删除条目', type: 'delete' });
      items.push({ label: '+ 添加条目', type: 'add' });
      return items;
    }
    if (cfgSchema.fields) {
      return cfgSchema.fields.map(f => ({
        key: f.key,
        label: f.label,
        value: getByPath(cfgData, f.key),
        type: f.type,
        values: f.values,
        arrayJoin: f.arrayJoin,
      }));
    }
    return [];
  }, [cfgSchema, cfgData, cfgArrayIdx]);

  const fieldMeta = useMemo(() => {
    const m = {};
    if (!cfgSchema) return m;
    const add = (k, t, aj) => { if (k) { m[k] = { type: t, arrayJoin: aj }; } };
    if (cfgSchema.fields) cfgSchema.fields.forEach(f => add(f.key, f.type, f.arrayJoin));
    if (cfgSchema.itemFields) cfgSchema.itemFields.forEach(f => add(f.key, f.type, f.arrayJoin));
    return m;
  }, [cfgSchema]);

  // ── Menu items ──

  const menuItems = useMemo(() => {
    if (view === 'cfg_edit') {
      const items = [
        { k: 0, l: '❎ 退出', act: 'exit_cfg' },
      ];
      if (cfgDirty) {
        items.push({ k: 1, l: '💾 保存', act: 'save_cfg' });
        items.push({ k: 2, l: '↩️ 撤销', act: 'cancel_cfg' });
      }
      items.push({ k: -1, l: '', act: 'separator' });
      return items;
    }

    const items = [
      { k: 0, l: '❎ 退出', act: 'exit' },
      { k: 1, l: 'ℹ️ 总览', act: 'home' },
    ];

    // Service operations when on a service tab
    if (activeTab !== 'dashboard') {
      items.push(
        { k: 2, l: '⏺️ 启动', act: 'start' },
        { k: 3, l: '⏹️ 停止', act: 'stop' },
        { k: 4, l: '🔄 重启', act: 'restart' },
        { k: -1, l: '', act: 'separator' },
      );
    }

    items.push(
      { k: 5, l: '❇️ 检测更新', act: 'check_update' },
      { k: 6, l: '📋 复制日志', act: 'copy_logs' },
      { k: 7, l: '⚛️ 插件配置', act: 'cfg_list' },
      { k: 8, l: '⚙️ 服务器配置', act: 'edit_server_prop' },
      { k: 9, l: '🔧 面板设置', act: 'edit_panel_cfg' },
    );

    return items;
  }, [view, activeTab, cfgDirty]);

  // ── Tab switch ──

  function switchTab(tab) {
    if (view === 'cfg_edit' && cfgDirty) {
      setConfirm({
        title: '未保存的修改',
        body: ['当前配置有未保存的修改', '切换标签将丢失修改', '确定切换?'],
        onConfirm: () => doSwitchTab(tab),
        onCancel: () => { },
      });
      return;
    }
    doSwitchTab(tab);
  }

  function doSwitchTab(tab) {
    setActiveTab(tab);
    if (tab === 'dashboard') { setView('dashboard'); setSvcName(null); }
    else if (tab === 'monitor') { setView('monitor'); setSvcName(null); }
    else if (tab === 'chat') { setView('chat'); setSvcName(null); }
    else if (tab === 'data') { setView('data'); setSvcName(null); }
    else { setView('svc'); setSvcName(tab); }
  }

  // ── Actions ──

  function doAct(num) {
    const item = menuItems.find((m) => m.k === num);
    if (!item) return;
    if (item.act === 'exit') { stopAll().finally(() => { exit(); console.clear(); }); }
    else if (item.act === 'home') { switchTab('dashboard'); }
    else if (item.act === 'start' || item.act === 'stop' || item.act === 'restart') {
      if (activeTab && activeTab !== 'dashboard' && services[activeTab]) {
        services[activeTab][item.act]();
      } else pushLog(`未选择服务`, 'warning');
    }
    else if (item.act === 'check_update') { checkForUpdate(); }
    else if (item.act === 'copy_logs') {
      const source = activeTab === 'dashboard' ? undefined : activeTab;
      const entries = source ? logBuf.filter(l => l.source === source) : logBuf;
      const text = entries.map(l => l.text).join('\n');
      const proc = exec('clip', { shell: true });
      proc.stdin.write(text);
      proc.stdin.end();
      showToast('已复制 ✓');
    }
    else if (item.act === 'cfg_list') { loadCfgList(); }
    else if (item.act === 'edit_server_prop') { loadServerProp(); }
    else if (item.act === 'edit_panel_cfg') {
      const f = 'panel_config.json';
      try {
        const raw = fs.readFileSync(path.join(CFG_DIR, f), 'utf-8');
        const d = JSON.parse(raw);
        setCfgData(d); setCfgOrig(JSON.parse(JSON.stringify(d)));
        setCfgIdx(-1); setCfgDirty(false);
        setCfgSchema(SCHEMA[f] || null);
        setCfgFocus(0); setCfgArrayIdx(-1);
        setCfgEnumPicker(null); setEditing(null);
        setView('cfg_edit');
      } catch (e) { pushLog(`读取 ${f} 失败: ${e.message}`, 'error'); }
    }
    else if (item.act === 'exit_cfg') {
      const exitView = cfgSchema === PROP_SCHEMA ? 'dashboard' : 'cfg_list';
      if (cfgDirty) {
        setConfirm({
          title: '未保存的修改',
          body: ['有未保存的修改', '确定退出?'],
          onConfirm: () => { setView(exitView); setCfgSchema(null); setCfgArrayIdx(-1); setCfgEnumPicker(null); setEditing(null); },
          onCancel: () => {},
        });
      } else { setView(exitView); setCfgSchema(null); setCfgArrayIdx(-1); setCfgEnumPicker(null); setEditing(null); }
    }
    else if (item.act === 'save_cfg') { saveCfg(); }
    else if (item.act === 'cancel_cfg') {
      setCfgData(JSON.parse(JSON.stringify(cfgOrig)));
      setCfgDirty(false); setCfgFocus(0); setCfgArrayIdx(-1);
      pushLog('已撤销修改', 'info');
    }
    else if (item.act === 'edit_cfg') {
      // No longer used - handled by cfg_edit internal navigation
    }
  }

  // ── Config ──

  function loadCfgList() {
    try {
      setCfgFiles(fs.readdirSync(CFG_DIR).filter((f) => f.endsWith('.json')));
      setView('cfg_list');
    } catch (e) { pushLog(`读取 configs 失败: ${e.message}`, 'error'); }
  }

  function loadCfg(idx) {
    const f = cfgFiles[idx]; if (!f) return;
    try {
      const raw = fs.readFileSync(path.join(CFG_DIR, f), 'utf-8');
      const d = JSON.parse(raw);
      setCfgData(d); setCfgOrig(JSON.parse(JSON.stringify(d)));
      setCfgIdx(idx); setCfgDirty(false);
      setCfgSchema(SCHEMA[f] || null);
      setCfgFocus(0); setCfgArrayIdx(-1);
      setCfgEnumPicker(null); setEditing(null);
      setView('cfg_edit');
    } catch (e) { pushLog(`读取 ${f} 失败: ${e.message}`, 'error'); }
  }

  function loadServerProp() {
    const p = getPropPath();
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const d = parseProperties(raw, PROP_SCHEMA);
      setCfgData(d); setCfgOrig(JSON.parse(JSON.stringify(d)));
      setCfgIdx(-1); setCfgDirty(false);
      setCfgSchema(PROP_SCHEMA);
      setCfgFocus(0); setCfgArrayIdx(-1);
      setCfgEnumPicker(null); setEditing(null);
      setView('cfg_edit');
    } catch (e) { pushLog(`读取 server.properties 失败: ${e.message}`, 'error'); }
  }

  function applyEdit(keyPath, val) {
    const obj = JSON.parse(JSON.stringify(cfgData));
    setByPath(obj, keyPath, val);
    setCfgData(obj);
    const dirty = JSON.stringify(obj) !== JSON.stringify(cfgOrig);
    setCfgDirty(dirty);
    setEditing(null);
  }

  function addArrayItem() {
    if (!cfgSchema || cfgSchema.type !== 'array') return;
    const newItem = cfgSchema.newItem ? JSON.parse(JSON.stringify(cfgSchema.newItem)) : '';
    const obj = JSON.parse(JSON.stringify(cfgData));
    obj.push(newItem);
    setCfgData(obj);
    setCfgDirty(JSON.stringify(obj) !== JSON.stringify(cfgOrig));
    setCfgArrayIdx(obj.length - 1);
    setCfgFocus(0);
    setCfgEditVer(v => v + 1);
  }

  function deleteArrayItem(idx) {
    const obj = JSON.parse(JSON.stringify(cfgData));
    obj.splice(idx, 1);
    setCfgData(obj);
    setCfgDirty(JSON.stringify(obj) !== JSON.stringify(cfgOrig));
    // Clamp focus to a valid array item index (never onto a button)
    const maxItemIdx = Math.max(0, obj.length - 1);
    setCfgFocus(Math.min(Math.max(0, idx), maxItemIdx));
    setCfgEditVer(v => v + 1);
  }

  function saveCfg() {
    if (cfgSchema === PROP_SCHEMA) {
      try {
        const text = stringifyProperties(cfgData, PROP_SCHEMA);
        const backup = getPropPath() + '.bak';
        try { fs.copyFileSync(getPropPath(), backup); } catch {}
        fs.writeFileSync(getPropPath(), text, 'utf-8');
        setCfgDirty(false); setCfgOrig(JSON.parse(JSON.stringify(cfgData)));
        pushLog('已保存 server.properties（请重启 BDS 生效）', 'success');
      } catch (e) { pushLog(`保存 server.properties 失败: ${e.message}`, 'error'); }
      return;
    }
    const f = cfgFiles[cfgIdx]; if (!f) return;
    try {
      fs.writeFileSync(path.join(CFG_DIR, f), JSON.stringify(cfgData, null, 2) + '\n');
      setCfgDirty(false); setCfgOrig(JSON.parse(JSON.stringify(cfgData)));
      pushLog(`已保存 ${f}`, 'success');
      const payload = JSON.stringify({ key: '_reload_signal', value: String(Date.now()) });
      const req = http.request({
        hostname: '127.0.0.1', port: 3001, path: '/api/sfmc/settings/_reload_signal',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      });
      req.on('error', (e) => pushLog(`db-server: ${e.message}`, 'warning'));
      req.write(payload); req.end();
    } catch (e) { pushLog(`保存失败: ${e.message}`, 'error'); }
  }

  // ── BDS Update ──

  function checkForUpdate() {
    pushLog('正在检查 BDS 更新...', 'info');
    const child = exec('node BDSTools/check-update.js --check-only', { cwd: ROOT_DIR });
    child.stdout.on('data', (d) => {
      for (const l of d.toString().split('\n')) { const t = l.trim(); if (t) pushLog(t, 'info'); }
    });
    child.stderr.on('data', (d) => {
      for (const l of d.toString().split('\n')) { const t = l.trim(); if (t) pushLog(t, 'error'); }
    });
    child.on('exit', (code) => {
      // Detect version info from logs
      const lines = logBuf.map((x) => x.text);
      const cur = lines.find((l) => l.includes('当前版本'));
      const lat = lines.find((l) => l.includes('发现新版本: '));
      const found = lines.find((l) => l.includes('无需更新'));
      const no = lines.find((l) => l.includes('未找到'));
      if (no) {
        pushLog('获取更新数据失败', 'error');
      } else
      if (!found && lat) {
        setConfirm({
          title: '发现新版本!',
          body: [cur || '', lat || '', '', '是否下载更新?'],
          onConfirm: () => {
            pushLog('开始下载更新...', 'info');
            const dl = exec('node BDSTools/check-update.js', { cwd: ROOT_DIR });
            dl.stdout.on('data', (d) => pushLog(d.toString().trim(), 'info'));
            dl.stderr.on('data', (d) => pushLog(d.toString().trim(), 'error'));
          },
          onCancel: () => pushLog('已取消更新', 'info'),
        });
      } else {
        pushLog(`已是最新版本`, 'success');
      }
    });
  }

  // ── Keyboard ──

  useInput((input, key) => {
    const isEnter = key.return || key.name === 'return' || key.name === 'enter';
    const isBksp = key.backspace || key.name === 'backspace';

    // Confirm overlay: intercept y/n/escape before everything
    if (confirm) {
      if (input === 'y') { const c = confirm; setConfirm(null); c.onConfirm(); }
      else if (input === 'n' || key.escape) { const c = confirm; setConfirm(null); c.onCancel(); }
      return;
    }

    // Mouse activity guard: SGR sequences leak individual chars into useInput
    if (isMouseActive()) { return; }

    if (isEnter && !inputVal.trim() && editing === null && menuFocus >= 0) {
      doAct(menuItems[menuFocus]?.k); setMenuFocus(-1); return;
    }

    // Quit double-press guard
    if (input === 'q' && !inputVal) {
      if (quitPending) {
        clearTimeout(quitTimerRef.current);
        pushLog('正在停止所有服务...', 'info');
        stopAll().finally(() => { exit(); console.clear(); console.log('BDS Panel 已安全退出，感谢使用(～￣▽￣)～'); });
      } else {
        setQuitPending(true);
        pushLog('再按一次 q 确认退出', 'warning');
        clearTimeout(quitTimerRef.current);
        quitTimerRef.current = setTimeout(() => setQuitPending(false), 3000);
      }
      return;
    }
    if (quitPending) { setQuitPending(false); clearTimeout(quitTimerRef.current); }

    if (key.ctrl && input === 'c') {
      pushLog('正在停止所有服务...', 'info');
      stopAll().finally(() => { exit(); console.clear(); console.log('BDS Panel 已安全退出，感谢使用(～￣▽￣)～'); });
      return;
    }

    // Tab key cycles tabs (disabled in cfg_edit to avoid accidental switch)
    if (key.tab && view !== 'cfg_edit') {
      const idx = TABS.findIndex((t) => t.k === activeTab);
      const next = (idx + 1) % TABS.length;
      switchTab(TABS[next].k);
      setMenuFocus(-1);
      return;
    }

    // Tab shortcuts: 1-6 switch tabs (only when input is empty, disabled in cfg_edit/cfg_list)
    if (!inputVal && input && '123456'.includes(input) && view !== 'cfg_edit' && view !== 'cfg_list') {
      const idx = parseInt(input, 10) - 1;
      if (TABS[idx]) { switchTab(TABS[idx].k); setMenuFocus(-1); return; }
    }

    // Config list view (digits typed go to inputVal, Enter in command handler processes them)
    if (view === 'cfg_list') {
      if (input === 'b' || key.escape) { setView('dashboard'); return; }
      if (key.pageUp) { setLogScroll((s) => Math.min(cfgFiles.length, s + Math.floor(viewH / 2))); return; }
      if (key.pageDown) { setLogScroll((s) => Math.max(0, s - Math.floor(viewH / 2))); return; }
      if (key.upArrow) { setLogScroll((s) => Math.min(cfgFiles.length, s + 1)); return; }
      if (key.downArrow) { setLogScroll((s) => Math.max(0, s - 1)); return; }
    }

    // Config edit view
    if (view === 'cfg_edit') {
      // Text editing mode
      if (editing !== null) {
        if (isEnter) {
          let v = editBuf;
          const shortKey = editing.replace(/^\[[^\]]*\]\.?/, '');
          const meta = fieldMeta[shortKey];
          // 基本类型数组 ([0], [1] …) — 由 itemType 推断类型
          const arrMatch = editing.match(/^\[(\d+)\]$/);
          if (arrMatch && cfgSchema?.itemType === 'number') {
            const num = parseFloat(v);
            if (isNaN(num)) { pushLog(`输入无效数字: ${v}`, 'error'); setEditing(null); return; }
            v = num;
          } else if (meta?.type === 'number') {
            const num = parseFloat(v);
            if (isNaN(num)) { pushLog(`输入无效数字: ${v}`, 'error'); setEditing(null); return; }
            v = num;
          }
          if (meta?.arrayJoin) v = v.split(',').map(s => s.trim());
          applyEdit(editing, v);
          return;
        }
        if (key.escape) { setEditing(null); return; }
        if (key.leftArrow) { setEditCursor(c => Math.max(0, c - 1)); return; }
        if (key.rightArrow) { setEditCursor(c => Math.min(editBuf.length, c + 1)); return; }
        if (isBksp) {
          if (editCursor > 0) {
            setEditBuf((b) => b.slice(0, editCursor - 1) + b.slice(editCursor));
            setEditCursor(c => c - 1);
          }
          return;
        }
        if (input) {
          setEditBuf((b) => b.slice(0, editCursor) + input + b.slice(editCursor));
          setEditCursor(c => c + input.length);
        }
        return;
      }

      // Enum picker open (wrap-around)
      if (cfgEnumPicker) {
        const opts = cfgEnumPicker.values;
        if (key.upArrow) { setCfgEnumPicker(p => ({ ...p, focus: p.focus <= 0 ? opts.length - 1 : p.focus - 1 })); return; }
        if (key.downArrow) { setCfgEnumPicker(p => ({ ...p, focus: p.focus >= opts.length - 1 ? 0 : p.focus + 1 })); return; }
        if (key.home) { setCfgEnumPicker(p => ({ ...p, focus: 0 })); return; }
        if (key.end) { setCfgEnumPicker(p => ({ ...p, focus: opts.length - 1 })); return; }
        if (isEnter) {
          const val = cfgEnumPicker.values[cfgEnumPicker.focus].value;
          applyEdit(cfgEnumPicker.key, val);
          setCfgEnumPicker(null);
          return;
        }
        if (key.escape) { setCfgEnumPicker(null); return; }
        return;
      }

      // Sidebar focused in cfg_edit (wrap-around + Home/End)
      if (menuFocus >= 0) {
        if (key.upArrow) { setMenuFocus(f => f <= 0 ? menuItems.length - 1 : f - 1); return; }
        if (key.downArrow) { setMenuFocus(f => f >= menuItems.length - 1 ? 0 : f + 1); return; }
        if (key.home) { setMenuFocus(0); return; }
        if (key.end) { setMenuFocus(menuItems.length - 1); return; }
        if (isEnter) { doAct(menuItems[menuFocus]?.k); setMenuFocus(-1); return; }
        if (key.rightArrow || (key.escape && menuFocus >= 0)) { setMenuFocus(-1); return; }
        return;
      }

      // Config item navigation (wrap-around + Home/End)
      if (key.upArrow) { setCfgFocus(f => f <= 0 ? cfgItems.length - 1 : f - 1); return; }
      if (key.downArrow) { setCfgFocus(f => f >= cfgItems.length - 1 ? 0 : f + 1); return; }
      if (key.home) { setCfgFocus(0); return; }
      if (key.end) { setCfgFocus(cfgItems.length - 1); return; }

      if (isEnter) {
        const item = cfgItems[cfgFocus];
        if (!item) return;
        if (item.type === 'add') { addArrayItem(); return; }
        if (item.type === 'delete') {
          const target = cfgData.length - 1;
          if (target >= 0) {
            setConfirm({
              title: '删除条目',
              body: ['确定删除最后一项?', cfgSchema.itemLabel(cfgData[target])],
              onConfirm: () => deleteArrayItem(target),
              onCancel: () => {},
            });
          }
          return;
        }
        if (item.type === 'array_item') {
          if (cfgSchema.itemType === 'string' || cfgSchema.itemType === 'number') {
            setEditing(`[${item.idx}]`); setEditBuf(String(item.value ?? '')); setEditCursor(String(item.value ?? '').length);
          } else {
            setCfgArrayIdx(item.idx); setCfgFocus(0);
          }
          return;
        }
        const fullKey = cfgArrayIdx >= 0 ? `[${cfgArrayIdx}].${item.key}` : item.key;
        if (item.type === 'boolean') { applyEdit(fullKey, !item.value); return; }
        if (item.type === 'enum') { setCfgEnumPicker({ key: fullKey, label: item.label, values: item.values, focus: 0 }); return; }
        setEditing(fullKey); setEditBuf(String(item.value ?? '')); setEditCursor(String(item.value ?? '').length);
        return;
      }

      if (key.delete && cfgSchema?.type === 'array' && cfgArrayIdx === -1) {
        const idx = cfgFocus;
        if (idx >= 0 && idx < (cfgData?.length || 0)) {
          setConfirm({
            title: '删除条目',
            body: ['确定删除?', cfgSchema.itemLabel(cfgData[idx])],
            onConfirm: () => deleteArrayItem(idx),
            onCancel: () => {},
          });
        }
        return;
      }

      if (key.leftArrow) { setMenuFocus(0); return; }
      if (key.escape) {
        const exitView = cfgSchema === PROP_SCHEMA ? 'dashboard' : 'cfg_list';
        if (cfgArrayIdx >= 0) { setCfgArrayIdx(-1); setCfgFocus(0); return; }
        if (cfgDirty) {
          setConfirm({
            title: '未保存的修改',
            body: ['有未保存的修改', '确定退出?'],
            onConfirm: () => { setView(exitView); setCfgSchema(null); setCfgArrayIdx(-1); setCfgEnumPicker(null); setEditing(null); },
            onCancel: () => {},
          });
        } else { setView(exitView); setCfgSchema(null); setCfgArrayIdx(-1); setCfgEnumPicker(null); setEditing(null); }
        return;
      }
      return;
    }

    if (key.escape) {
      setView('dashboard');
      setLogScroll(0);
      return;
    }

    // Backspace on inputVal (not in cfg_edit; cfg_edit has its own handler)
    if (isBksp) {
      if (inputVal && cursorPos > 0) {
        setInputVal((v) => v.slice(0, cursorPos - 1) + v.slice(cursorPos));
        setCursorPos((p) => p - 1);
      }
      return;
    }

    if (isEnter && inputVal.trim()) {
      if (view === 'cfg_list') {
        const n = parseInt(inputVal.trim(), 10);
        if (n >= 1 && n <= cfgFiles.length) { loadCfg(n - 1); }
        else { pushLog(`编号无效: ${inputVal.trim()}`, 'warning'); }
        setInputVal(''); setCursorPos(0); return;
      }
      const raw = inputVal.trim();
      const cmd = raw.toLowerCase();
      setInputVal(''); setCursorPos(0);

      if (cmd === 'start' || cmd === 'stop' || cmd === 'restart') {
        if (activeTab && activeTab !== 'dashboard' && services[activeTab]) services[activeTab][cmd]();
        else pushLog(`需先通过 Tab 选择服务`, 'warning');
      } else if (cmd === 'back' || cmd === '0') { switchTab('dashboard'); }
      else if (cmd === 'clear') { logBuf.length = 0; flushLogs(); }
      else if (cmd === 'help') {
        if (activeTab === 'bds') {
          services[activeTab].send(cmd);
        }
        if (activeTab === 'dashboard') {
          pushLog('内置命令: help, start, stop, restart, clear', 'info');
        } else if (activeTab === 'llbot') {
          services[activeTab].send(cmd);
        } else if (activeTab === 'qq') {
          pushLog('QQ Bridge 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','qq');
        } else if (activeTab === 'db') {
          pushLog('DB Server 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','db');
        } else {
          pushLog('请先通过 Tab 选择一个服务', 'warning');
        }
      }
      // Send to process stdin if on a service tab and service is running
      else if (activeTab && activeTab !== 'dashboard' && services[activeTab]?.running) {
        services[activeTab].send(raw);
      }
      else {
        pushLog(`未知命令: ${cmd}`, 'warning');
      }
      return;
    }

    if (key.pageUp) { setLogScroll((s) => Math.min(logBuf.length, s + Math.floor(viewH / 2))); return; }
    if (key.pageDown) { setLogScroll((s) => Math.max(0, s - Math.floor(viewH / 2))); return; }
    if (key.home) { setLogScroll(logBuf.length); return; }
    if (key.end) { setLogScroll(0); return; }
    if (key.upArrow || key.downArrow) {
      if (view === 'chat' || view === 'data') { return; } // ChatView / DbView handles its own navigation
      if (key.upArrow) { setMenuFocus((f) => f <= 0 ? menuItems.length - 1 : f - 1); return; }
      if (key.downArrow) { setMenuFocus((f) => f >= menuItems.length - 1 ? 0 : f + 1); return; }
    }
    if (key.leftArrow) { setCursorPos((p) => Math.max(0, p - 1)); return; }
    if (key.rightArrow) { setCursorPos((p) => Math.min(inputVal.length, p + 1)); return; }

    if (input && !key.ctrl && !key.meta && !/^[<>;]$/.test(input)) {
      setInputVal((v) => v.slice(0, cursorPos) + input + v.slice(cursorPos));
      setCursorPos((p) => p + input.length);
    }
  });

  // ── Render ──

  const mainContent = confirm
    ? h(ConfirmOverlay, { title: confirm.title, body: confirm.body })
    : (view === 'dashboard'
      ? h(Dashboard, { logH, logScroll, logW })
      : view === 'monitor'
        ? h(MonitorView, { logH, logW })
        : view === 'chat'
          ? h(ChatView, { logH, logW, tick })
          : view === 'data'
            ? h(DbView, { logH, logW })
            : view === 'svc' && svcName
            ? h(SvcView, { name: svcName, logH, logScroll, logW })
            : view === 'cfg_list'
              ? h(CfgList, { files: cfgFiles, logH, logScroll, logW })
              : view === 'cfg_edit'
                ? h(CfgEdit, { schema: cfgSchema, items: cfgItems, focus: cfgFocus, arrayIdx: cfgArrayIdx, enumPicker: cfgEnumPicker, dirty: cfgDirty, editing, editBuf, editCursor, cfgData, logH, logScroll, logW, editVer: cfgEditVer })
                : null);

  return h(Box, { width: cols, height: rows, flexDirection: 'column', position: 'relative' },

    // Tab bar
    h(TabBar, { activeTab, onTab: switchTab }),

    // Body
    h(Box, { height: viewH, flexDirection: 'row' },

      // Sidebar
      h(Sidebar, { menuItems, menuFocus, setMenuFocus, svcStatus, schema: cfgSchema }),

      // Main content (transparent, no background set)
      h(Box, { flexGrow: 1, flexDirection: 'column', paddingLeft: 1, paddingRight: 1 },
        mainContent,
      ),
    ),

    // Input area
    h(Box, { height: 4, backgroundColor: inputFocus ? T.element : T.panel, flexDirection: 'column', paddingLeft: 2, paddingRight: 2, paddingTop: 1, marginBottom: 1, marginLeft: 1, marginRight: 1},
      h(Box, { flexDirection: 'row' },
        h(Text, { bold: true, color: T.text },
          !inputVal ? '█' :
            cursorVisible
              ? inputVal.slice(0, cursorPos) + '█' + inputVal.slice(cursorPos)
              : inputVal),
      ),
      h(Text, { color: T.muted },
        confirm ? '[y] 确认  [n] 取消' :
          view === 'cfg_edit' ? (editing ? '←→移动光标 输入文字 Enter确认 Esc取消' :
            cfgEnumPicker ? '↑↓选择 Enter确认 Esc取消' :
              cfgDirty ? '←侧栏 ↑↓选择 Enter编辑 Delete删除 Esc退出' : '↑↓选择 Enter编辑 ←侧栏 Delete删除 Esc返回') :
            view === 'cfg_list' ? 'b:返回 ↑↓滚动 输入编号+Enter:选择' :
              (logScroll > 0 ? `↑ 可滚动  PgUp/Dn滚动   Home/End 回到首尾` :
                quitPending ? '再按 q 确认退出' :
                `Tab:切换顶栏选项 ↑↓:选择侧栏选项 PgUp/Dn:日志滚动 Shift+拖动:选择文字 q:退出`)),
    ),

    // Toast overlay (top-right corner)
    toast && h(Box, { position: 'absolute', top: 1, right: 1, backgroundColor: T.success, paddingLeft: 1, paddingRight: 1 },
      h(Text, { color: T.bg }, toast),
    ),
  );
}

export { App };
