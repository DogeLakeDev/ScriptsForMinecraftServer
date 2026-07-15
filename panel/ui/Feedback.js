import React from 'react';
import { Box, Text } from 'ink';
import { T } from '../theme.js';

const h = React.createElement;

const STATE = {
  loading: { label: '[...]', color: T.info },
  empty: { label: '[-]', color: T.muted },
  error: { label: '[x]', color: T.error },
  warning: { label: '[!]', color: T.warning },
  success: { label: '[+]', color: T.success },
  stale: { label: '[~]', color: T.warning },
};

function StatusLine({ kind = 'empty', children }) {
  const state = STATE[kind] || STATE.empty;
  return h(Box, { flexDirection: 'row' },
    h(Text, { color: state.color, bold: kind === 'error' || kind === 'warning' }, `${state.label} `),
    h(Text, { color: kind === 'error' ? T.error : T.muted }, children),
  );
}

function SectionTitle({ children, detail }) {
  return h(Box, { flexDirection: 'row' },
    h(Text, { color: T.primary, bold: true }, children),
    detail && h(Text, { color: T.muted }, `  ${detail}`),
  );
}

function EmptyState({ title, detail, action }) {
  return h(Box, { flexDirection: 'column', marginTop: 1 },
    h(Text, { color: T.muted, bold: true }, `[-] ${title}`),
    detail && h(Text, { color: T.subtle }, `    ${detail}`),
    action && h(Text, { color: T.info }, `    ${action}`),
  );
}

/** 键盘提示：键名加粗/主色，说明用 muted */
function KeyHint({ keys = [], sep = '  ' }) {
  const parts = [];
  keys.forEach((item, i) => {
    if (i > 0) parts.push(h(Text, { key: `s${i}`, color: T.subtle }, sep));
    parts.push(h(Text, { key: `k${i}`, color: T.primary, bold: true }, item.key));
    parts.push(h(Text, { key: `l${i}`, color: T.muted }, ` ${item.label}`));
  });
  return h(Box, { flexDirection: 'row' }, ...parts);
}

function Crumb({ parts = [] }) {
  const nodes = [];
  parts.forEach((p, i) => {
    if (i > 0) nodes.push(h(Text, { key: `c${i}`, color: T.subtle }, ' › '));
    nodes.push(h(Text, { key: `p${i}`, color: i === parts.length - 1 ? T.primary : T.muted, bold: i === parts.length - 1 }, p));
  });
  return h(Box, { flexDirection: 'row' }, ...nodes);
}

export { StatusLine, SectionTitle, EmptyState, KeyHint, Crumb };
