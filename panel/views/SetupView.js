/**
 * SetupView.js — 主 TUI 内的 setup 向导 Tab
 *
 * 复用现有面板交互：
 *   - 上下键滚动字段 (↑↓ Home End)
 *   - 数字键直选 + Enter 进入编辑
 *   - Tab 切换步骤 (n/p)
 *   - Enter 在非编辑态提交
 *
 * Props:
 *   showToast(level, msg)
 *   pushLog(text, level)
 *   onComplete()  成功后回调（App 切回 dashboard）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import fs from 'node:fs';
import { T } from '../theme.js';
import { detect, runChecks, submit, reset as resetInit, importState } from '../setup/orchestrator.js';
import { detectServiceStatus } from '../setup/service-install.js';

const I18N = {
  'zh-CN': {
    title: '首次初始化向导',
    steps: ['欢迎', '数据库', '服务路径', '模块选择', '确认'],
    next: '下一步 (n)',
    prev: '上一步 (p)',
    check: '健康检查 (c)',
    submit: '提交 (Enter)',
    reset: '重置状态 (r)',
    importBtn: '导入 panel-state.json (i)',
    editing: '编辑中 (Enter 确认 / Esc 取消)',
    back: '返回 (Esc)',
  },
  en: {
    title: 'First-time Setup Wizard',
    steps: ['Welcome', 'Database', 'Service Paths', 'Modules', 'Confirm'],
    next: 'Next (n)',
    prev: 'Prev (p)',
    check: 'Health Check (c)',
    submit: 'Submit (Enter)',
    reset: 'Reset (r)',
    importBtn: 'Import panel-state.json (i)',
    editing: 'Editing (Enter confirm / Esc cancel)',
    back: 'Back (Esc)',
  },
};

const STEP_FIELDS = [
  // step 0: 欢迎（语言选择）
  [
    { id: 'locale', label: '语言 / Language', kind: 'enum', options: [['zh-CN', '中文'], ['en', 'English']] },
    { id: '_next', label: '→ 进入下一步', kind: 'action' },
  ],
  // step 1: 数据库
  [
    { id: 'paths.dbPort', label: 'DB 端口', kind: 'number', min: 1, max: 65535 },
    { id: 'tokens.dbAuthToken', label: 'DB Auth Token (可选)', kind: 'text' },
    { id: '_check', label: '↻ 健康检查', kind: 'action' },
    { id: '_next', label: '→ 下一步', kind: 'action' },
  ],
  // step 2: 服务路径
  [
    { id: 'paths.bdsPath', label: 'BDS 安装目录 (含 bedrock_server.exe)', kind: 'text' },
    { id: 'paths.llbotPath', label: 'LLBot 可执行文件', kind: 'text' },
    { id: 'paths.llbotCwd', label: 'LLBot 工作目录', kind: 'text' },
    { id: 'tokens.bridgeAuthToken', label: 'Bridge Token (可选)', kind: 'text' },
    { id: '_check', label: '↻ 健康检查', kind: 'action' },
    { id: '_next', label: '→ 下一步', kind: 'action' },
  ],
  // step 3: 模块选择
  [
    { id: 'ui.defaultModules', label: '默认启用模块', kind: 'multi', choices: ['money', 'chat', 'afk', 'land', 'tps', 'online_time', 'activity_log', 'scoreboard_sync', 'spawn_protect', 'chat_sounds', 'holoprint', 'inventory_switcher', 'fly', 'creative', 'survival', 'peace', 'qa', 'clean'] },
    { id: 'ui.defaultServices', label: '默认启用服务', kind: 'multi', choices: ['db', 'qq', 'llbot', 'bds', 'panel'] },
    { id: '_next', label: '→ 下一步', kind: 'action' },
  ],
  // step 4: 确认 + 导入
  [
    { id: 'importPath', label: '导入 panel-state.json 路径 (可选)', kind: 'text' },
    { id: '_import', label: '↻ 从上述路径导入', kind: 'action' },
    { id: '_reset', label: '⚠ 重置真实配置', kind: 'action' },
    { id: '_submit', label: '✓ 提交并完成初始化', kind: 'submit' },
  ],
];

const ALL_FIELDS = STEP_FIELDS.flat();
const FIELD_BY_ID = new Map(ALL_FIELDS.map((f) => [f.id, f]));

function getValue(payload, path) {
  const parts = path.split('.');
  let cur = payload;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
function setValue(payload, path, val) {
  const parts = path.split('.');
  if (parts.length === 1) {
    payload[parts[0]] = val;
    return payload;
  }
  const last = parts.pop();
  let cur = payload;
  for (const p of parts) {
    if (cur[p] == null) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = val;
  return payload;
}

function defaultPayload() {
  return {
    locale: 'zh-CN',
    paths: { bdsPath: 'D:\\Minecraft\\BEServer', llbotPath: 'D:\\LLBot-CLI-win-x64\\llbot.exe', llbotCwd: 'D:\\LLBot-CLI-win-x64', dbPort: 3001 },
    tokens: { dbAuthToken: '', bridgeAuthToken: '' },
    ui: { defaultModules: ['money', 'chat', 'afk', 'land', 'tps'], defaultServices: ['db', 'qq'], skipGuidedSetup: false },
  };
}

export function SetupView({ showToast, pushLog, onComplete, inputActive = true }) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState(0);
  const [editing, setEditing] = useState(null);
  const [editBuf, setEditBuf] = useState('');
  const [editCursor, setEditCursor] = useState(0);
  const [payload, setPayload] = useState(defaultPayload);
  const [importPath, setImportPath] = useState('');
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [multiPicker, setMultiPicker] = useState(null);

  const t = I18N[payload.locale] || I18N['zh-CN'];

  useEffect(() => {
    detect().then((d) => {
      setStatus(d);
      if (d.state) {
        if (d.state.locale) setPayload((p) => ({ ...p, locale: d.state.locale }));
        if (d.state.paths) setPayload((p) => ({ ...p, paths: { ...p.paths, ...d.state.paths } }));
        if (d.state.tokens) setPayload((p) => ({ ...p, tokens: { ...p.tokens, ...d.state.tokens } }));
        if (d.state.ui) setPayload((p) => ({ ...p, ui: { ...p.ui, ...d.state.ui } }));
      }
    });
  }, []);

  const fields = STEP_FIELDS[step];
  const field = fields[focus];
  const serviceStatus = useMemo(() => detectServiceStatus(payload), [payload]);

  function nav(delta) {
    const len = fields.length;
    setFocus((f) => (f + delta + len) % len);
  }

  function doAction(act) {
    if (busy) return;
    if (act === '_next') {
      setStep((s) => Math.min(STEP_FIELDS.length - 1, s + 1));
      setFocus(0);
    } else if (act === '_prev') {
      setStep((s) => Math.max(0, s - 1));
      setFocus(0);
    } else if (act === '_check') {
      doChecks();
    } else if (act === '_submit') {
      doSubmit();
    } else if (act === '_reset') {
      doReset();
    } else if (act === '_import') {
      doImport();
    }
  }

  async function doChecks() {
    setBusy(true);
    const r = await runChecks({
      db: { port: payload.paths.dbPort },
      bds: { path: payload.paths.bdsPath },
      qq: { llbot_path: payload.paths.llbotPath, llbot_cwd: payload.paths.llbotCwd, bridge_auth_token: payload.tokens.bridgeAuthToken },
    });
    setChecks(r.ok ? r.checks : [{ id: 'error', ok: false, label: r.error || 'check failed' }]);
    setBusy(false);
    if (pushLog) pushLog(r.ok ? `[setup] 健康检查 ${r.checks.filter((c) => c.ok).length}/${r.checks.length} 通过` : `[setup] 健康检查失败: ${r.error}`, r.ok ? 'success' : 'error');
  }

  async function doSubmit() {
    setBusy(true);
    const r = await submit(payload);
    setResult(r);
    setBusy(false);
    if (r.ok) {
      if (showToast) showToast('setup 完成', 'success');
      if (pushLog) pushLog('[setup] 初始化完成', 'success');
      setTimeout(() => onComplete?.(), 600);
    } else {
      if (showToast) showToast(`setup 失败: ${r.error}`, 'error');
      if (pushLog) pushLog(`[setup] 失败: ${r.error}`, 'error');
    }
  }

  async function doReset() {
    setBusy(true);
    const r = await resetInit();
    setResult(r);
    setBusy(false);
    if (showToast) showToast('已重置 panel-state', 'warning');
    if (pushLog) pushLog('[setup] panel-state 已重置', 'warning');
  }

  async function doImport() {
    if (!importPath || !fs.existsSync(importPath)) {
      if (showToast) showToast('导入路径不存在', 'error');
      return;
    }
    setBusy(true);
    const r = await importState(importPath);
    setResult(r);
    setBusy(false);
    if (r.ok) {
      if (showToast) showToast('导入成功', 'success');
      if (pushLog) pushLog('[setup] 已导入 panel-state', 'success');
      setTimeout(() => onComplete?.(), 600);
    } else {
      if (showToast) showToast(`导入失败: ${r.error}`, 'error');
    }
  }

  // 文本/数字编辑模式 useInput
  useInput((input, key) => {
    if (!editing) return;
    if (key.return) {
      commitEdit();
      return;
    }
    if (key.escape) {
      setEditBuf(editing === 'importPath' ? importPath : getValue(payload, editing));
      setEditCursor((editBuf || '').length);
      setEditing(null);
      return;
    }
    if (key.leftArrow) { setEditCursor((c) => Math.max(0, c - 1)); return; }
    if (key.rightArrow) { setEditCursor((c) => Math.min((editBuf || '').length, c + 1)); return; }
    if (key.backspace) {
      if (editCursor > 0) {
        const buf = editBuf || '';
        setEditBuf(buf.slice(0, editCursor - 1) + buf.slice(editCursor));
        setEditCursor((c) => c - 1);
      }
      return;
    }
    if (input && !key.ctrl && !key.meta && !/^[<>;]$/.test(input)) {
      const buf = editBuf || '';
      const next = buf.slice(0, editCursor) + input + buf.slice(editCursor);
      setEditBuf(next);
      setEditCursor((c) => c + input.length);
    }
  }, { isActive: inputActive && editing !== null });

  function commitEdit() {
    if (!editing) return;
    const field = FIELD_BY_ID.get(editing);
    let val = editBuf;
    if (field?.kind === 'number') {
      const n = parseInt(val, 10);
      val = isNaN(n) ? 3001 : n;
    }
    if (editing === 'importPath') {
      setImportPath(String(val));
      setEditing(null);
      return;
    }
    setPayload((p) => {
      const next = JSON.parse(JSON.stringify(p));
      setValue(next, editing, val);
      return next;
    });
    setEditing(null);
  }

  // 主导航 useInput（非编辑态）
  useInput((input, key) => {
    if (editing) return;
    if (busy) return;
    if (multiPicker) {
      const choices = multiPicker.choices;
      if (key.upArrow) { setMultiPicker((p) => ({ ...p, focus: Math.max(0, p.focus - 1) })); return; }
      if (key.downArrow) { setMultiPicker((p) => ({ ...p, focus: Math.min(choices.length - 1, p.focus + 1) })); return; }
      if (key.escape) { setMultiPicker(null); return; }
      if (key.return) {
        const choice = choices[multiPicker.focus];
        setPayload((p) => {
          const next = JSON.parse(JSON.stringify(p));
          const selected = new Set(getValue(next, multiPicker.id) || []);
          if (selected.has(choice)) selected.delete(choice); else selected.add(choice);
          setValue(next, multiPicker.id, [...selected]);
          return next;
        });
        return;
      }
      if (input === ' ') { return; }
      return;
    }
    if (key.upArrow) { nav(-1); return; }
    if (key.downArrow) { nav(1); return; }
    if (key.home) { setFocus(0); return; }
    if (key.end) { setFocus(fields.length - 1); return; }
    if (input === 'p') { doAction('_prev'); return; }
    if (input === 'n') { doAction('_next'); return; }
    if (input === 'c') { doAction('_check'); return; }
    if (input === 'r') { doAction('_reset'); return; }
    if (input === 'i') { doAction('_import'); return; }
    if (key.return) {
      const f = fields[focus];
      if (!f) return;
      if (f.kind === 'action' || f.kind === 'submit') {
        doAction(f.id);
      } else if (f.kind === 'enum') {
        // 切换 enum
        setPayload((p) => {
          const cur = getValue(p, f.id);
          const idx = f.options.findIndex((o) => o[0] === cur);
          const next = f.options[(idx + 1) % f.options.length][0];
          const np = JSON.parse(JSON.stringify(p));
          setValue(np, f.id, next);
          return np;
        });
      } else if (f.kind === 'multi') {
        setMultiPicker({ id: f.id, label: f.label, choices: f.choices, focus: 0 });
      } else {
        // text/number → 进入编辑
        const cur = f.id === 'importPath' ? importPath : getValue(payload, f.id);
        const s = cur == null ? '' : String(cur);
        setEditBuf(s);
        setEditCursor(s.length);
        setEditing(f.id);
      }
      return;
    }
  }, { isActive: inputActive && editing === null });

  // ── 渲染 ──
  const stepBars = STEP_FIELDS.map((_, i) => i === step ? '●' : '○').join(' ');
  const w = 60;
  return h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1 },
    h(Text, { bold: true, color: T.primary }, `${t.title}  [${payload.locale}]  步骤 ${step + 1}/${STEP_FIELDS.length}: ${t.steps[step]}`),
    h(Text, { color: T.muted }, stepBars),
    h(Text, { color: T.muted }, '─'.repeat(w)),
    multiPicker
      ? h(Box, { flexDirection: 'column' },
          h(Text, { color: T.primary, bold: true }, `选择 ${multiPicker.label}（Enter 勾选，Esc 返回）`),
          ...multiPicker.choices.map((choice, i) => {
            const selected = (getValue(payload, multiPicker.id) || []).includes(choice);
            return h(Text, { key: choice, color: i === multiPicker.focus ? T.primary : T.text },
              `${i === multiPicker.focus ? '▶' : ' '} ${selected ? '[x]' : '[ ]'} ${choice}`);
          }),
        )
      : fields.map((f, i) => renderField(f, i, focus, editing, editBuf, editCursor, payload, importPath, setImportPath, t)),
    h(Text, { color: T.muted }, '─'.repeat(w)),
    h(Text, { color: T.muted }, '快捷键: ↑↓ 滚动  Enter 选择/编辑  n/p 步骤  c 检查  r 重置  i 导入'),
    status?.reason === 'db_offline' && h(Text, { color: T.warning }, '⚠ db-server 未可达，健康检查可能失败'),
    busy && h(Text, { color: T.warning }, '... 处理中'),
    checks.length > 0 && h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { color: T.muted }, '健康检查:'),
      ...checks.map((c) => h(Text, { color: c.ok ? T.success : T.error }, `  ${c.ok ? '√' : '×'} ${c.label}`)),
    ),
    result && (result.ok
      ? h(Text, { color: T.success }, `OK: 写入 ${(result.written || []).join(', ')}`)
      : h(Text, { color: T.error }, `ERROR: ${result.error}`)),
  );
}

function renderField(f, i, focus, editing, editBuf, editCursor, payload, importPath, setImportPath, t) {
  const isFocus = i === focus;
  const isEditing = editing === f.id;
  const prefix = isFocus ? '▶' : ' ';
  const valueColor = isFocus ? T.primary : T.text;

  if (f.kind === 'action' || f.kind === 'submit') {
    return h(Text, { key: f.id, color: isFocus ? T.success : T.muted, bold: isFocus },
      `${prefix} ${f.label}${isFocus ? '  (' + (f.kind === 'submit' ? '提交' : '回车') + ')' : ''}`);
  }

  let valDisplay;
  let valColor = valueColor;
  if (f.kind === 'enum') {
    const cur = getValue(payload, f.id);
    const found = f.options.find((o) => o[0] === cur);
    valDisplay = found ? found[1] : cur;
    if (isFocus) valColor = T.warning;
  } else if (f.kind === 'multi') {
    const cur = (getValue(payload, f.id) || []);
    valDisplay = cur.length ? cur.join(', ') : '(none)';
    if (isFocus) valColor = T.warning;
  } else {
    let cur;
    if (f.id === 'importPath') cur = importPath;
    else cur = getValue(payload, f.id);
    valDisplay = cur == null || cur === '' ? '<empty>' : String(cur);
    if (isFocus && !isEditing) valColor = T.warning;
  }

  if (isEditing) {
    return h(Box, { key: f.id, flexDirection: 'column' },
      h(Text, { color: T.primary, bold: true }, `${prefix} ${f.label}`),
      h(Text, { color: T.success }, `  > ${editBuf.slice(0, editCursor)}█${editBuf.slice(editCursor)}`),
      h(Text, { color: T.muted }, `  (${t.editing})`),
    );
  }

  return h(Text, { key: f.id, color: valColor },
    `${prefix} ${f.label}: ${valDisplay}${isFocus && f.kind !== 'action' && f.kind !== 'submit' ? '  [Enter]' : ''}`);
}
