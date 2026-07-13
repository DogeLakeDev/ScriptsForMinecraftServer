import React from 'react';
import { Box, Text } from 'ink';
import { T } from '../theme.js';
import { services } from '../services/manager.js';
import { ServiceDataCards } from './ServiceDataCards.js';

const h = React.createElement;
const SERVICE_ORDER = ['bds', 'db', 'qq', 'llbot'];

function ServicesView({ focus, logW }) {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { color: T.primary, bold: true }, '服务'),
    h(Text, { color: T.muted }, '↑↓ 选择  Enter 查看日志与操作'),
    h(Text, { color: T.separator }, '─'.repeat(Math.max(10, logW))),
    ...SERVICE_ORDER.map((name, index) => {
      const service = services[name];
      const selected = index === focus;
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
    h(ServiceDataCards, { logW }),
  );
}

export { ServicesView, SERVICE_ORDER };
