import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { T } from '../theme.js';
import { getJson } from '../api/client.js';

const h = React.createElement;

const SOURCES = [
  { id: 'players', label: '玩家', moduleKeys: [], path: '/api/sfmc/players', key: 'players', value: (data) => `${data.length} 条记录` },
  { id: 'world', label: '世界', moduleKeys: [], path: '/api/sfmc/world', key: 'world', value: (data) => data ? `day ${data.day ?? '-'} | difficulty ${data.difficulty ?? '-'}` : '暂无世界数据' },
  { id: 'scoreboards', label: '计分板', moduleKeys: ['scoreboard_sync', 'feature-scoreboard-sync'], path: '/api/sfmc/scoreboards', key: 'entries', value: (data) => `${data.length} 个目标` },
  { id: 'activities', label: '行为日志', moduleKeys: ['activity_log', 'feature-activity-log'], path: '/api/sfmc/activities/stats', key: 'total', value: (data) => `${data} 条事件` },
  { id: 'areas', label: '区域', moduleKeys: ['fly', 'creative', 'survival', 'peace'], path: '/api/sfmc/areas', key: 'areas', value: (data) => `${data.length} 个区域` },
];

function ServiceDataCards({ logW, focus = -1, detailId }) {
  const [modules, setModules] = useState([]);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJson('/api/sfmc/modules'), ...SOURCES.map((source) => getJson(source.path))])
      .then(([moduleResult, ...results]) => {
        if (cancelled) return;
        setModules(moduleResult.modules || []);
        setData(Object.fromEntries(SOURCES.map((source, index) => [source.id, results[index][source.key]])));
      })
      .catch((reason) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, []);

  const enabled = (id) => modules.some((module) => module.id === id && module.enabled && module.installed !== false);
  const cards = SOURCES.map((source) => ({
    ...source,
    available: source.moduleKeys.length === 0 || source.moduleKeys.some(enabled),
  }));

  const detail = detailId && cards.find((card) => card.id === detailId);
  const detailData = detail ? data[detail.id] : null;
  return h(Box, { flexDirection: 'column', marginTop: 1 },
    h(Text, { color: T.muted }, `数据卡片${error ? `  [!] ${error}` : ''}`),
    h(Box, { flexDirection: 'row', flexWrap: 'wrap' },
      ...cards.map((source, index) => h(Box, {
        key: source.id,
        width: Math.max(24, Math.min(34, Math.floor(logW / 3))),
        flexDirection: 'column',
        backgroundColor: T.panel,
        marginRight: 1,
        marginBottom: 1,
        paddingX: 1,
      },
        h(Text, { color: index === focus ? T.primary : (source.available ? T.primary : T.muted), bold: index === focus }, `${index === focus ? '▶ ' : '  '}${source.label}`),
        h(Text, { color: source.available ? T.text : T.muted }, source.available ? source.value(data[source.id] ?? (source.id === 'activities' ? 0 : [])) : '模块未启用'),
        h(Text, { color: index === focus ? T.primary : T.muted }, index === focus ? 'Enter 查看完整数据' : '↑↓选择'),
      )),
    ),
    detail && h(Box, { flexDirection: 'column', marginTop: 1, backgroundColor: T.panel, paddingX: 1 },
      h(Text, { color: detail.available ? T.primary : T.muted, bold: true }, `${detail.label}详情`),
      h(Text, { color: T.muted }, detail.id === 'world'
        ? JSON.stringify(detailData || {}, null, 0)
        : Array.isArray(detailData) ? detailData.slice(0, 5).map((item, index) => `${index + 1}. ${JSON.stringify(item)}`).join(' | ') : JSON.stringify(detailData || {})),
      h(Text, { color: T.muted }, 'Esc 返回卡片列表'),
    ),
  );
}

export { ServiceDataCards };
