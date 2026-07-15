import React, { memo } from 'react';
import { Box, Text } from 'ink';
const h = React.createElement;
import { T, LEVEL_COLOR } from '../theme.js';
import { useLogs } from '../log-buffer-hooks.js';
import { services } from '../services/manager.js';
import { SectionTitle, StatusLine } from '../ui/Feedback.js';
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

function Dashboard({ logH, logScroll, logW, setupRequired }) {
  const { total, all } = useLogs();
  const serviceRows = Object.entries(services);
  const running = serviceRows.filter(([, service]) => service.running).length;
  const errors = all.filter((line) => line.level === 'error').length;
  const maxLogs = Math.max(1, logH - 2);
  const s = Math.min(logScroll, Math.max(0, total - maxLogs));
  const startIdx = Math.max(0, total - maxLogs - s);
  const visible = React.useMemo(() => all.slice(startIdx, total - s), [all, startIdx, total, s]);
  return h(Box, { flexDirection: 'column' },
    h(SectionTitle, { detail: '1-6 切页 · ? 帮助' }, '总览'),
    h(Text, { color: T.muted }, '一眼看服务健康与最近错误，再进对应工作区。'),
    setupRequired === true && h(StatusLine, { kind: 'warning' }, '尚未完成初始化 — 用配置向导或 CLI 收尾'),
    h(Box, { marginTop: 1, flexDirection: 'row', flexWrap: 'wrap' },
      ...serviceRows.map(([name, svc]) => h(Box, {
        key: name,
        marginRight: 2,
        paddingX: 1,
        backgroundColor: T.surfaceAlt,
      },
        h(Text, { color: svc.running ? T.serviceRunning : T.serviceStopped }, svc.running ? '●' : '○'),
        h(Text, { color: T.text }, ` ${name}`),
        h(Text, { color: T.subtle }, svc.running && svc.pid ? ` ${svc.pid}` : ''),
      )),
    ),
    h(Box, { marginTop: 1 },
      h(Text, { color: running === serviceRows.length ? T.success : T.warning }, `运行 ${running}/${serviceRows.length}`),
      h(Text, { color: errors > 0 ? T.error : T.muted }, `  ·  错误 ${errors}`),
      h(Text, { color: T.muted }, `  ·  日志 ${total}`),
    ),
    h(Text, { color: T.separator }, '─'.repeat(Math.max(10, logW))),
    h(SectionTitle, { detail: total ? `${total} 条 · PgUp/Dn` : '空' }, '最近日志'),
    total === 0
      ? h(StatusLine, { kind: 'empty' }, '暂无日志 — 启动服务后会出现在这里')
      : h(LogBlock, { all: visible, startIdx, logW, height: maxLogs, total, offset: s }),
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
  const destructive = /停止|删除|退出|重启|禁用/.test(title || '');
  return h(Box, { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    h(Box, {
      flexDirection: 'column', backgroundColor: T.panel,
      borderStyle: 'round', borderColor: destructive ? T.error : T.borderFocus,
      paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2,
    },
      h(Text, { bold: true, color: destructive ? T.error : T.primary }, title),
      ...body.map((l, i) => h(Text, { key: i, color: T.text }, l)),
      h(Text, { color: T.muted, marginTop: 1 }, '[y] 确认    [n] / Esc 取消'),
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
