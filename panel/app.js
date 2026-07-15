import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
const h = React.createElement;
import { T } from './theme.js';
import { services, stopAll } from './services/manager.js';
import { logBuf, flushLogs } from './log-buffer.js';
import { useLogs } from './log-buffer-hooks.js';
import { hookMouse, enableMouse, disableMouse, registerHitRegion, clearHitRegions, consumeLastClick } from './mouse.js';
import { pushLog } from './log-buffer.js';
import { Dashboard, SvcView, ConfirmOverlay, MonitorView, ChatView, DbView, ModulesView, ServicesView, SERVICE_ORDER } from './views/views.js';
import { Header, Sidebar, Footer } from './ui/Shell.js';
import { KeyHint, Crumb } from './ui/Feedback.js';
import { getLayout, canSwitchTab, requiresConfirmation, canUseTabShortcut } from './navigation/rules.js';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const TABS = [
  { k: 'dashboard', l: '总览' },
  { k: 'services', l: '服务' },
  { k: 'monitor', l: '监控' },
  { k: 'modules', l: '模块' },
  { k: 'chat', l: '频道' },
  { k: 'data', l: '数据' },
];

function App({ initialSetupRequired = null } = {}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;
  const rows = stdout?.rows || 24;
  const { compact, narrow, sidebarWidth, footerHeight: footerH, viewHeight: viewH, logHeight: logH, logWidth: logW } = getLayout(cols, rows);

  const [setupRequired, setSetupRequired] = useState(initialSetupRequired);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState('dashboard');
  const [svcName, setSvcName] = useState(null);
  const [serviceFocus, setServiceFocus] = useState(0);
  const [focusZone, setFocusZone] = useState('main');
  const [menuFocus, setMenuFocus] = useState(-1);
  const [logScroll, setLogScroll] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimerRef = React.useRef(null);
  const quitTimerRef = React.useRef(null);

  function showToast(msg, level) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, level: level || 'info' });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  }

  React.useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (quitTimerRef.current) clearTimeout(quitTimerRef.current);
  }, []);

  const [confirm, setConfirm] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [quitPending, setQuitPending] = useState(false);
  const [viewZone, setViewZone] = useState({ consumesDigits: false });
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (initialSetupRequired !== null) setSetupRequired(initialSetupRequired);
  }, [initialSetupRequired]);

  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { hookMouse(setLogScroll); }, []);
  useEffect(() => {
    enableMouse();
    return () => { disableMouse(); };
  }, []);
  // clear hit regions each frame so transient components re-register
  useEffect(() => { clearHitRegions(); });

  const [, resizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => resizeTick(x => x + 1);
    process.stdout.on('resize', onResize);
    return () => process.stdout.removeListener('resize', onResize);
  }, []);

  useEffect(() => { setLogScroll(0); }, [view, svcName]);

  const svcStatus = {};
  for (const [k, v] of Object.entries(services)) svcStatus[k] = { running: v.running, pid: v.pid };

  const menuItems = React.useMemo(() => {
    const items = [];
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
      { k: 7, l: '模块管理', act: 'modules' },
      { k: -1, l: '', act: 'separator' },
      { k: 6, l: '复制日志', act: 'copy_logs' },
      { k: 0, l: '退出', act: 'exit' },
    );
    return items;
  }, [view, svcName]);

  function switchTab(tab) {
    if (!canSwitchTab(setupRequired, tab)) return;
    setActiveTab(tab);
    setFocusZone('main');
    setMenuFocus(-1);
    setSvcName(null);
    if (tab === 'dashboard') setView('dashboard');
    else if (tab === 'services') setView('services');
    else if (tab === 'monitor') setView('monitor');
    else if (tab === 'modules') setView('modules');
    else if (tab === 'chat') setView('chat');
    else if (tab === 'data') setView('data');
  }

  function doAct(num) {
    const item = menuItems.find((m) => m.k === num);
    if (!item) return;
    if (item.act === 'exit') { stopAll().finally(() => { exit(); console.clear(); }); }
    else if (item.act === 'home') { switchTab('dashboard'); }
    else if (item.act === 'start' || item.act === 'stop' || item.act === 'restart') {
      if (svcName && services[svcName]) {
        const run = () => {
          if (actionBusy) return;
          setActionBusy(true);
          pushLog(`${services[svcName].title}: ${item.act === 'start' ? '启动' : item.act === 'stop' ? '停止' : '重启'}中...`, 'info');
          Promise.resolve(services[svcName][item.act]())
            .then(() => pushLog(`${services[svcName].title}: 操作完成`, 'success'))
            .catch((error) => pushLog(`${services[svcName].title}: ${error.message}`, 'error'))
            .finally(() => setActionBusy(false));
        };
        if (requiresConfirmation(item.act)) {
          setConfirm({
            title: item.act === 'stop' ? '停止服务' : '重启服务',
            body: [`${services[svcName].title} 将${item.act === 'stop' ? '停止' : '重启'}`, '确定继续?'],
            onConfirm: run,
            onCancel: () => {},
          });
        } else { run(); }
      } else pushLog(`未选择服务`, 'warning');
    }
    else if (item.act === 'check_update') { checkForUpdate(); }
    else if (item.act === 'modules') { switchTab('modules'); setFocusZone('main'); }
    else if (item.act === 'copy_logs') {
      const source = view === 'svc' ? svcName : undefined;
      const entries = source ? logBuf.filter(l => l.source === source) : logBuf;
      const text = entries.map(l => l.text).join('\n');
      const proc = spawn('clip', { shell: true });
      proc.stdin.write(text);
      proc.stdin.end();
      showToast('已复制 ✓');
    }
  }

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
      const lines = logBuf.map((x) => x.text);
      const cur = lines.find((l) => l.includes('当前版本'));
      const lat = lines.find((l) => l.includes('发现新版本: '));
      const found = lines.find((l) => l.includes('无需更新'));
      const no = lines.find((l) => l.includes('未找到'));
      if (no) pushLog('获取更新数据失败', 'error');
      else if (!found && lat) {
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
      } else pushLog(`已是最新版本`, 'success');
    });
  }

  useInput((input, key) => {
    const isEnter = key.return || key.name === 'return' || key.name === 'enter';
    const isBksp = key.backspace || key.name === 'backspace';
    const isEsc = key.escape || key.name === 'escape';

    // ── 确认框 ──
    if (confirm) {
      if (input === 'y') { const c = confirm; setConfirm(null); c.onConfirm(); }
      else if (input === 'n' || isEsc) { const c = confirm; setConfirm(null); c.onCancel(); }
      return;
    }

    // ── 帮助 ──
    if (helpOpen) {
      if (isEsc || input === '?' || input === 'h') setHelpOpen(false);
      return;
    }

    // ── Ctrl+C / q 退出 ──
    if (key.ctrl && input === 'c') { stopAll().finally(() => { exit(); console.clear(); }); return; }
    if (input === 'q' && !inputVal) {
      setConfirm({ title: '退出面板', body: ['确定退出 BDS Panel？所有服务将停止。'], onConfirm: () => { pushLog('正在停止所有服务...', 'info'); stopAll().finally(() => { exit(); console.clear(); }); }, onCancel: () => {} });
      return;
    }

    // ── 顶栏 Tab 切换（全屏页也可用，避免困在监控/数据里） ──
    if (key.tab) {
      const idx = TABS.findIndex((t) => t.k === activeTab);
      switchTab(TABS[(idx + 1) % TABS.length].k);
      setMenuFocus(-1);
      return;
    }
    if (input && !key.ctrl && !key.meta && '123456789'.includes(input)) {
      if (viewZone.consumesDigits) {
        // 让 view 自己接收数字
      } else if (canUseTabShortcut(inputVal, view)) {
        const idx = parseInt(input, 10) - 1;
        if (TABS[idx]) { switchTab(TABS[idx].k); setMenuFocus(-1); return; }
      }
    }

    // ── 帮助 ──
    if ((input === '?' || input === 'h' || key.name === 'f1') && !inputVal) { setHelpOpen(true); return; }

    // ── 全屏工作区：Esc 返回总览；其余键交给子 view ──
    if (view === 'monitor' || view === 'chat' || view === 'data' || view === 'modules') {
      if (isEsc) {
        setView('dashboard');
        setActiveTab('dashboard');
        setLogScroll(0);
        setFocusZone('main');
        setMenuFocus(-1);
      }
      return;
    }

    // ── ← → 焦点区域切换 ──
    if (!compact && !inputVal) {
      if (key.rightArrow && focusZone === 'main') { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); return; }
      if (key.leftArrow && focusZone === 'sidebar') { setFocusZone('main'); setMenuFocus(-1); return; }
    }

    // ── 侧栏焦点 ──
    if (focusZone === 'sidebar' && !inputVal) {
      if (key.upArrow) { setMenuFocus((f) => (f <= 0 ? menuItems.length - 1 : f - 1)); return; }
      if (key.downArrow) { setMenuFocus((f) => (f >= menuItems.length - 1 ? 0 : f + 1)); return; }
      if (key.home) { setMenuFocus(0); return; }
      if (key.end) { setMenuFocus(menuItems.length - 1); return; }
      if (isEnter && menuFocus >= 0) { const item = menuItems[menuFocus]; if (item) { doAct(item.k); setMenuFocus(-1); } return; }
      if (isEsc) { setFocusZone('main'); setMenuFocus(-1); return; }
      return;
    }

    // ── Esc 双击退出（首页按两次 Esc） ──
    if (isEsc) {
      if (view === 'svc' && activeTab === 'services') { setView('services'); return; }
      if (view === 'dashboard' && activeTab === 'dashboard') {
        if (quitPending) {
          clearTimeout(quitTimerRef.current);
          pushLog('正在停止所有服务...', 'info');
          stopAll().finally(() => { exit(); console.clear(); });
        } else {
          setQuitPending(true);
          pushLog('再按一次 Esc 确认退出', 'warning');
          clearTimeout(quitTimerRef.current);
          quitTimerRef.current = setTimeout(() => setQuitPending(false), 3000);
        }
        return;
      }
      setView('dashboard'); setActiveTab('dashboard'); setLogScroll(0);
      return;
    }

    // ── 日志滚动 ──
    if (key.pageUp) { setLogScroll((s) => Math.min(logBuf.length, s + Math.floor(viewH / 2))); return; }
    if (key.pageDown) { setLogScroll((s) => Math.max(0, s - Math.floor(viewH / 2))); return; }
    if (key.home) { setLogScroll(logBuf.length); return; }
    if (key.end) { setLogScroll(0); return; }

    // ── 主区 ↑↓ 导航 ──
    if (key.upArrow || key.downArrow) {
      if (view === 'chat' || view === 'data' || view === 'modules' || view === 'services') return;
      if (key.upArrow) { setMenuFocus((f) => (f <= 0 ? menuItems.length - 1 : f - 1)); return; }
      if (key.downArrow) { setMenuFocus((f) => (f >= menuItems.length - 1 ? 0 : f + 1)); return; }
    }

    // ── Enter 确认 ──
    if (isEnter && !inputVal.trim() && menuFocus >= 0) { doAct(menuItems[menuFocus]?.k); setMenuFocus(-1); return; }

    // ── 输入栏 ──
    if (isBksp) {
      if (inputVal && cursorPos > 0) { setInputVal((v) => v.slice(0, cursorPos - 1) + v.slice(cursorPos)); setCursorPos((p) => p - 1); }
      return;
    }

    if (isEnter && inputVal.trim()) {
      const raw = inputVal.trim();
      const cmd = raw.toLowerCase();
      setInputVal(''); setCursorPos(0);

      if (cmd === 'start' || cmd === 'stop' || cmd === 'restart') {
        if (view === 'svc' && svcName && services[svcName]) {
          const run = () => services[svcName][cmd]();
          if (requiresConfirmation(cmd)) setConfirm({ title: cmd === 'stop' ? '停止服务' : '重启服务', body: [`${services[svcName].title} 将${cmd === 'stop' ? '停止' : '重启'}`, '确定继续?'], onConfirm: run, onCancel: () => {} });
          else run();
        } else pushLog(`需先通过服务页选择服务`, 'warning');
      } else if (cmd === 'back' || cmd === '0') { switchTab('dashboard'); }
      else if (cmd === 'clear') { logBuf.length = 0; flushLogs(); }
      else if (view === 'svc' && svcName && services[svcName]?.running) services[svcName].send(raw);
      else pushLog(`未知命令: ${cmd}`, 'warning');
      return;
    }

    // ── 输入字符 ──
    if (key.leftArrow && focusZone === 'main') { setCursorPos((p) => Math.max(0, p - 1)); return; }
    if (key.rightArrow && focusZone === 'main') { setCursorPos((p) => Math.min(inputVal.length, p + 1)); return; }
    if (input && !key.ctrl && !key.meta && !/^[<>;]$/.test(input)) {
      setInputVal((v) => v.slice(0, cursorPos) + input + v.slice(cursorPos));
      setCursorPos((p) => p + input.length);
    }
  });

  const localInputActive = !confirm && !helpOpen;
  const mainContent = confirm
    ? h(Box, { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
        h(ConfirmOverlay, { title: confirm.title, body: confirm.body }),
      )
    : view === 'dashboard'
      ? h(Dashboard, { logH, logScroll, logW, setupRequired })
      : view === 'services'
        ? h(ServicesView, {
            focus: serviceFocus,
            logW,
            onOpenService: (name) => { setSvcName(name); setView('svc'); },
            onSidebar: () => { if (!compact) { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); } },
            inputActive: localInputActive && focusZone === 'main',
            registerZone: setViewZone,
          })
        : view === 'monitor'
          ? h(MonitorView, { logH, logW, inputActive: localInputActive, registerZone: setViewZone })
          : view === 'modules'
            ? h(ModulesView, {
                logH, logW, showToast, pushLog, inputActive: localInputActive,
                requestConfirm: (title, body, run) => setConfirm({ title, body, onConfirm: () => run(), onCancel: () => {} }),
                registerZone: setViewZone,
              })
            : view === 'chat'
              ? h(ChatView, { logH, logW, inputActive: localInputActive, registerZone: setViewZone })
              : view === 'data'
                ? h(DbView, { logH, logW, inputActive: localInputActive, registerZone: setViewZone })
                : view === 'svc' && svcName
                  ? h(SvcView, { name: svcName, logH, logScroll, logW })
                  : null;

  const tabLabel = TABS.find((t) => t.k === activeTab)?.l || activeTab;
  const crumbParts = [tabLabel];
  if (view === 'svc' && svcName) crumbParts.push(services[svcName]?.title || svcName);
  if (focusZone === 'sidebar') crumbParts.push('动作');
  if (confirm) crumbParts.push('确认');
  if (helpOpen) crumbParts.push('帮助');

  const footerHintKeys = confirm
    ? [{ key: 'y', label: '确认' }, { key: 'n/Esc', label: '取消' }]
    : helpOpen
      ? [{ key: 'Esc', label: '关闭帮助' }]
      : actionBusy
        ? [{ key: '…', label: '服务操作进行中' }]
        : view === 'monitor'
          ? [{ key: '↑↓', label: '玩家表' }, { key: 'PgUp/Dn', label: '翻页' }, { key: 'Esc', label: '返回' }, { key: 'Tab', label: '切页' }, { key: '?', label: '帮助' }]
          : view === 'chat'
            ? [{ key: '←→', label: '频道/消息' }, { key: '↑↓', label: '滚动' }, { key: 'l', label: '跟随' }, { key: 'Esc', label: '返回' }, { key: 'Tab', label: '切页' }]
            : view === 'data'
              ? [{ key: '数字+Enter', label: '开表' }, { key: 'r', label: '刷新' }, { key: 'Esc', label: '返回' }, { key: 'Tab', label: '切页' }]
              : view === 'modules'
                ? [{ key: '↑↓', label: '选择' }, { key: 'Enter', label: '启停' }, { key: '/', label: '搜索' }, { key: 'f', label: '筛选' }, { key: 'Esc', label: '返回' }]
                : view === 'services'
                  ? [{ key: '↑↓', label: '选服务' }, { key: 'Enter', label: '打开' }, { key: '→', label: '动作' }, { key: '1-6', label: '切页' }, { key: '?', label: '帮助' }]
                  : view === 'svc'
                    ? [{ key: 'Esc', label: '返回列表' }, { key: '→', label: '动作' }, { key: '输入+Enter', label: '发命令' }, { key: 'PgUp/Dn', label: '日志' }]
                    : focusZone === 'sidebar'
                      ? [{ key: '↑↓', label: '选动作' }, { key: 'Enter', label: '执行' }, { key: '←', label: '主区' }, { key: 'Esc', label: '主区' }]
                      : quitPending
                        ? [{ key: 'Esc', label: '再按一次退出 (3s)' }]
                        : logScroll > 0
                          ? [{ key: 'PgUp/Dn', label: '日志' }, { key: 'Home/End', label: '首尾' }, { key: '→', label: '动作' }, { key: 'q', label: '退出' }, { key: '?', label: '帮助' }]
                          : [{ key: 'Tab/1-6', label: '切页' }, { key: '→', label: '动作' }, { key: 'PgUp/Dn', label: '日志' }, { key: 'q', label: '退出' }, { key: '?', label: '帮助' }];

  return h(Box, { width: cols, height: rows, flexDirection: 'column' },
    h(Header, { tabs: TABS, activeTab, compact, svcStatus, onSwitchTab: (k) => switchTab(k) }),
    h(Box, { height: viewH, flexDirection: 'row' },
      !compact && h(Sidebar, {
        tabs: TABS, activeTab, menuItems, menuFocus, sidebarWidth,
        onSwitchTab: (k) => switchTab(k),
        onDoAct: (k) => doAct(k),
      }),
      h(Box, { flexGrow: 1, flexDirection: 'column', paddingLeft: 1, paddingRight: 1 },
        mainContent,
      ),
    ),
    h(Footer, {
      height: footerH,
      narrow,
      inputFocus: Boolean(inputVal) || view === 'svc',
      inputVal,
      cursorPos,
      cursorVisible,
      hintEl: h(KeyHint, { keys: footerHintKeys }),
      crumbEl: h(Crumb, { parts: crumbParts }),
    }),
    toast && h(Box, {
      position: 'absolute', top: 2, right: 2,
      backgroundColor: ({ success: T.success, warning: T.warning, error: T.error, info: T.primary })[toast.level] || T.success,
      paddingLeft: 1, paddingRight: 1,
    }, h(Text, { color: T.bg, bold: true }, toast.msg)),
    helpOpen && h(HelpOverlay, { tabs: TABS, activeTab, focusZone, view }),
  );
}

function HelpOverlay({ tabs, activeTab, focusZone, view }) {
  const tabHints = tabs.map((tab, i) => `  ${i + 1}  ${tab.l}`).join('\n');
  const lines = [
    '┌ 快捷键 ────────────────────────────────────┐',
    tabHints,
    '  Tab     下一页',
    '  → ←     主区 ↔ 动作侧栏',
    '  ↑ ↓     列表导航',
    '  Esc     返回 / 关弹层',
    '  q       退出确认',
    '  ? h F1  本帮助',
    '└────────────────────────────────────────────┘',
    '',
    `位置: ${activeTab}${view !== activeTab ? ` / ${view}` : ''} · ${focusZone === 'sidebar' ? '侧栏' : '主区'}`,
    'Esc 关闭',
  ];
  return h(Box, {
    position: 'absolute', top: 2, left: 2, flexDirection: 'column', paddingX: 2, paddingY: 1,
    backgroundColor: T.panel, borderStyle: 'round', borderColor: T.borderFocus,
  }, ...lines.map((l, i) => h(Text, { key: i, color: T.text }, l)));
}

export { App };
