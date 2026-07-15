import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { T } from '../theme.js';
import { services } from '../services/manager.js';
import { ServiceDataCards } from './ServiceDataCards.js';
import { registerHitRegion, consumeLastClick } from '../mouse.js';

const h = React.createElement;
const SERVICE_ORDER = ['bds', 'db', 'qq', 'llbot'];

function ServicesView({ focus, logW, onOpenService, onSidebar, inputActive = true, registerZone, footerHeight = 2 }) {
  const [selection, setSelection] = useState(focus || 0);
  const [detailId, setDetailId] = useState(null);
  React.useEffect(() => {
    if (!registerZone) return;
    registerZone({ consumesDigits: false });
    return () => registerZone({ consumesDigits: false });
  }, [registerZone]);
  const cardCount = 5;
  const totalItems = SERVICE_ORDER.length + cardCount;
  // 鼠标命中区：service 行的 y = 4..7（标题 + 提示各占 1，sub-line 占 1）+ i*3（每服务 3 行）
  useEffect(() => {
    SERVICE_ORDER.forEach((name, index) => {
      registerHitRegion({
        id: `svc-row-${name}`,
        x1: 2, x2: 200, y1: 5 + index * 3, y2: 5 + index * 3,
        onClick: () => { setSelection(index); },
      });
    });
  }, []);
  useInput((input, key) => {
    if (key.rightArrow || key.leftArrow) { onSidebar?.(); return; }
    if (key.upArrow) { setSelection((value) => Math.max(0, value - 1)); return; }
    if (key.downArrow) { setSelection((value) => Math.min(totalItems - 1, value + 1)); return; }
    if (key.home) { setSelection(0); return; }
    if (key.end) { setSelection(totalItems - 1); return; }
    if (key.return || key.enter) {
      if (selection < SERVICE_ORDER.length) onOpenService?.(SERVICE_ORDER[selection]);
      else setDetailId(['players', 'world', 'scoreboards', 'activities', 'areas'][selection - SERVICE_ORDER.length]);
      return;
    }
    if (key.escape && detailId) setDetailId(null);
  }, { isActive: inputActive });
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { color: T.primary, bold: true }, '服务控制台'),
    h(Text, { color: T.muted }, '↑↓ 选择服务  Enter 查看日志  → 打开动作菜单  Esc 返回  · 点击行 = 选中 + 触发'),
    h(Text, { color: T.separator }, '─'.repeat(Math.max(10, logW))),
    ...SERVICE_ORDER.map((name, index) => {
      const service = services[name];
      const selected = consumeLastClick(`svc-row-${name}`) || index === selection;
      const status = service?.running ? '运行中' : '已停止';
      const pid = service?.pid ? `  PID ${service.pid}` : '';
      return h(Box, { key: name, backgroundColor: selected ? T.focusBg : T.panel },
        h(Box, { flexDirection: 'column' },
          h(Text, { color: selected ? T.primary : (service?.running ? T.success : T.muted), bold: selected },
            `${selected ? '▶' : ' '} ${service?.title || name}${pid}`),
          h(Text, { color: service?.running ? T.success : T.muted }, `  ${status}`),
          h(Text, { color: T.muted }, name === 'bds' ? '  支持更新检查与控制台输入' : '  支持日志查看与启动/停止'),
        ),
      );
    }),
    h(ServiceDataCards, { logW, focus: selection - SERVICE_ORDER.length, detailId }),
  );
}

export { ServicesView, SERVICE_ORDER };
