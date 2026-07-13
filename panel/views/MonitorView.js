import React from 'react';
import { Box, Text } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';
import { useMonitor } from '../monitor.js';

const BAR_W = 20;

const COL = { 玩家: 16, 维度: 8, 区块: 8, 实体: 6 };
const TABLE_W = 1 + COL.玩家 + 1 + COL.维度 + 1 + COL.区块 + 1 + COL.实体 + 1;

function T_(ch, n) { return ch.repeat(Math.max(1, n)); }

function tblRow(left, sep, right, col1, col2, col3, col4) {
  return `${left}${col1}${sep}${col2}${sep}${col3}${sep}${col4}${right}`;
}

function pad(s, w) {
  s = String(s ?? '');
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

function Bar({ pct, color, label, right }) {
  const filled = Math.round((pct / 100) * BAR_W);
  const empty = BAR_W - filled;
  return h(Box, { flexDirection: 'row' },
    h(Text, { color: T.text }, ` ${label}`),
    h(Text, { color },
      '█'.repeat(Math.max(0, filled)),
    ),
    h(Text, { color: T.muted }, '░'.repeat(Math.max(0, empty))),
    h(Text, { color: T.text }, ` ${right}`),
  );
}

function fmtMem(bytes) {
  const gb = bytes / 1073741824;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1048576)} MB`;
}

function fmtBarColor(n) {
  if (n >= 90) return T.error;
  if (n >= 70) return T.warning;
  return T.success;
}

function fmtTpsColor(tps) {
  if (tps >= 19.5) return T.success;
  if (tps >= 15) return T.warning;
  return T.error;
}

function dimLabel(dim) {
  if (dim?.includes('nether')) return '下界';
  if (dim?.includes('the_end')) return '末地';
  return '主世界';
}

function PlayerTable({ players, logH }) {
  const rows = players.slice(0, Math.max(3, logH));
  const has = rows.length > 0;

  const top = tblRow('┌', '┬', '┐',
    T_('─', COL.玩家), T_('─', COL.维度), T_('─', COL.区块), T_('─', COL.实体));
  const header = tblRow('│', '│', '│',
    pad(' 玩家', COL.玩家), pad('维度', COL.维度), pad('区块', COL.区块), pad('实体', COL.实体));
  const sep = tblRow('├', '┼', '┤',
    T_('─', COL.玩家), T_('─', COL.维度), T_('─', COL.区块), T_('─', COL.实体));
  const data = rows.map((p, i) =>
    tblRow('│', '│', '│',
      pad(` ${p.name || '?'}`, COL.玩家),
      pad(dimLabel(p.dimension), COL.维度),
      pad(String(p.chunkEstimate || 0), COL.区块),
      pad(String(p.clientEntities || 0), COL.实体)));
  const bot = tblRow('└', '┴', '┘',
    T_('─', COL.玩家), T_('─', COL.维度), T_('─', COL.区块), T_('─', COL.实体));

  const lines = has
    ? [top, header, sep, ...data, bot]
    : [h(Text, { color: T.muted }, ' 无在线玩家')];

  return h(Box, { flexDirection: 'column' }, ...lines.map((l, i) =>
    typeof l === 'string' ? h(Text, { key: i, color: T.text }, l) : l));
}

function MonitorView({ logH, logW }) {
  const data = useMonitor();
  if (!data) {
    return h(Box, { flexDirection: 'column' },
      h(Text, { color: T.muted }, ' 等待数据...'),
    );
  }

  const { systemMem, systemCpu, svc, tps, entities, players, totalChunks } = data;
  const entityTotal = Object.values(entities).reduce((a, b) => a + (b || 0), 0);
  const playerCount = players.length;
  const tpsPct = Math.min(100, Math.round(tps / 20 * 100));
  const mspt = tps > 0 ? (1000 / tps).toFixed(1) : 'N/A';

  const svcOrder = ['bds', 'panel', 'db', 'qq', 'llbot'];
  const svcLabel = { bds: 'BDS     ', panel: '面板    ', db: 'DB      ', qq: 'QQ      ', llbot: 'LLBot   ' };

  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(Text, { bold: true, color: T.primary }, ' 📊 性能监控'),

    h(Box, { marginTop: 1 },
      h(Bar, {
        label: '系统内存',
        pct: systemMem.percent,
        color: fmtBarColor(systemMem.percent),
        right: `${systemMem.percent}%  ${fmtMem(systemMem.used)}/${fmtMem(systemMem.total)}`,
      }),
    ),
    h(Box, {},
      h(Bar, {
        label: '系统CPU ',
        pct: systemCpu,
        color: fmtBarColor(systemCpu),
        right: `${systemCpu}%`,
      }),
    ),

    ...svcOrder.map(k => {
      const info = svc?.[k];
      const cpu = info?.cpu ?? 0;
      const mem = info?.mem;
      return h(Box, { key: k },
        h(Bar, {
          label: svcLabel[k],
          pct: cpu,
          color: fmtBarColor(cpu),
          right: `${cpu}% CPU  ${mem != null ? mem + ' MB' : 'N/A'}`,
        }),
      );
    }),

    h(Box, { marginTop: 1 },
      h(Text, { color: T.text },
        ` TPS     ${'█'.repeat(Math.min(BAR_W, Math.round(tpsPct / 100 * BAR_W)))}${'░'.repeat(Math.max(0, BAR_W - Math.round(tpsPct / 100 * BAR_W)))} `),
      h(Text, { color: fmtTpsColor(tps) }, `${tps > 0 ? tps.toFixed(1) : 'N/A'}/20 (${tpsPct}%)`),
      h(Text, { color: T.muted }, `  MSPT ${mspt}ms`),
    ),

    h(Box, { marginTop: 1 },
      h(Text, { color: T.muted },
        ` 实体: ${entityTotal}  |  区块: ${totalChunks}  |  在线: ${playerCount}`),
    ),

    h(Text, { color: T.separator, marginTop: 1 }, ` ${'─'.repeat(Math.max(10, logW))}`),

    h(PlayerTable, { players, logH }),
  );
}

export { MonitorView };
