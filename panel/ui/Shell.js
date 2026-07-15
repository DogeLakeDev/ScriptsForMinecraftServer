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

function Sidebar({ tabs = [], activeTab, menuItems, menuFocus, schema, sidebarWidth = 22, onSwitchTab, onDoAct }) {
  const schemaInfo = schema ? (schema.desc || schema.name) : null;
  // 计算 sidebar 内每个 item 的 y 坐标用于鼠标命中
  let yCursor = 2; // paddingTop=1 → content row 1
  const itemYs = [];
  // tabs 区域起始 y = 2（首行是"导航"标题）
  for (const tab of tabs) {
    itemYs.push({ y1: yCursor, y2: yCursor, tab });
    yCursor += 1;
  }
  yCursor += 1; // separator line
  // 跳过"运行状态"块（已移除）
  yCursor += 2; // separator + "动作" 标题
  const actionYs = menuItems.map((item, index) => {
    if (item.act === 'separator') { yCursor += 1; return null; }
    const y1 = yCursor;
    yCursor += 1;
    return { y1, y2: y1, item, index };
  }).filter(Boolean);

  // 注意：sidebar 在 Ink 中不一定获得精确 x 坐标（布局为 flex + margin），
  // 所以 click 主要用于 y 命中；column index 触发对应 tab/action。
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
      const yInfo = actionYs.find((y) => y.index === index);
      return h(Box, {
        key: item.k,
        backgroundColor: selected ? T.element : T.panel,
        // 鼠标命中区：btn-0 → onDoAct(item.k)
        ...(yInfo ? {
          // 我们用 useState 全局登记代替 inline attribute（Ink 不支持 box onClick）
        } : {}),
      },
        h(Text, { color: selected ? T.primary : T.text }, ` ${selected ? '▶' : ' '} ${item.l}`),
      );
    }),
    schemaInfo && h(Box, { flexGrow: 1, flexDirection: 'column', justifyContent: 'flex-end', paddingLeft: 1, paddingBottom: 1 },
      h(Text, { color: T.muted }, schemaInfo.slice(0, 36)),
    ),
  );
}

function Footer({ height, narrow, inputFocus, inputVal, cursorPos, cursorVisible, hint, crumb }) {
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
  !narrow && crumb && h(Text, { color: T.subtle }, crumb),
  h(Text, { bold: true, color: inputFocus ? T.primary : T.text },
    ` ${inputFocus ? '>' : '$'} ${!inputVal ? (cursorVisible ? '█' : ' ') : (cursorVisible
      ? inputVal.slice(0, cursorPos) + '█' + inputVal.slice(cursorPos)
      : inputVal)}`),
  !narrow && h(Text, { color: T.muted }, hint),
  );
}

export { Header, Sidebar, Footer };
