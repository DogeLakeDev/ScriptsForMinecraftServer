import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';

const DB_HOST = '127.0.0.1';
const DB_PORT = 3001;

function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error || `HTTP ${r.status}`);
      err.code = data.error;
      err.detail = data;
      err.status = r.status;
      throw err;
    }
    return data;
  });
}

const ACTION_LABEL = {
  enable: { success: '已启用', busy: '正在启用', level: 'success' },
  disable: { success: '已禁用', busy: '正在禁用', level: 'warning' },
  install: { success: '已安装', busy: '正在安装', level: 'success' },
  uninstall: { success: '已卸载', busy: '正在卸载', level: 'warning' },
};

const ERROR_LABEL = {
  dependency_unmet: (d) => `缺少依赖: ${(d.unmet || []).map((u) => u.id).join(', ')}`,
  dependency_required: (d) => `被依赖中: ${(d.requiredBy || []).join(', ')}`,
  module_cannot_disable: () => '该模块不可禁用',
  module_cannot_uninstall: () => '该模块不可卸载',
  bds_running: () => 'BDS 进程仍在运行，请先停止 BDS',
};

function describeError(err) {
  if (err.code && ERROR_LABEL[err.code]) return ERROR_LABEL[err.code](err.detail || {});
  return err.message || '操作失败';
}

function ModulesView({ logH, logW, showToast, pushLog }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modules, setModules] = useState([]);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const maxRows = Math.max(5, logH + 4);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/modules`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const list = Array.isArray(d.modules) ? d.modules : [];
        setModules(list);
        setFocus((f) => Math.min(f, Math.max(0, list.length - 1)));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const moduleMap = useMemo(() => {
    const map = new Map();
    for (const m of modules) map.set(m.id, m);
    return map;
  }, [modules]);

  function unmetDeps(selected) {
    if (!selected) return [];
    const out = [];
    for (const dep of selected.requires || []) {
      const m = moduleMap.get(dep);
      if (!m || m.installed === false || !m.enabled) out.push(dep);
    }
    return out;
  }

  const selected = modules[focus] || null;
  const missing = unmetDeps(selected);
  const canToggle = !!selected && selected.installed !== false && selected.can_disable && missing.length === 0 && selected.enabled;
  const canEnable = !!selected && selected.installed !== false && selected.can_disable && missing.length === 0 && !selected.enabled;
  const canInstall = !!selected && selected.installed === false;
  const canUninstall = !!selected && selected.can_uninstall && selected.installed !== false;
  const isBdsUpdater = selected?.id === 'tool-bds-updater';

  const visible = useMemo(() => {
    const start = Math.max(0, Math.min(focus - Math.floor(maxRows / 2), Math.max(0, modules.length - maxRows)));
    return { start, rows: modules.slice(start, start + maxRows) };
  }, [modules, focus, maxRows]);

  function notify(level, msg) {
    if (showToast) showToast(msg, level);
    if (pushLog) pushLog(`[模块] ${msg}`, level);
  }

  function run(action) {
    if (!selected || busy) return;

    if (isBdsUpdater && action === 'uninstall') {
      notify('warning', `${selected.display_name || selected.id}: 卸载前请先停止 BDS 进程`);
      if (pushLog) pushLog('可通过 BDS Tab 输入 stop 或面板菜单停止', 'warning');
      return;
    }

    const meta = ACTION_LABEL[action];
    if (!meta) return;

    setBusy(true);
    notify('info,success,error,warning,info'.split(',')[0], `${selected.display_name || selected.id} ${meta.busy}`);
    postJson(`http://${DB_HOST}:${DB_PORT}/api/sfmc/modules/${encodeURIComponent(selected.id)}/${action}`)
      .then((d) => {
        const next = d.module || null;
        if (next) {
          setModules((prev) => prev.map((m) => (m.id === next.id ? next : m)));
        } else {
          load();
        }
        notify(meta.level, `${selected.display_name || selected.id} ${meta.success}`);
      })
      .catch((e) => {
        const msg = describeError(e);
        notify('error', `${selected.display_name || selected.id}: ${msg}`);
      })
      .finally(() => setBusy(false));
  }

  useInput((input, key) => {
    if (loading || busy) return;
    if (key.upArrow) {
      setFocus((f) => (modules.length === 0 ? 0 : (f <= 0 ? modules.length - 1 : f - 1)));
      return;
    }
    if (key.downArrow) {
      setFocus((f) => (modules.length === 0 ? 0 : (f >= modules.length - 1 ? 0 : f + 1)));
      return;
    }
    if (key.home) { setFocus(0); return; }
    if (key.end) { setFocus(Math.max(0, modules.length - 1)); return; }
    if (input === 'r') { load(); return; }
    if (input === 'e' || key.return || key.enter) {
      if (canToggle) run('disable');
      else if (canEnable) run('enable');
      return;
    }
    if (input === 'i') { if (canInstall) run('install'); return; }
    if (input === 'u') { if (canUninstall) run('uninstall'); return; }
    if (input === 'd') {
      setDetail(detail && detail.id === selected?.id ? null : selected ? {
        id: selected.id,
        requires: selected.requires || [],
        optional: selected.optional || [],
        commands: selected.commands || [],
        entry: selected.entry || {},
      } : null);
      return;
    }
  });

  if (loading) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { color: T.muted }, '正在加载模块目录...'),
    );
  }

  if (error) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { color: T.error }, `错误: ${error}`),
      h(Text, { color: T.muted }, '按 r 重新加载'),
    );
  }

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { bold: true, color: T.primary }, `模块目录 (${modules.length})`),
    h(Text, { color: T.muted }, '↑↓ 选择  Enter/e 启用/禁用  i 安装  u 卸载  d 依赖  r 刷新'),
    h(Text, { color: T.separator }, ` ${'─'.repeat(Math.max(10, logW - 1))}`),
    ...visible.rows.map((m, i) => {
      const idx = visible.start + i;
      const state = m.installed === false ? '未安装' : (m.enabled ? '启用' : '禁用');
      const type = m.type || 'feature';
      const color = m.installed === false ? T.error : (m.enabled ? T.success : T.muted);
      return h(Box, { key: m.id, backgroundColor: idx === focus ? T.focusBg : T.panel },
        h(Text, { color: idx === focus ? T.primary : color },
          `${idx === focus ? '→' : ' '} ${m.id} [${type}] ${state}`),
      );
    }),
    selected && h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { bold: true, color: T.primary }, selected.display_name || selected.name || selected.id),
      h(Text, { color: T.text }, selected.description || ''),
      h(Text, { color: T.muted }, `依赖: ${(selected.requires || []).join(', ') || '无'}`),
      missing.length > 0 && h(Text, { color: T.warning }, `未满足依赖: ${missing.join(', ')}`),
      h(Text, { color: T.muted }, `可禁用: ${selected.can_disable ? '是' : '否'}  可卸载: ${selected.can_uninstall ? '是' : '否'}`),
      h(Text, { color: T.muted }, `入口: ${(selected.entry && selected.entry.path) || '-'}`),
      isBdsUpdater && h(Text, { color: T.warning }, '卸载前请先在 BDS Tab 输入 stop'),
      busy && h(Text, { color: T.warning }, '正在提交变更...'),
      detail && detail.id === selected.id && h(Box, { flexDirection: 'column', marginTop: 1 },
        h(Text, { color: T.muted }, '依赖关系:'),
        ...(detail.requires || []).map((dep) => {
          const m = moduleMap.get(dep);
          const ok = m && m.installed !== false && m.enabled;
          return h(Text, { color: ok ? T.success : T.error }, `  - ${dep} [${ok ? '就绪' : '未就绪'}]`);
        }),
        ...(detail.optional || []).map((dep) => {
          const m = moduleMap.get(dep);
          return h(Text, { color: m ? T.muted : T.error }, `  ~ ${dep} [可选]`);
        }),
        (detail.commands || []).length > 0 && h(Text, { color: T.muted }, `命令: ${detail.commands.join(', ')}`),
      ),
    ),
  );
}

export { ModulesView };