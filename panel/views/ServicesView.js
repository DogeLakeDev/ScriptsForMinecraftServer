import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { T } from '../theme.js';
import { services } from '../services/manager.js';
import { ServiceDataCards } from './ServiceDataCards.js';

const h = React.createElement;
const SERVICE_ORDER = ['bds', 'db', 'qq', 'llbot'];

function ServicesView({ focus, logW, onOpenService, onSidebar, inputActive = true }) {
  const [selection, setSelection] = useState(focus || 0);
  const [detailId, setDetailId] = useState(null);
  const cardCount = 5;
  const totalItems = SERVICE_ORDER.length + cardCount;
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
    h(Text, { color: T.primary, bold: true }, '服务'),
    h(Text, { color: T.muted }, '↑↓ 选择  Enter 查看日志与操作'),
    h(Text, { color: T.separator }, '─'.repeat(Math.max(10, logW))),
    ...SERVICE_ORDER.map((name, index) => {
      const service = services[name];
      const selected = index === selection;
      const status = service?.running ? '运行中' : '已停止';
      return h(Box, { key: name, backgroundColor: selected ? T.focusBg : T.panel },
        h(Box, { flexDirection: 'column' },
          h(Text, { color: selected ? T.primary : (service?.running ? T.success : T.muted), bold: selected },
            `${selected ? '▶' : ' '} ${service?.title || name}`),
          h(Text, { color: service?.running ? T.success : T.muted }, `  ${status}   PID ${service?.pid || '-'}`),
          h(Text, { color: T.muted }, name === 'bds' ? '  更新检查与服务器配置可从侧栏进入' : '  Enter 查看日志与控制'),
        ),
      );
    }),
    h(ServiceDataCards, { logW, focus: selection - SERVICE_ORDER.length, detailId }),
  );
}

export { ServicesView, SERVICE_ORDER };
