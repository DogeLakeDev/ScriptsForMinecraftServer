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
import { ServicesView, SERVICE_ORDER } from './ServicesView.js';
import { SettingsView } from './SettingsView.js';

export { Dashboard, SvcView, ConfirmOverlay, MonitorView, ChatView, DbView, ModulesView, ServicesView, SettingsView, SERVICE_ORDER };
