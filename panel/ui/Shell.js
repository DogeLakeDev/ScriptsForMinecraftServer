import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { T } from '../theme.js';
import { registerHitRegion, clearHitRegions, consumeLastClick } from '../mouse.js';

const h = React.createElement;

function Header({ tabs, activeTab, compact, svcStatus = {}, onSwitchTab }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const idx = tabs.findIndex((tab) => tab.k === activeTab);
  const entries = Object.entries(svcStatus);
  const running = entries.filter(([, s]) => s.running).length;
  const health = entries.length
    ? entries.map(([name, s]) => h(Text, {
      key: name,
      color: s.running ? T.serviceRunning : T.serviceStopped,
    }, s.running ? '●' : '○')).concat(
      h(Text, { key: 'cnt', color: T.muted }, ` ${running}/${entries.length}`)
    )
    : [h(Text, { key: 'none', color: T.subtle }, '—')];
  const compactHint = compact
    ? `‹ ${idx + 1}/${tabs.length} ${tabs[idx]?.l || ''} ›`
    : null;
  // Header layout: tabs (left) — spacer — health (right) — clock
  // 记录每个 tab 渲染的 x 起点 (含 padding)，用于命中点击
  let xCursor = 1; // paddingLeft=1
  const tabRenderables = compact
    ? [{ x1: xCursor + 1, x2: xCursor + compactHint.length + 1, tab: tabs[idx] }]
    : tabs.map((tab, index) => {
      const len = 4 + `${index + 1} ${tab.l}`.length; // paddingLeft/Right=2, 1 char label "1", space, tab.l
      const x1 = xCursor + 1, x2 = xCursor + 1 + `${index + 1} ${tab.l}`.length;
      xCursor += len + 1;
      return { x1, x2, tab };
    });
  useEffect(() => {
    for (const r of tabRenderables) {
      if (!r.tab) continue;
      registerHitRegion({
        id: `tab-${r.tab.k}`,
        x1: r.x1, y1: 1, x2: r.x2, y2: 1,
        onClick: () => onSwitchTab?.(r.tab.k),
      });
    }
    return () => clearHitRegions();
  }, [activeTab, onSwitchTab, compact]);
  return h(Box, { height: 1, backgroundColor: T.panel, flexDirection: 'row' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      compact
        ? h(Text, { color: T.primary, bold: true }, compactHint)
        : tabs.map((tab, index) => h(Box, {
          key: tab.k,
          backgroundColor: consumeLastClick(`tab-${tab.k}`)
            ? T.focusBg
            : (activeTab === tab.k ? T.element : T.panel),
          paddingLeft: 2,
          paddingRight: 2,
        }, h(Text, { color: activeTab === tab.k ? T.primary : T.muted, bold: activeTab === tab.k }, `${index + 1} ${tab.l}`))),
    ),
    h(Box, { flexGrow: 1 }),
    h(Box, { flexDirection: 'row', paddingRight: 1 }, ...health),
    !compact && h(Text, { color: T.muted, paddingRight: 2 }, `  ${now}`),
  );
}

function Sidebar({ tabs = [], activeTab, menuItems, menuFocus, schema, sidebarWidth = 20, onSwitchTab, onDoAct }) {
  const schemaInfo = schema ? (schema.desc || schema.name) : null;
  // 计算 sidebar 内每个 item 的 y 坐标用于鼠标命中
  let yCursor = 2; // paddingTop=1 → content row 1
  const tabYs = [];
  for (const tab of tabs) {
    tabYs.push({ y1: yCursor, y2: yCursor, tab });
    yCursor += 1;
  }
  yCursor += 1; // separator line
  yCursor += 1; // "动作" 标题
  const actionYs = menuItems.map((item, index) => {
    if (item.act === 'separator') { yCursor += 1; return null; }
    const y1 = yCursor;
    yCursor += 1;
    return { y1, y2: y1, item, index };
  }).filter(Boolean);

  // 注册鼠标命中区：tab 行 + 动作行
  useEffect(() => {
    for (const ty of tabYs) {
      if (!ty.tab) continue;
      registerHitRegion({
        id: `side-tab-${ty.tab.k}`,
        x1: 2, x2: sidebarWidth, y1: ty.y1, y2: ty.y2,
        onClick: () => onSwitchTab?.(ty.tab.k),
      });
    }
    for (const ay of actionYs) {
      registerHitRegion({
        id: `side-act-${ay.item.k}`,
        x1: 2, x2: sidebarWidth, y1: ay.y1, y2: ay.y2,
        onClick: () => onDoAct?.(ay.item.k),
      });
    }
  }, [activeTab, menuFocus, menuItems, onSwitchTab, onDoAct]);

  return h(Box, { width: sidebarWidth, flexDirection: 'column', backgroundColor: T.panel, margin: 1, paddingTop: 1 },
    h(Text, { color: T.muted, paddingLeft: 1, bold: true }, '导航'),
    ...tabs.map((tab, index) => h(Box, { key: tab.k, paddingLeft: 1, backgroundColor: activeTab === tab.k ? T.focusBg : T.panel },
      h(Text, { color: activeTab === tab.k ? T.primary : T.text, bold: activeTab === tab.k }, ` ${index + 1}  ${tab.l}`),
    )),
    h(Box, { marginTop: 1, marginBottom: 1 }, h(Text, { color: T.separator, paddingX: 1 }, ` ${'─'.repeat(sidebarWidth - 2)}`)),
    h(Text, { color: T.muted, paddingLeft: 1, bold: true }, '动作'),
    ...menuItems.map((item, index) => {
      if (item.act === 'separator') return h(Text, { key: `sep-${index}`, color: T.separator }, ` ${'─'.repeat(18)}`);
      const selected = index === menuFocus;
      const clicked = consumeLastClick(`side-act-${item.k}`);
      return h(Box, {
        key: item.k,
        backgroundColor: clicked ? T.focusBg : (selected ? T.element : T.panel),
      },
        h(Text, { color: selected ? T.primary : T.text }, ` ${selected ? '▶' : ' '} ${item.l}`),
      );
    }),
    schemaInfo && h(Box, { flexGrow: 1, flexDirection: 'column', justifyContent: 'flex-end', paddingLeft: 1, paddingBottom: 1 },
      h(Text, { color: T.muted }, schemaInfo.slice(0, 36)),
    ),
  );
}

function Footer({ height, narrow, inputFocus, inputVal, cursorPos, cursorVisible, hintEl, crumbEl }) {
  return h(Box, {
    height,
    backgroundColor: inputFocus ? T.element : T.panel,
    flexDirection: 'column',
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: narrow ? 0 : 0,
    marginBottom: narrow ? 0 : 0,
    marginLeft: 1,
    marginRight: 1,
  },
  !narrow && crumbEl && h(Box, { paddingLeft: 0 }, crumbEl),
  h(Text, { bold: true, color: inputFocus ? T.primary : T.text },
    ` ${inputFocus ? '>' : '$'} ${!inputVal ? (cursorVisible ? '█' : ' ') : (cursorVisible
      ? inputVal.slice(0, cursorPos) + '█' + inputVal.slice(cursorPos)
      : inputVal)}`),
  !narrow && hintEl && h(Box, {}, hintEl),
  );
}

export { Header, Sidebar, Footer };
