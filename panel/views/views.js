/**
 * views/index.js — 四个视图组件: Dashboard / SvcView / CfgList / CfgEdit
 */
import React, { memo } from 'react';
import { Box, Text } from 'ink';
const h = React.createElement;
import { T, LEVEL_COLOR } from '../theme.js';
import { useLogs } from '../log-buffer-hooks.js';
import { services } from '../services/manager.js';
import { SectionTitle } from '../ui/Feedback.js';
import { ScrollBar } from '../ui/ScrollBar.js';

const LogBlock = memo(function LogBlock({ all, startIdx, logW, height, total, offset }) {
  return h(Box, { height, flexDirection: 'row' },
    h(Box, { flexDirection: 'column', width: Math.max(1, logW - 2) },
      ...all.map((line, i) => h(Text, { key: startIdx + i, color: LEVEL_COLOR[line.level] || T.text },
        logW ? line.text.slice(0, logW - 2) : line.text)),
    ),
    h(Box, { width: 1, flexDirection: 'column' }, h(ScrollBar, { total, viewport: height, offset, height })),
  );
});

function Dashboard({ logH, logScroll, logW }) {
  const { total, all } = useLogs();
  const serviceRows = Object.values(services);
  const running = serviceRows.filter((service) => service.running).length;
  const errors = all.filter((line) => line.level === 'error').length;
  const maxLogs = Math.max(1, logH);
  const s = Math.min(logScroll, Math.max(0, total - maxLogs));
  const startIdx = Math.max(0, total - maxLogs - s);
  const visible = React.useMemo(() => all.slice(startIdx, total - s), [all, startIdx, total, s]);
  return h(Box, { flexDirection: 'column' },
    h(Text, { color: T.primary, bold: true }, '总览'),
    h(Box, { marginTop: 1 },
      h(Text, { color: T.success }, `服务 ${running}/${serviceRows.length} 运行`),
      h(Text, { color: errors > 0 ? T.warning : T.muted }, `   错误日志 ${errors}`),
      h(Text, { color: T.muted }, `   记录 ${total}`),
    ),
    h(Text, { color: T.separator }, '─'.repeat(Math.max(10, logW))),
    h(SectionTitle, { detail: `${total} 条` }, '最近日志'),
    h(LogBlock, { all: visible, startIdx, logW, height: maxLogs, total, offset: s }),
  );
}

function SvcView({ name, logH, logScroll, logW }) {
  const svc = services[name];
  const maxLogs = Math.max(1, logH + 4);
  const { total, all } = useLogs(name);
  const s = Math.min(logScroll, Math.max(0, total - maxLogs));
  const startIdx = Math.max(0, total - maxLogs - s);
  const visible = React.useMemo(() => all.slice(startIdx, total - s), [all, startIdx, total, s]);
  return h(Box, { flexDirection: 'column' },
    h(Box, {},
      h(Text, { color: svc?.running ? T.success : T.error },
        `${svc?.running ? '● 运行中' : '○ 已停止'}  PID ${svc?.pid || '-'}`),
      h(Text, { color: T.muted }, `  ${total} 条日志`),
    ),
    h(Text, { color: T.muted }, `滚动位置: ${s > 0 ? '历史' : '最新'}  PgUp/PgDn 翻页`),
    h(LogBlock, { all: visible, startIdx, logW, height: maxLogs, total, offset: s }),
  );
}

function CfgList({ files, logH, logScroll, logW }) {
  const maxFiles = Math.min(files.length, Math.max(3, logH + 5));
  const total = files.length;
  const startIdx = Math.max(0, total - maxFiles - logScroll);
  const visible = files.slice(startIdx, total - logScroll);
  return h(Box, { flexDirection: 'row', flexGrow: 1 },
    h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { color: T.muted }, '选择配置文件（输入编号）'),
    ...visible.map((f, i) => h(Text, { key: startIdx + i }, `  ${startIdx + i + 1}. ${f}`)),
    ),
    h(Text, { color: T.muted }, total > maxFiles ? `█ ${startIdx + 1}-${Math.min(total, startIdx + maxFiles)}/${total}` : ' '),
  );
}

function CfgEdit({ schema, items, focus, arrayIdx, enumPicker, dirty, editing, editBuf, editCursor, cfgData, logH, logScroll, logW, editVer }) {

  if (enumPicker) {
    const opts = enumPicker.values || [];
    const focus = enumPicker.focus;
    // viewH = logH + 6, available = viewH - title(1) = logH + 5
    const maxOpts = Math.max(3, logH + 3); // leave 2 for possible indicators
    const startIdx = Math.max(0, Math.min(focus - Math.floor(maxOpts / 2), opts.length - maxOpts));
    const visible = opts.slice(startIdx, startIdx + maxOpts);
    const hasUp = startIdx > 0;
    const hasDown = startIdx + maxOpts < opts.length;
    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { bold: true, color: T.primary }, `选择 ${enumPicker.label}`),
      hasUp && h(Text, { color: T.muted }, '  ↑ 更多...'),
      ...visible.map((o, i) =>
        h(Box, { key: startIdx + i },
          h(Text, { color: startIdx + i === focus ? T.primary : T.text },
            `${startIdx + i === focus ? '→' : ' '} ${o.label}`),
        ),
      ),
      hasDown && h(Text, { color: T.muted }, '  ↓ 更多...'),
    );
  }

  const title = schema?.name || '配置编辑';
  const subT = (schema?.type === 'array' && arrayIdx >= 0 && schema.itemLabel)
    ? ` > ${schema.itemLabel(cfgData?.[arrayIdx])}`
    : '';
  // logH ≈ viewH − 6, items get viewH − 1 (title) = logH + 5
  const maxItems = Math.max(3, logH + 5);
  const startIdx = Math.max(0, Math.min(focus - Math.floor(maxItems / 2), items.length - maxItems));
  const visible = items.slice(startIdx, startIdx + maxItems);
  const hasUp = startIdx > 0;
  const hasDown = startIdx + maxItems < items.length;

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { bold: true, color: dirty ? T.warning : T.primary },
      `${title}${subT}  ${dirty ? '❗未保存' : '✓'}`),
    hasUp && h(Text, { color: T.muted }, '  ↑ 更多...'),
    h(Box, { flexDirection: 'column', key: 'items-' + editVer },
      ...visible.map((item, i) => {
        const idx = startIdx + i;
        if (item.type === 'delete') {
          return h(Box, { key: 'delete' },
            h(Text, { color: T.separator }, ' ──────────────────'),
            h(Box, { backgroundColor: idx === focus ? T.focusBg : T.panel },
              h(Text, { color: idx === focus ? T.warning : T.muted },
                `${idx === focus ? '→' : ' '} ${item.label}`),
            ),
          );
        }
        if (item.type === 'add') {
          return h(Box, { key: 'add' },
            h(Box, { backgroundColor: idx === focus ? T.focusBg : T.panel },
              h(Text, { color: idx === focus ? T.success : T.muted },
                `${idx === focus ? '→' : ' '} ${item.label}`),
            ),
          );
        }
        if (item.type === 'array_item') {
          const isEditing = editing != null && editing === `[${item.idx}]`;
          const val = isEditing
            ? editBuf.slice(0, editCursor) + '█' + editBuf.slice(editCursor)
            : item.label;
          return h(Box, { key: i, backgroundColor: idx === focus ? T.focusBg : T.panel },
            h(Text, { color: idx === focus ? T.primary : T.text },
              `${idx === focus ? '→' : ' '}${isEditing ? '✏ ' : ''}[${item.idx}] ${val}`),
          );
        }
        // Regular field
        const isEditing = editing != null && (editing === item.key || editing.endsWith('.' + item.key));
        const val = isEditing
          ? editBuf.slice(0, editCursor) + '█' + editBuf.slice(editCursor)
          : (item.type === 'boolean'
            ? (item.value ? '✓' : '✗')
            : JSON.stringify(item.value ?? ''));
        return h(Box, { key: item.key || i, backgroundColor: idx === focus ? T.focusBg : T.panel },
          h(Text, { color: idx === focus ? T.primary : T.text },
            `${idx === focus ? '→' : ' '}${item.label}: ${val}`),
        );
      }),
    ),
    hasDown && h(Text, { color: T.muted }, '  ↓ 更多...'),
  );
}

function ConfirmOverlay({ title, body }) {
  return h(Box, { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    h(Box, {
      flexDirection: 'column', backgroundColor: T.panel,
      borderStyle: 'round', borderColor: T.border,
      paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2,
    },
      h(Text, { bold: true, color: T.primary }, title),
      ...body.map((l, i) => h(Text, { key: i, color: T.text }, l)),
      h(Text, { color: T.muted, marginTop: 1 }, '[y] 确认  [n] 取消'),
    ),
  );
}

import { MonitorView } from './MonitorView.js';
import { ChatView } from './ChatView.js';
import { DbView } from './DbView.js';
import { ModulesView } from './ModulesView.js';
import { SetupView } from './SetupView.js';
import { ServicesView, SERVICE_ORDER } from './ServicesView.js';
import { SettingsView } from './SettingsView.js';

export { Dashboard, SvcView, CfgList, CfgEdit, ConfirmOverlay, MonitorView, ChatView, DbView, ModulesView, SetupView, ServicesView, SettingsView, SERVICE_ORDER };
