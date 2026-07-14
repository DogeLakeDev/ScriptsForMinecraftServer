import React from 'react';
import { Text } from 'ink';
import { T } from '../theme.js';

const h = React.createElement;

function ScrollBar({ total, viewport, offset = 0, height = 8 }) {
  const track = Math.max(1, height);
  if (total <= viewport || viewport <= 0) return h(Text, { color: T.separator }, ' ');
  const thumb = Math.max(1, Math.round((viewport / total) * track));
  const maxOffset = Math.max(1, total - viewport);
  const inverted = maxOffset - Math.min(offset, maxOffset);
  const top = Math.min(track - thumb, Math.round((inverted / maxOffset) * (track - thumb)));
  return h(Text, { color: T.muted }, `${'░'.repeat(top)}${'█'.repeat(thumb)}${'░'.repeat(track - top - thumb)}`);
}

export { ScrollBar };
