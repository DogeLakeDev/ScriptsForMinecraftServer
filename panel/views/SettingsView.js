import React from 'react';
import { Box, Text, useInput } from 'ink';
import { T } from '../theme.js';

const h = React.createElement;
const ITEMS = [
  { id: 'panel', label: '面板设置', action: 'edit_panel_cfg' },
  { id: 'server', label: '服务器配置', action: 'edit_server_prop' },
  { id: 'plugin', label: '插件配置', action: 'cfg_list' },
];

function SettingsView({ focus = 0, onFocus, onAction, inputActive = true }) {
  useInput((input, key) => {
    if (key.upArrow) { onFocus?.((focus + ITEMS.length - 1) % ITEMS.length); return; }
    if (key.downArrow) { onFocus?.((focus + 1) % ITEMS.length); return; }
    if (key.home) { onFocus?.(0); return; }
    if (key.end) { onFocus?.(ITEMS.length - 1); return; }
    if (key.return || key.enter) { onAction?.(ITEMS[focus].action); }
  }, { isActive: inputActive });

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { color: T.primary, bold: true }, '设置'),
    h(Text, { color: T.muted }, '↑↓ 选择  Enter 打开  配置编辑会保留未保存确认'),
    h(Text, { color: T.separator }, '─'.repeat(40)),
    ...ITEMS.map((item, index) => h(Box, { key: item.id, backgroundColor: index === focus ? T.focusBg : T.panel },
      h(Text, { color: index === focus ? T.primary : T.text, bold: index === focus }, `${index === focus ? '▶' : ' '} ${item.label}`),
    )),
  );
}

export { SettingsView };
