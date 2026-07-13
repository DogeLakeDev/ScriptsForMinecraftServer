/**
 * ChatView.js — 频道聊天记录视图
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';

const DB_HOST = '127.0.0.1';
const DB_PORT = 3001;

// 玩家名缓存（- 前缀 ID → name），上限 500 防泄漏
const _nameCache = new Map();
const _NAME_CACHE_MAX = 500;

function _cacheName(id, name) {
  if (!name) return;
  if (_nameCache.size >= _NAME_CACHE_MAX) {
    const first = _nameCache.keys().next().value;
    _nameCache.delete(first);
  }
  _nameCache.set(id, name);
}

function fetchPlayerName(id) {
  if (_nameCache.has(id)) return Promise.resolve(_nameCache.get(id));
  return fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/players/${encodeURIComponent(id)}`)
    .then(r => { if (!r.ok) throw new Error('not_found'); return r.json(); })
    .then(d => {
      const name = d.player?.name || d.player?.Name || null;
      _cacheName(id, name);
      return name;
    })
    .catch(() => null);
}

function resolveName(m) {
  const fromId = m.fromId || m.fromid || '';
  if (fromId.startsWith('qq_')) return fromId;
  if (fromId.startsWith('-') && _nameCache.has(fromId)) return _nameCache.get(fromId) || m.fromName || '?';
  return m.fromName || '?';
}

function ChatView({ logH, logW }) {
  const [channels, setChannels] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const sel = channels[selIdx];

  // 内部轮询频道列表（5s）
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/channels`)
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          const list = (d.channels || []).filter(ch => !ch.id.startsWith('sys_'));
          setChannels(list);
          setSelIdx(i => Math.min(i, list.length - 1));
        })
        .catch(e => { if (!cancelled) setError(e.message); });
    };
    load();
    const h = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(h); };
  }, []);

  // 内部轮询消息（选中频道变化时重置）
  useEffect(() => {
    if (!sel) { setMessages([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`http://${DB_HOST}:${DB_PORT}/api/sfmc/messages?channelId=${encodeURIComponent(sel.id)}`);
        if (cancelled) return;
        const d = await r.json();
        const msgs = (d.messages || []).slice(-(logH + 5));
        const todo = msgs.filter(m => {
          const id = m.fromId || m.fromid || '';
          return id.startsWith('-') && !_nameCache.has(id);
        });
        await Promise.all(todo.map(m => fetchPlayerName(m.fromId || m.fromid)));
        if (!cancelled) setMessages(msgs);
      } catch { /* ignore */ }
    };
    load();
    const h = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(h); };
  }, [sel?.id]);

  useInput((input, key) => {
    if (key.upArrow) { setSelIdx(i => Math.max(0, i - 1)); }
    if (key.downArrow) { setSelIdx(i => Math.min(channels.length - 1, i + 1)); }
  });

  const chanW = 18;
  const msgW = Math.max(10, logW - chanW - 2);

  return h(Box, { flexDirection: 'row', flexGrow: 1 },
    // Channel list
    h(Box, { width: chanW, flexDirection: 'column', marginRight: 1 },
      h(Text, { bold: true, color: T.primary }, ' 频道'),
      h(Text, { color: T.separator }, ` ${'─'.repeat(chanW - 2)}`),
      ...channels.slice(0, Math.max(3, logH + 3)).map((ch, i) =>
        h(Box, { key: ch.id, backgroundColor: i === selIdx ? T.focusBg : T.panel },
          h(Text, { color: i === selIdx ? T.primary : T.text },
            `${i === selIdx ? '→' : ' '}${ch.name}`),
        ),
      ),
      error && h(Text, { color: T.error }, ` ${error}`),
    ),

    // Messages
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { bold: true, color: T.primary },
        sel ? `#${sel.name}` : '选择频道'),
      h(Text, { color: T.separator }, ` ${'─'.repeat(msgW)}`),
      ...messages.map((m, i) =>
        h(Text, { key: i, color: T.text },
          msgW ? `${resolveName(m)}: ${(m.content || '').slice(0, msgW)}` : ''),
      ),
      messages.length === 0 && h(Text, { color: T.muted }, ' 暂无消息'),
    ),
  );
}

export { ChatView };
