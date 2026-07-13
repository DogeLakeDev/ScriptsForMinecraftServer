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
import { hookMouse, isMouseActive } from './mouse.js';
import { pushLog } from './log-buffer.js';
import { Dashboard, SvcView, CfgList, CfgEdit, ConfirmOverlay, MonitorView, ChatView, DbView, ModulesView, SetupView, ServicesView, SettingsView, SERVICE_ORDER } from './views/views.js';
import { SCHEMA } from './config-schema.js';
import { PROP_SCHEMA } from './server-prop-schema.js';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getJson, putJson } from './api/client.js';
import { Header, Sidebar, Footer } from './ui/Shell.js';
import { canSwitchTab, canUseTabShortcut, getLayout, requiresConfirmation } from './navigation/rules.js';
import { updateProperties } from './config/properties.js';

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

// ── Helper ──

const clone = (obj) => JSON.parse(JSON.stringify(obj));

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
  { k: 'services', l: '服务' },
  { k: 'monitor', l: '监控' },
  { k: 'modules', l: '模块' },
  { k: 'chat', l: '频道' },
  { k: 'data', l: '数据' },
  { k: 'settings', l: '设置' },
];

// ── App ──

function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;
  const rows = stdout?.rows || 24;
  const { compact, narrow, footerHeight: footerH, viewHeight: viewH, logHeight: logH, logWidth: logW } = getLayout(cols, rows);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState('dashboard');
  const [svcName, setSvcName] = useState(null);
  const [serviceFocus, setServiceFocus] = useState(0);
  const [settingsFocus, setSettingsFocus] = useState(0);
  const [setupRequired, setSetupRequired] = useState(null);
  const [focusZone, setFocusZone] = useState('main'); // 'main' | 'sidebar' (SetupView 自带 'setup' zone)

  // 检测 panel-state 是否完成 setup
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const d = await getJson('/api/sfmc/setup/state');
        if (!cancelled) setSetupRequired(!d.initialized);
      } catch {}
    }
    check();
    const t = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Config editing
  const [cfgFiles, setCfgFiles] = useState([]);
  const [cfgIdx, setCfgIdx] = useState(-1);
  const [cfgData, setCfgData] = useState({});
  const [cfgOrig, setCfgOrig] = useState({});
  const [cfgRawText, setCfgRawText] = useState('');
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

  function showToast(msg, level) {
    setToast({ msg, level: level || 'info' });
    setTimeout(() => setToast(null), 2500);
  }

  // Confirm overlay state
  const [confirm, setConfirm] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Quit double-press guard
  const [quitPending, setQuitPending] = useState(false);
  const quitTimerRef = React.useRef(null);

  // Blinking cursor
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { hookMouse(setLogScroll); }, []);

  // 仅窗口 resize 触发重渲染
  const [, resizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => resizeTick(x => x + 1);
    process.stdout.on('resize', onResize);
    return () => process.stdout.removeListener('resize', onResize);
  }, []);

  useEffect(() => { setLogScroll(0); }, [view, svcName, activeTab]);

  // 强制 setup：当检测到未初始化时跳到 setup Tab
  useEffect(() => {
    if (setupRequired === true) {
      setActiveTab('setup');
      setView('setup');
    }
  }, [setupRequired]);

  // svcStatus 直接从 services 读取，每次渲染时计算（轻量无副作用）
  const svcStatus = {};
  for (const [k, v] of Object.entries(services)) svcStatus[k] = { running: v.running, pid: v.pid };

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
        { k: 0, l: '退出', act: 'exit_cfg' },
      ];
      if (cfgDirty) {
        items.push({ k: 1, l: '保存', act: 'save_cfg' });
        items.push({ k: 2, l: '撤销', act: 'cancel_cfg' });
      }
      items.push({ k: -1, l: '', act: 'separator' });
      return items;
    }

    if (activeTab === 'setup') {
      return [
        { k: 0, l: '退出', act: 'exit' },
        { k: 6, l: '复制日志', act: 'copy_logs' },
      ];
    }

    if (activeTab === 'settings') {
      return [
        { k: 7, l: '插件配置', act: 'cfg_list' },
        { k: 8, l: '服务器配置', act: 'edit_server_prop' },
        { k: 9, l: '面板设置', act: 'edit_panel_cfg' },
      ];
    }

    const items = [{ k: 0, l: '退出', act: 'exit' }];

    // Service operations when on a service tab
    if (view === 'svc' && services[svcName]) {
      items.push(
        { k: 2, l: '启动', act: 'start' },
        { k: 3, l: '停止', act: 'stop' },
        { k: 4, l: '重启', act: 'restart' },
        { k: -1, l: '', act: 'separator' },
      );
    }

    items.push(
      ...(svcName === 'bds' ? [{ k: 5, l: '检测更新', act: 'check_update' }] : []),
      { k: 6, l: '复制日志', act: 'copy_logs' },
      { k: 7, l: '插件配置', act: 'cfg_list' },
    );

    return items;
  }, [view, activeTab, svcName, cfgDirty]);

  // ── Tab switch ──

  function switchTab(tab) {
    if (!canSwitchTab(setupRequired, tab)) return;
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
    if (!canSwitchTab(setupRequired, tab)) return;
    setActiveTab(tab);
    setFocusZone('main');
    setMenuFocus(-1);
    if (tab === 'dashboard') { setView('dashboard'); setSvcName(null); }
    else if (tab === 'services') { setView('services'); setSvcName(null); }
    else if (tab === 'monitor') { setView('monitor'); setSvcName(null); }
    else if (tab === 'modules') { setView('modules'); setSvcName(null); }
    else if (tab === 'setup') { setView('setup'); setSvcName(null); }
    else if (tab === 'settings') { setView('settings'); setSvcName(null); }
    else if (tab === 'chat') { setView('chat'); setSvcName(null); }
    else if (tab === 'data') { setView('data'); setSvcName(null); }
  }

  // ── Actions ──

  function doAct(num) {
    const item = menuItems.find((m) => m.k === num);
    if (!item) return;
    if (item.act === 'exit') { stopAll().finally(() => { exit(); console.clear(); }); }
    else if (item.act === 'home') { switchTab('dashboard'); }
    else if (item.act === 'start' || item.act === 'stop' || item.act === 'restart') {
      if (svcName && services[svcName]) {
        const run = () => services[svcName][item.act]();
        if (requiresConfirmation(item.act)) {
          setConfirm({
            title: item.act === 'stop' ? '停止服务' : '重启服务',
            body: [`${services[svcName].title} 将${item.act === 'stop' ? '停止' : '重启'}`, '确定继续?'],
            onConfirm: run,
            onCancel: () => {},
          });
        } else {
          run();
        }
      } else pushLog(`未选择服务`, 'warning');
    }
    else if (item.act === 'check_update') { checkForUpdate(); }
    else if (item.act === 'copy_logs') {
      const source = view === 'svc' ? svcName : undefined;
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
        setCfgData(d); setCfgOrig(clone(d)); setCfgRawText(raw);
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
      setCfgData(clone(cfgOrig));
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
      setCfgData(d); setCfgOrig(clone(d)); setCfgRawText(raw);
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
      setCfgData(d); setCfgOrig(clone(d)); setCfgRawText(raw);
      setCfgIdx(-1); setCfgDirty(false);
      setCfgSchema(PROP_SCHEMA);
      setCfgFocus(0); setCfgArrayIdx(-1);
      setCfgEnumPicker(null); setEditing(null);
      setView('cfg_edit');
    } catch (e) { pushLog(`读取 server.properties 失败: ${e.message}`, 'error'); }
  }

  function applyEdit(keyPath, val) {
    const obj = clone(cfgData);
    setByPath(obj, keyPath, val);
    setCfgData(obj);
    const dirty = JSON.stringify(obj) !== JSON.stringify(cfgOrig);
    setCfgDirty(dirty);
    setEditing(null);
  }

  function addArrayItem() {
    if (!cfgSchema || cfgSchema.type !== 'array') return;
    const newItem = cfgSchema.newItem ? clone(cfgSchema.newItem) : '';
    const obj = clone(cfgData);
    obj.push(newItem);
    setCfgData(obj);
    setCfgDirty(JSON.stringify(obj) !== JSON.stringify(cfgOrig));
    setCfgArrayIdx(obj.length - 1);
    setCfgFocus(0);
    setCfgEditVer(v => v + 1);
  }

  function deleteArrayItem(idx) {
    const obj = clone(cfgData);
    obj.splice(idx, 1);
    setCfgData(obj);
    setCfgDirty(JSON.stringify(obj) !== JSON.stringify(cfgOrig));
    const maxItemIdx = Math.max(0, obj.length - 1);
    setCfgFocus(Math.min(Math.max(0, idx), maxItemIdx));
    setCfgEditVer(v => v + 1);
  }

  function saveCfg() {
    if (cfgSchema === PROP_SCHEMA) {
      try {
        const text = updateProperties(cfgRawText, cfgData, PROP_SCHEMA);
        const backup = getPropPath() + '.bak';
        try { fs.copyFileSync(getPropPath(), backup); } catch {}
        fs.writeFileSync(getPropPath(), text, 'utf-8');
        setCfgDirty(false); setCfgOrig(clone(cfgData));
        setCfgRawText(text);
        pushLog('已保存 server.properties（已保留未知字段和注释，请重启 BDS 生效）', 'success');
      } catch (e) { pushLog(`保存 server.properties 失败: ${e.message}`, 'error'); }
      return;
    }
    const f = cfgFiles[cfgIdx]; if (!f) return;
    try {
      fs.writeFileSync(path.join(CFG_DIR, f), JSON.stringify(cfgData, null, 2) + '\n');
      setCfgDirty(false); setCfgOrig(clone(cfgData));
      pushLog(`已保存 ${f}`, 'success');
      putJson('/api/sfmc/settings/_reload_signal', { key: '_reload_signal', value: String(Date.now()) })
        .catch((e) => pushLog(`db-server: ${e.message}`, 'warning'));
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

    // Confirm overlays always have priority, including while Setup is visible.
    if (confirm) {
      if (input === 'y') { const c = confirm; setConfirm(null); c.onConfirm(); }
      else if (input === 'n' || key.escape) { const c = confirm; setConfirm(null); c.onCancel(); }
      return;
    }

    // 当 SetupView 激活时，App 不拦截任何键（让 SetupView 完全独占）
    const isSetupActive = activeTab === 'setup' && view === 'setup';
    if (isSetupActive) {
      // 但全局快捷键仍生效
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
      // Tab 切换：数字键
      if (setupRequired !== true && !inputVal && input && '123456789'.includes(input)) {
        const idx = parseInt(input, 10) - 1;
        if (TABS[idx]) { switchTab(TABS[idx].k); setMenuFocus(-1); return; }
      }
      // Tab 循环：Tab 键
      if (setupRequired !== true && key.tab) {
        const idx = TABS.findIndex((t) => t.k === activeTab);
        const next = (idx + 1) % TABS.length;
        switchTab(TABS[next].k);
        setMenuFocus(-1);
        return;
      }
      return; // 其余键全部交给 SetupView
    }

    // Mouse activity guard: SGR sequences leak individual chars into useInput
    if (isMouseActive()) { return; }

    // Help overlay (works in any zone except confirm/editing)
    if ((input === '?' || input === 'h' || input === 'F1') && !confirm && editing === null && !inputVal) {
      if (!helpOpen) { setHelpOpen(true); return; }
    }
    if (helpOpen && (key.escape || input === '?' || input === 'h')) {
      setHelpOpen(false);
      return;
    }
    if (helpOpen) return;

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

    // Tab shortcuts: 1-9 switch tabs (only when input is empty, disabled in cfg_edit/cfg_list)
    if (canUseTabShortcut(inputVal, view) && input && '123456789'.includes(input)) {
      const idx = parseInt(input, 10) - 1;
      if (TABS[idx]) { switchTab(TABS[idx].k); setMenuFocus(-1); return; }
    }

    if (view === 'services' && focusZone !== 'sidebar') {
      if (!compact && key.rightArrow) { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); return; }
      if (key.upArrow) { setServiceFocus((index) => Math.max(0, index - 1)); return; }
      if (key.downArrow) { setServiceFocus((index) => Math.min(SERVICE_ORDER.length - 1, index + 1)); return; }
      if (key.home) { setServiceFocus(0); return; }
      if (key.end) { setServiceFocus(SERVICE_ORDER.length - 1); return; }
      if (isEnter) { setSvcName(SERVICE_ORDER[serviceFocus]); setView('svc'); return; }
      return;
    }

    // These screens provide their own focus and keyboard navigation.
    if (view === 'monitor' || view === 'chat' || view === 'data' || view === 'modules') {
      if (key.escape) { setView('dashboard'); setActiveTab('dashboard'); setLogScroll(0); }
      return;
    }
    if (view === 'settings') return;

    // ←/→ 在 main Tab 内切换 sidebar / main 焦点（除 setup / cfg_edit / cfg_list）
    if (!compact && !isSetupActive && !inputVal && view !== 'cfg_edit' && view !== 'cfg_list') {
      if (key.rightArrow) { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); return; }
      if (key.leftArrow && focusZone === 'sidebar') { setFocusZone('main'); setMenuFocus(-1); return; }
    }

    // sidebar zone：↑↓/Home/End/Enter 由 App 统一处理（Sidebar 仅展示）
    if (focusZone === 'sidebar' && !inputVal && !isSetupActive && view !== 'cfg_edit' && view !== 'cfg_list') {
      if (key.upArrow) {
        setMenuFocus((f) => {
          if (f < 0) return menuItems.length - 1;
          const next = f <= 0 ? menuItems.length - 1 : f - 1;
          return next;
        });
        return;
      }
      if (key.downArrow) {
        setMenuFocus((f) => {
          if (f < 0) return 0;
          const next = f >= menuItems.length - 1 ? 0 : f + 1;
          return next;
        });
        return;
      }
      if (key.home) { setMenuFocus(0); return; }
      if (key.end) { setMenuFocus(menuItems.length - 1); return; }
      if (isEnter && menuFocus >= 0) {
        const item = menuItems[menuFocus];
        if (item) { doAct(item.k); setMenuFocus(-1); return; }
      }
      if (key.escape) { setFocusZone('main'); setMenuFocus(-1); return; }
      return; // sidebar zone 内其它键不冒泡
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
      if (view === 'svc' && activeTab === 'services') {
        setView('services');
      } else {
        setView('dashboard');
        setActiveTab('dashboard');
      }
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
        if (view === 'svc' && svcName && services[svcName]) {
          const run = () => services[svcName][cmd]();
          if (requiresConfirmation(cmd)) {
            setConfirm({
              title: cmd === 'stop' ? '停止服务' : '重启服务',
              body: [`${services[svcName].title} 将${cmd === 'stop' ? '停止' : '重启'}`, '确定继续?'],
              onConfirm: run,
              onCancel: () => {},
            });
          } else {
            run();
          }
        } else pushLog(`需先通过服务页选择服务`, 'warning');
      } else if (cmd === 'back' || cmd === '0') { switchTab('dashboard'); }
      else if (cmd === 'clear') { logBuf.length = 0; flushLogs(); }
      else if (cmd === 'help') {
        if (view === 'svc' && svcName === 'bds') {
          services[svcName].send(cmd);
        }
        if (activeTab === 'dashboard') {
          pushLog('内置命令: help, start, stop, restart, clear', 'info');
        } else if (view === 'svc' && svcName === 'llbot') {
          services[svcName].send(cmd);
        } else if (view === 'svc' && svcName === 'qq') {
          pushLog('QQ Bridge 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','qq');
        } else if (view === 'svc' && svcName === 'db') {
          pushLog('DB Server 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','db');
        } else {
          pushLog('请先通过 Tab 选择一个服务', 'warning');
        }
      }
      // Send to process stdin if on a service tab and service is running
      else if (view === 'svc' && svcName && services[svcName]?.running) {
        services[svcName].send(raw);
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
      if (view === 'chat' || view === 'data' || view === 'modules') { return; } // ChatView / DbView / ModulesView handles its own navigation
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

  const localInputActive = !confirm && !helpOpen;
  const requestConfirm = (title, body, onConfirm) => setConfirm({ title, body, onConfirm, onCancel: () => {} });
  const mainContent = confirm
    ? h(ConfirmOverlay, { title: confirm.title, body: confirm.body })
    : (activeTab === 'setup'
      ? h(SetupView, { showToast, pushLog, inputActive: localInputActive, onComplete: () => { setSetupRequired(false); setActiveTab('dashboard'); setView('dashboard'); pushLog('setup 完成', 'success'); } })
      : view === 'dashboard'
        ? h(Dashboard, { logH, logScroll, logW })
        : view === 'services'
          ? h(ServicesView, { focus: serviceFocus, logW })
          : view === 'monitor'
          ? h(MonitorView, { logH, logW, inputActive: localInputActive })
          : view === 'modules'
            ? h(ModulesView, { logH, logW, showToast, pushLog, inputActive: localInputActive, requestConfirm })
            : view === 'chat'
              ? h(ChatView, { logH, logW, inputActive: localInputActive })
              : view === 'data'
                ? h(DbView, { logH, logW, inputActive: localInputActive })
                : view === 'settings'
                  ? h(SettingsView, { focus: settingsFocus, onFocus: setSettingsFocus, onAction: (action) => doAct(menuItems.find((item) => item.act === action)?.k), inputActive: localInputActive })
              : view === 'svc' && svcName
                ? h(SvcView, { name: svcName, logH, logScroll, logW })
                  : view === 'cfg_list'
                ? h(CfgList, { files: cfgFiles, logH, logScroll, logW })
                : view === 'cfg_edit'
                  ? h(CfgEdit, { schema: cfgSchema, items: cfgItems, focus: cfgFocus, arrayIdx: cfgArrayIdx, enumPicker: cfgEnumPicker, dirty: cfgDirty, editing, editBuf, editCursor, cfgData, logH, logScroll, logW, editVer: cfgEditVer })
                  : null);

  const footerHint = confirm ? '[y] 确认  [n] 取消' :
    view === 'cfg_edit' ? (editing ? '←→移动光标 输入文字 Enter确认 Esc取消' :
      cfgEnumPicker ? '↑↓选择 Enter确认 Esc取消' :
        '↑↓选择 Enter编辑 Delete删除 Esc退出 ← 切到侧栏') :
      view === 'cfg_list' ? 'b:返回 ↑↓滚动 输入编号+Enter:选择' :
        activeTab === 'setup' ? '↑↓ 字段  Enter 编辑  n/p 步骤  c 检查  r 重置  i 导入' :
          view === 'services' ? '↑↓ 选择服务  Enter 查看日志与操作' :
            view === 'svc' ? 'Esc 返回服务列表  输入命令后 Enter 发送  PgUp/Dn 翻页' :
              focusZone === 'sidebar' ? '侧栏  ↑↓ 选择  Enter 确认  Esc/← 切回主区' :
                (logScroll > 0 ? '→ 切到侧栏  ↑ 可滚动  PgUp/Dn 翻页  Home/End 首尾' :
                  quitPending ? '再按 q 确认退出' : '→ 切到侧栏  ↑↓ 菜单  Tab:切换顶栏 PgUp/Dn:日志 q:退出');

  return h(Box, { width: cols, height: rows, flexDirection: 'column', position: 'relative' },

    // Tab bar
    h(Header, { tabs: TABS, activeTab, compact }),

    // Body
    h(Box, { height: viewH, flexDirection: 'row' },

      // Sidebar
      !compact && h(Sidebar, { menuItems, menuFocus, svcStatus, schema: cfgSchema, active: focusZone === 'sidebar' }),

      // Main content (transparent, no background set)
      h(Box, { flexGrow: 1, flexDirection: 'column', paddingLeft: 1, paddingRight: 1 },
        mainContent,
      ),
    ),

    h(Footer, { height: footerH, narrow, inputFocus, inputVal, cursorPos, cursorVisible, hint: footerHint }),

    // Toast overlay (top-right corner)
    toast && h(Box, {
      position: 'absolute',
      top: 1,
      right: 1,
      backgroundColor: ({ success: T.success, warning: T.warning, error: T.error, info: T.primary })[toast.level] || T.success,
      paddingLeft: 1,
      paddingRight: 1,
    },
      h(Text, { color: T.bg, bold: true }, toast.msg),
    ),

    // Help overlay
    helpOpen && h(HelpOverlay, { activeTab, focusZone }),
  );
}

function HelpOverlay({ activeTab, focusZone }) {
  const lines = [
    '╭─ 全局快捷键 ─────────────────────────────────╮',
    '  1-9         切换顶部 Tab',
    '  Tab         循环 Tab',
    '  → / ←       主区 ↔ 侧栏焦点切换',
    '  ↑↓          当前 zone 内导航',
    '  Home/End    当前 zone 首/尾',
    '  PgUp/PgDn   主区日志翻页',
    '  Enter       确认 / 进入编辑',
    '  Esc         退出当前 zone',
    '  Backspace   命令栏删字符 / 退出 zone',
    '  q (双击)    退出面板',
    '  Ctrl+C      退出面板',
    '  ? / h / F1  打开/关闭本帮助',
    '╰───────────────────────────────────────────────╯',
    '',
    `当前焦点: ${focusZone === 'sidebar' ? '侧栏' : '主区'}`,
    `当前 Tab: ${activeTab}`,
    '',
    '按 Esc / ? / h 关闭',
  ];
  return h(Box, {
    position: 'absolute', top: 2, left: 2, flexDirection: 'column', paddingX: 2, paddingY: 1,
    backgroundColor: T.panel, borderStyle: 'round', borderColor: T.borderFocus,
  },
    ...lines.map((l, i) => h(Text, { key: i, color: T.text }, l)),
  );
}

export { App };
