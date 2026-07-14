import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
const h = React.createElement;
import { T } from './theme.js';
import { services, stopAll } from './services/manager.js';
import { logBuf, flushLogs } from './log-buffer.js';
import { useLogs } from './log-buffer-hooks.js';
import { hookMouse } from './mouse.js';
import { pushLog } from './log-buffer.js';
import { Dashboard, SvcView, ConfirmOverlay, MonitorView, ChatView, DbView, ModulesView, ServicesView, SERVICE_ORDER } from './views/views.js';
import { Header, Sidebar, Footer } from './ui/Shell.js';
import { getLayout } from './navigation/rules.js';
import { createGlobalInputHandler } from './navigation/global-handler.js';
import { exec } from 'node:child_process';
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
  const { exit, stdout } = useApp();
  const cols = stdout?.columns || 80;
  const rows = stdout?.rows || 24;
  const { compact, narrow, footerHeight: footerH, viewHeight: viewH, logHeight: logH, logWidth: logW } = getLayout(cols, rows);

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

  function showToast(msg, level) {
    setToast({ msg, level: level || 'info' });
    setTimeout(() => setToast(null), 2500);
  }

  const [confirm, setConfirm] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [quitPending, setQuitPending] = useState(false);
  const quitTimerRef = React.useRef(null);

  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { hookMouse(setLogScroll); }, []);

  const [, resizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => resizeTick(x => x + 1);
    process.stdout.on('resize', onResize);
    return () => process.stdout.removeListener('resize', onResize);
  }, []);

  useEffect(() => { setLogScroll(0); }, [view, svcName, activeTab]);

  const svcStatus = {};
  for (const [k, v] of Object.entries(services)) svcStatus[k] = { running: v.running, pid: v.pid };

  const menuItems = React.useMemo(() => {
    const items = [{ k: 0, l: '退出', act: 'exit' }];
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
    );
    return items;
  }, [view, svcName]);

  function switchTab(tab) {
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
        const run = () => services[svcName][item.act]();
        if (item.act === 'stop' || item.act === 'restart') {
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
    else if (item.act === 'copy_logs') {
      const source = view === 'svc' ? svcName : undefined;
      const entries = source ? logBuf.filter(l => l.source === source) : logBuf;
      const text = entries.map(l => l.text).join('\n');
      const proc = exec('clip', { shell: true });
      proc.stdin.write(text);
      proc.stdin.end();
      showToast('已复制 ✓');
    }
  }

  function checkForUpdate() {
    pushLog('正在检查 BDS 更新...', 'info');
    const child = exec('node BDSTools/check-update.js --check-only', { cwd: process.cwd() });
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

    const handled = createGlobalInputHandler({ input, key, confirm, helpOpen, editing: null, inputVal, isSetupActive: false, setupRequired: false, activeTab, tabs: TABS, quitPending, callbacks: {
      confirm: (current, accepted) => { setConfirm(null); (accepted ? current.onConfirm : current.onCancel)(); },
      quit: (pending) => {
        if (pending) {
          clearTimeout(quitTimerRef.current);
          pushLog('正在停止所有服务...', 'info');
          stopAll().finally(() => { exit(); console.clear(); console.log('BDS Panel 已安全退出，感谢使用(～￣▽￣)～'); });
        } else {
          setQuitPending(true);
          pushLog('再按一次 q 确认退出', 'warning');
          clearTimeout(quitTimerRef.current);
          quitTimerRef.current = setTimeout(() => setQuitPending(false), 3000);
        }
      },
      clearQuitPending: () => { setQuitPending(false); clearTimeout(quitTimerRef.current); },
      forceQuit: () => { pushLog('正在停止所有服务...', 'info'); stopAll().finally(() => { exit(); console.clear(); console.log('BDS Panel 已安全退出，感谢使用(～￣▽￣)'); }); },
      switchTab: (tab) => { switchTab(tab); setMenuFocus(-1); },
      setHelpOpen,
    } });
    if (handled) return;

    if (isEnter && !inputVal.trim() && menuFocus >= 0) {
      doAct(menuItems[menuFocus]?.k); setMenuFocus(-1); return;
    }

    if (key.tab) {
      const idx = TABS.findIndex((t) => t.k === activeTab);
      const next = (idx + 1) % TABS.length;
      switchTab(TABS[next].k);
      setMenuFocus(-1);
      return;
    }

    if (input && !key.ctrl && !key.meta && '123456'.includes(input)) {
      const idx = parseInt(input, 10) - 1;
      if (TABS[idx]) { switchTab(TABS[idx].k); setMenuFocus(-1); return; }
    }

    if (view === 'services' && focusZone !== 'sidebar') return;

    if (view === 'monitor' || view === 'chat' || view === 'data' || view === 'modules') {
      if (key.escape) { setView('dashboard'); setActiveTab('dashboard'); setLogScroll(0); }
      return;
    }

    if (!compact && !inputVal) {
      if (key.rightArrow) { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); return; }
      if (key.leftArrow && focusZone === 'sidebar') { setFocusZone('main'); setMenuFocus(-1); return; }
    }

    if (focusZone === 'sidebar' && !inputVal) {
      if (key.upArrow) { setMenuFocus((f) => { const next = f <= 0 ? menuItems.length - 1 : f - 1; return next < 0 ? 0 : next; }); return; }
      if (key.downArrow) { setMenuFocus((f) => { const next = f >= menuItems.length - 1 ? 0 : f + 1; return next < 0 ? 0 : next; }); return; }
      if (key.home) { setMenuFocus(0); return; }
      if (key.end) { setMenuFocus(menuItems.length - 1); return; }
      if (isEnter && menuFocus >= 0) { const item = menuItems[menuFocus]; if (item) { doAct(item.k); setMenuFocus(-1); return; } }
      if (key.escape) { setFocusZone('main'); setMenuFocus(-1); return; }
      return;
    }

    if (key.escape) {
      if (view === 'svc' && activeTab === 'services') { setView('services'); }
      else { setView('dashboard'); setActiveTab('dashboard'); }
      setLogScroll(0);
      return;
    }

    if (isBksp) {
      if (inputVal && cursorPos > 0) {
        setInputVal((v) => v.slice(0, cursorPos - 1) + v.slice(cursorPos));
        setCursorPos((p) => p - 1);
      }
      return;
    }

    if (isEnter && inputVal.trim()) {
      const raw = inputVal.trim();
      const cmd = raw.toLowerCase();
      setInputVal(''); setCursorPos(0);

      if (cmd === 'start' || cmd === 'stop' || cmd === 'restart') {
        if (view === 'svc' && svcName && services[svcName]) {
          const run = () => services[svcName][cmd]();
          if (cmd === 'stop' || cmd === 'restart') {
            setConfirm({
              title: cmd === 'stop' ? '停止服务' : '重启服务',
              body: [`${services[svcName].title} 将${cmd === 'stop' ? '停止' : '重启'}`, '确定继续?'],
              onConfirm: run,
              onCancel: () => {},
            });
          } else { run(); }
        } else pushLog(`需先通过服务页选择服务`, 'warning');
      } else if (cmd === 'back' || cmd === '0') { switchTab('dashboard'); }
      else if (cmd === 'clear') { logBuf.length = 0; flushLogs(); }
      else if (cmd === 'help') {
        if (view === 'svc' && svcName === 'bds') { services[svcName].send(cmd); }
        if (activeTab === 'dashboard') { pushLog('内置命令: help, start, stop, restart, clear', 'info'); }
        else if (view === 'svc' && svcName === 'llbot') { services[svcName].send(cmd); }
        else if (view === 'svc' && svcName === 'qq') { pushLog('QQ Bridge 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','qq'); }
        else if (view === 'svc' && svcName === 'db') { pushLog('DB Server 命令: help - 本帮助 | reload - 重载配置 | status - 连接状态', 'info','db'); }
        else { pushLog('请先通过 Tab 选择一个服务', 'warning'); }
      } else if (view === 'svc' && svcName && services[svcName]?.running) {
        services[svcName].send(raw);
      } else { pushLog(`未知命令: ${cmd}`, 'warning'); }
      return;
    }

    if (key.pageUp) { setLogScroll((s) => Math.min(logBuf.length, s + Math.floor(viewH / 2))); return; }
    if (key.pageDown) { setLogScroll((s) => Math.max(0, s - Math.floor(viewH / 2))); return; }
    if (key.home) { setLogScroll(logBuf.length); return; }
    if (key.end) { setLogScroll(0); return; }
    if (key.upArrow || key.downArrow) {
      if (view === 'chat' || view === 'data' || view === 'modules') { return; }
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

  const localInputActive = !confirm && !helpOpen;
  const mainContent = confirm
    ? h(ConfirmOverlay, { title: confirm.title, body: confirm.body })
    : view === 'dashboard'
      ? h(Dashboard, { logH, logScroll, logW })
      : view === 'services'
        ? h(ServicesView, {
            focus: serviceFocus,
            logW,
            onOpenService: (name) => { setSvcName(name); setView('svc'); },
            onSidebar: () => { if (!compact) { setFocusZone('sidebar'); setMenuFocus(menuItems.length > 0 ? 0 : -1); } },
            inputActive: localInputActive && focusZone === 'main',
          })
        : view === 'monitor'
          ? h(MonitorView, { logH, logW, inputActive: localInputActive })
          : view === 'modules'
            ? h(ModulesView, { logH, logW, showToast, pushLog, inputActive: localInputActive })
            : view === 'chat'
              ? h(ChatView, { logH, logW, inputActive: localInputActive })
              : view === 'data'
                ? h(DbView, { logH, logW, inputActive: localInputActive })
                : view === 'svc' && svcName
                  ? h(SvcView, { name: svcName, logH, logScroll, logW })
                  : null;

  const footerHint = confirm ? '[y] 确认  [n] 取消' :
    view === 'services' ? '↑↓ 选择服务  Enter 打开  ←/→ 侧栏' :
      view === 'svc' ? 'Esc 返回服务列表  输入命令后 Enter 发送  PgUp/Dn 翻页' :
        focusZone === 'sidebar' ? '侧栏  ↑↓ 选择  Enter 确认  Esc/← 切回主区' :
          (logScroll > 0 ? '→ 切到侧栏  ↑ 可滚动  PgUp/Dn 翻页  Home/End 首尾' :
            quitPending ? '再按 q 确认退出' : '→ 切到侧栏  ↑↓ 菜单  Tab:切换顶栏 PgUp/Dn:日志 q:退出');

  return h(Box, { width: cols, height: rows, flexDirection: 'column', position: 'relative' },
    h(Header, { tabs: TABS, activeTab, compact }),
    h(Box, { height: viewH, flexDirection: 'row' },
      !compact && h(Sidebar, { menuItems, menuFocus, svcStatus, active: focusZone === 'sidebar' }),
      h(Box, { flexGrow: 1, flexDirection: 'column', paddingLeft: 1, paddingRight: 1 },
        mainContent,
      ),
    ),
    h(Footer, { height: footerH, narrow, inputFocus: false, inputVal, cursorPos, cursorVisible, hint: footerHint }),
    toast && h(Box, {
      position: 'absolute', top: 1, right: 1,
      backgroundColor: ({ success: T.success, warning: T.warning, error: T.error, info: T.primary })[toast.level] || T.success,
      paddingLeft: 1, paddingRight: 1,
    }, h(Text, { color: T.bg, bold: true }, toast.msg)),
    helpOpen && h(HelpOverlay, { activeTab, focusZone }),
  );
}

function HelpOverlay({ activeTab, focusZone }) {
  const lines = [
    '╭─ 全局快捷键 ─────────────────────────────────╮',
    '  1-6         切换顶部 Tab',
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
    '', `当前焦点: ${focusZone === 'sidebar' ? '侧栏' : '主区'}`, `当前 Tab: ${activeTab}`, '', '按 Esc / ? / h 关闭',
  ];
  return h(Box, {
    position: 'absolute', top: 2, left: 2, flexDirection: 'column', paddingX: 2, paddingY: 1,
    backgroundColor: T.panel, borderStyle: 'round', borderColor: T.borderFocus,
  }, ...lines.map((l, i) => h(Text, { key: i, color: T.text }, l)));
}

export { App };
