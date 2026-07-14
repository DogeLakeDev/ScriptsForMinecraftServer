import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';
import { getJson, postJson as postRequest } from '../api/client.js';
import { SectionTitle, StatusLine } from '../ui/Feedback.js';
import { ScrollBar } from '../ui/ScrollBar.js';

const ACTION_LABEL = {
  enable: { success: '已启用', busy: '正在启用', level: 'success' },
  disable: { success: '已禁用', busy: '正在禁用', level: 'warning' },
};

const ERROR_LABEL = {
  dependency_unmet: (d) => `缺少依赖: ${(d.unmet || []).map((u) => u.id).join(', ')}`,
  module_cannot_disable: () => '该模块不可禁用',
};

function describeError(err) {
  if (err.code && ERROR_LABEL[err.code]) return ERROR_LABEL[err.code](err.detail || {});
  return err.message || '操作失败';
}

function ModulesView({ logH, logW, showToast, pushLog, inputActive = true, requestConfirm }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modules, setModules] = useState([]);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const maxRows = Math.max(5, logH + 4);
  const listRows = Math.max(3, Math.min(maxRows, logH));

  function load() {
    setLoading(true);
    setError(null);
    getJson('/api/sfmc/modules')
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
      if (!m || !m.enabled) out.push(dep);
    }
    return out;
  }

  const filteredModules = useMemo(() => modules.filter((module) => {
    const matchesFilter = filter === 'all' ||
      (filter === 'enabled' && module.enabled) ||
      (filter === 'disabled' && !module.enabled);
    const needle = query.trim().toLowerCase();
    return matchesFilter && (!needle || `${module.id} ${module.display_name || ''} ${module.description || ''}`.toLowerCase().includes(needle));
  }), [modules, filter, query]);
  useEffect(() => {
    setFocus((current) => Math.min(current, Math.max(0, filteredModules.length - 1)));
  }, [filteredModules.length]);
  const selected = filteredModules[focus] || null;
  const missing = unmetDeps(selected);
  const canToggle = !!selected && selected.can_disable && selected.enabled;
  const canEnable = !!selected && missing.length === 0 && !selected.enabled;

  const visible = useMemo(() => {
    const start = Math.max(0, Math.min(focus - Math.floor(listRows / 2), Math.max(0, filteredModules.length - listRows)));
    return { start, rows: filteredModules.slice(start, start + listRows) };
  }, [filteredModules, focus, listRows]);

  function notify(level, msg) {
    if (showToast) showToast(msg, level);
    if (pushLog) pushLog(`[模块] ${msg}`, level);
  }

  function run(action) {
    if (!selected || busy) return;

    const meta = ACTION_LABEL[action];
    if (!meta) return;

    setBusy(true);
    notify('info', `${selected.display_name || selected.id} ${meta.busy}`);
    postRequest(`/api/sfmc/modules/${encodeURIComponent(selected.id)}/${action}`)
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
    if (searching) {
      if (key.escape || key.return) { setSearching(false); return; }
      if (key.backspace) { setQuery((value) => value.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setQuery((value) => value + input);
      return;
    }
    if (key.upArrow) {
      setFocus((f) => (filteredModules.length === 0 ? 0 : (f <= 0 ? filteredModules.length - 1 : f - 1)));
      return;
    }
    if (key.downArrow) {
      setFocus((f) => (filteredModules.length === 0 ? 0 : (f >= filteredModules.length - 1 ? 0 : f + 1)));
      return;
    }
    if (key.home) { setFocus(0); return; }
    if (key.end) { setFocus(Math.max(0, filteredModules.length - 1)); return; }
    if (input === 'r') { load(); return; }
    if (input === 'f') {
      const order = ['all', 'enabled', 'disabled'];
      setFilter((value) => order[(order.indexOf(value) + 1) % order.length]);
      setFocus(0);
      return;
    }
    if (input === '/') { setSearching(true); return; }
    if (input === 'e' || key.return || key.enter) {
      if (!requestConfirm) {
        notify('error', '确认通道未连接，无法切换模块');
        return;
      }
      if (canToggle) requestConfirm('禁用模块', [`${selected.display_name || selected.id} 将被禁用`, '确定继续?'], () => run('disable'));
      else if (canEnable) {
        const depWarn = missing.length > 0 ? [`未满足依赖: ${missing.join(', ')}`] : [];
        requestConfirm('启用模块', [`${selected.display_name || selected.id} 将被启用`, ...depWarn, '确定继续?'], () => run('enable'));
      }
      return;
    }
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
  }, { isActive: inputActive });

  if (loading) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(StatusLine, { kind: 'loading' }, '正在加载模块目录...'),
    );
  }

  if (error) {
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(StatusLine, { kind: 'error' }, `无法加载模块目录: ${error}`),
      h(Text, { color: T.muted }, '按 r 重新加载'),
    );
  }

  const listLines = visible.rows.map((m, i) => {
    const idx = visible.start + i;
    const state = m.enabled ? '启用' : '禁用';
    const type = m.type || 'feature';
    const color = m.enabled ? T.success : T.muted;
    return h(Box, { key: m.id, backgroundColor: idx === focus ? T.focusBg : T.panel },
      h(Text, { color: idx === focus ? T.primary : color }, `${idx === focus ? '→' : ' '} ${m.id} [${type}] ${state}`),
    );
  });
  const details = selected ? h(Box, { flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, color: T.primary }, selected.display_name || selected.name || selected.id),
    h(Text, { color: T.text }, selected.description || ''),
    h(Text, { color: T.muted }, `依赖: ${(selected.requires || []).join(', ') || '无'}`),
    missing.length > 0 && h(Text, { color: T.warning }, `未满足依赖: ${missing.join(', ')}`),
    h(Text, { color: T.muted }, `可禁用: ${selected.can_disable ? '是' : '否'}  入口: ${(selected.entry && selected.entry.path) || '-'}`),
    busy && h(Text, { color: T.warning }, '正在提交变更...'),
    detail && detail.id === selected.id && h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { color: T.muted }, '依赖关系:'),
      ...(detail.requires || []).map((dep) => {
        const dependency = moduleMap.get(dep);
        const ready = dependency && dependency.enabled;
        return h(Text, { key: dep, color: ready ? T.success : T.error }, `  - ${dep} [${ready ? '就绪' : '未就绪'}]`);
      }),
      ...(detail.optional || []).map((dep) => h(Text, { key: `optional-${dep}`, color: T.muted }, `  ~ ${dep} [可选]`)),
    ),
  ) : h(StatusLine, { kind: 'empty' }, '请选择模块');
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(SectionTitle, { detail: `${filteredModules.length}/${modules.length}` }, '模块目录'),
    h(Text, { color: searching ? T.primary : T.muted },
      searching ? `搜索: ${query}█  Enter/Esc完成` : `筛选: ${filter}  ↑↓选择 Enter/e切换 d依赖 f筛选 /搜索 r刷新`),
    h(Box, { height: listRows, flexDirection: 'column' }, filteredModules.length ? listLines : h(StatusLine, { kind: 'empty' }, '没有匹配当前筛选条件的模块')),
    h(ScrollBar, { total: filteredModules.length, viewport: listRows, offset: visible.start, height: listRows }),
    details,
  );
}

export { ModulesView };
