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

export { StatusLine, SectionTitle, EmptyState };
