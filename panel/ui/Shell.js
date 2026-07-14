import React from 'react';
import { Box, Text } from 'ink';
import { T } from '../theme.js';

const h = React.createElement;

function Header({ tabs, activeTab, compact }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const idx = tabs.findIndex((tab) => tab.k === activeTab);
  const compactHint = compact
    ? `‹ ${idx + 1}/${tabs.length} ${tabs[idx]?.l || ''} ›`
    : null;
  return h(Box, { height: 1, backgroundColor: T.panel, flexDirection: 'row' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      compact
        ? h(Text, { color: T.primary, bold: true }, compactHint)
        : tabs.map((tab, index) => h(Box, {
          key: tab.k,
          backgroundColor: activeTab === tab.k ? T.element : T.panel,
          paddingLeft: 2,
          paddingRight: 2,
        }, h(Text, { color: activeTab === tab.k ? T.primary : T.muted, bold: activeTab === tab.k }, `${index + 1} ${tab.l}`))),
    ),
    h(Box, { flexGrow: 1 }),
    !compact && h(Text, { color: T.muted, paddingRight: 2 }, now),
  );
}

function Sidebar({ tabs = [], activeTab, menuItems, menuFocus, svcStatus, schema, sidebarWidth = 20 }) {
  const schemaInfo = schema ? (schema.desc || schema.name) : null;
  return h(Box, { width: sidebarWidth, flexDirection: 'column', backgroundColor: T.panel, margin: 1, paddingTop: 1 },
    h(Text, { color: T.muted, paddingLeft: 1, bold: true }, '导航'),
    ...tabs.map((tab, index) => h(Box, { key: tab.k, paddingLeft: 1, backgroundColor: activeTab === tab.k ? T.focusBg : T.panel },
      h(Text, { color: activeTab === tab.k ? T.primary : T.text, bold: activeTab === tab.k }, ` ${index + 1}  ${tab.l}`),
    )),
    h(Box, { marginTop: 1 }, h(Text, { color: T.separator, paddingX: 1 }, ` ${'─'.repeat(Math.max(4, sidebarWidth - 2))}`)),
    h(Text, { color: T.muted, paddingLeft: 1, bold: true }, '运行状态'),
    ...Object.entries(svcStatus).map(([name, service]) => h(Box, { key: name, paddingLeft: 1 },
      h(Text, { color: service.running ? T.success : T.error }, service.running ? '●' : '○'),
      h(Text, { color: T.text }, ` ${name.padEnd(8)} ${service.running ? '运行' : '停止'}`),
    )),
    h(Box, { marginTop: 1, marginBottom: 1 }, h(Text, { color: T.separator, paddingX: 1 }, ` ${'─'.repeat(sidebarWidth - 2)}`)),
    h(Text, { color: T.muted, paddingLeft: 1, bold: true }, '动作'),
    ...menuItems.map((item, index) => {
      if (item.act === 'separator') return h(Text, { key: `sep-${index}`, color: T.separator }, ` ${'─'.repeat(18)}`);
      const selected = index === menuFocus;
      return h(Box, { key: item.k, backgroundColor: selected ? T.element : T.panel },
        h(Text, { color: selected ? T.primary : T.text }, ` ${selected ? '▶' : ' '} ${item.l}`),
      );
    }),
    schemaInfo && h(Box, { flexGrow: 1, flexDirection: 'column', justifyContent: 'flex-end', paddingLeft: 1, paddingBottom: 1 },
      h(Text, { color: T.muted }, schemaInfo.slice(0, 36)),
    ),
  );
}

function Footer({ height, narrow, inputFocus, inputVal, cursorPos, cursorVisible, hint }) {
  return h(Box, {
    height,
    backgroundColor: inputFocus ? T.element : T.panel,
    flexDirection: 'column',
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: narrow ? 0 : 1,
    marginBottom: narrow ? 0 : 1,
    marginLeft: 1,
    marginRight: 1,
  },
   h(Text, { bold: true, color: inputFocus ? T.primary : T.text },
     ` ${inputFocus ? '>' : '$'} ${!inputVal ? (cursorVisible ? '█' : ' ') : (cursorVisible
       ? inputVal.slice(0, cursorPos) + '█' + inputVal.slice(cursorPos)
       : inputVal)}`),
  !narrow && h(Text, { color: T.muted }, hint),
  );
}

export { Header, Sidebar, Footer };
