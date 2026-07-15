/**
 * ChatView.js — 频道聊天记录视图
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
const h = React.createElement;
import { T } from '../theme.js';
import { getJson } from '../api/client.js';
import { StatusLine } from '../ui/Feedback.js';

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
  return getJson(`/api/sfmc/players/${encodeURIComponent(id)}`)
    .then(d => {
      const name = d.player?.name || d.player?.Name || null;
      _cacheName(id, name);
      return name;
    })
    .catch(() => null);
}

function resolveName(m) {
  const fromId = m.fromId || m.fromid || m.from_id || '';
  if (fromId.startsWith('qq_')) return fromId;
  if (_nameCache.has(fromId)) return _nameCache.get(fromId) || m.fromName || m.from_name || '?';
  return m.fromName || m.from_name || '?';
}

function ChatView({ logH, logW, inputActive = true, registerZone }) {
  const [channels, setChannels] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState('channels');
  const [messageScroll, setMessageScroll] = useState(0);
  const [followLatest, setFollowLatest] = useState(true);

  const sel = channels[selIdx];

  useEffect(() => {
    if (!registerZone) return;
    registerZone({ consumesDigits: false });
    return () => registerZone({ consumesDigits: false });
  }, [registerZone]);

  // 内部轮询频道列表（5s）
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getJson('/api/sfmc/channels')
        .then(d => {
          if (cancelled) return;
          const list = (d.channels || []).filter(ch => !ch.id.startsWith('sys_'));
          setChannels(list);
          setSelIdx(i => Math.max(0, Math.min(i, Math.max(0, list.length - 1))));
          setError(null);
        })
        .catch(e => { if (!cancelled) setError(e.message); });
    };
    load();
    const h = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(h); };
  }, []);

  // 内部轮询消息（选中频道变化时重置）
  useEffect(() => {
    if (!sel) { setMessages([]); setMessageScroll(0); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const d = await getJson(`/api/sfmc/messages?channelId=${encodeURIComponent(sel.id)}`);
        if (cancelled) return;
        const msgs = d.messages || [];
        const todo = msgs.filter(m => {
          const id = m.fromId || m.fromid || m.from_id || '';
          return !!id && !id.startsWith('qq_') && !_nameCache.has(id);
        });
        await Promise.all(todo.map(m => fetchPlayerName(m.fromId || m.fromid || m.from_id)));
        if (!cancelled) {
          setMessages(msgs);
          if (followLatest) setMessageScroll(0);
        }
      } catch (e) {
        if (!cancelled) setError(`消息刷新失败: ${e.message}`);
      }
    };
    load();
    const h = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(h); };
  }, [sel?.id, followLatest]);

  useInput((input, key) => {
    if (key.leftArrow) { setFocus('channels'); return; }
    if (key.rightArrow) { setFocus('messages'); return; }
    if (input === 'l') { setFollowLatest((value) => !value); return; }
    if (focus === 'channels') {
      if (key.upArrow) { setSelIdx(i => Math.max(0, i - 1)); }
      if (key.downArrow) { setSelIdx(i => Math.min(channels.length - 1, i + 1)); }
      return;
    }
    const maxMessages = Math.max(1, logH + 3);
    if (key.upArrow) { setFollowLatest(false); setMessageScroll((s) => Math.min(Math.max(0, messages.length - maxMessages), s + 1)); }
    if (key.downArrow) setMessageScroll((s) => Math.max(0, s - 1));
    if (key.home) setMessageScroll(Math.max(0, messages.length - maxMessages));
    if (key.end) setMessageScroll(0);
  }, { isActive: inputActive });

  const chanW = 18;
  const msgW = Math.max(10, logW - chanW - 2);
  const maxChannels = Math.max(3, logH + 3);
  const channelStart = Math.max(0, Math.min(selIdx - Math.floor(maxChannels / 2), Math.max(0, channels.length - maxChannels)));
  const visibleChannels = channels.slice(channelStart, channelStart + maxChannels);
  const maxMessages = Math.max(1, logH + 3);
  const messageEnd = Math.max(0, messages.length - messageScroll);
  const visibleMessages = messages.slice(Math.max(0, messageEnd - maxMessages), messageEnd);

  return h(Box, { flexDirection: 'row', flexGrow: 1 },
    // Channel list
    h(Box, { width: chanW, flexDirection: 'column', marginRight: 1 },
      h(Text, { bold: true, color: focus === 'channels' ? T.primary : T.muted }, ' 频道'),
      h(Text, { color: T.separator }, ` ${'─'.repeat(chanW - 2)}`),
       channelStart > 0 && h(Text, { color: T.muted }, ' ↑ 更多'),
       ...visibleChannels.map((ch, i) => {
         const idx = channelStart + i;
          return h(Box, { key: ch.id, backgroundColor: idx === selIdx ? T.focusBg : T.panel },
            h(Text, { color: idx === selIdx ? T.primary : T.text },
              `${idx === selIdx ? '→' : ' '}${ch.name}`),
          );
        }),
       channelStart + maxChannels < channels.length && h(Text, { color: T.muted }, ' ↓ 更多'),
      error && h(Text, { color: T.error }, ` ${error}`),
    ),

    // Messages
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { bold: true, color: focus === 'messages' ? T.primary : T.muted },
        sel ? `#${sel.name}` : '选择频道'),
      h(Text, { color: followLatest ? T.success : T.warning },
        ` ${followLatest ? '[● 跟随最新]' : '[○ 已暂停]'}  按 l 切换`),
      h(Text, { color: T.separator }, ` ${'─'.repeat(msgW)}`),
      messageScroll < messages.length - maxMessages && h(Text, { color: T.muted }, ' ↑ 更早消息'),
      ...visibleMessages.map((m, i) =>
        h(Text, { key: i, color: T.text },
          msgW ? `${resolveName(m)}: ${(m.content || '').slice(0, msgW)}` : ''),
      ),
      messages.length === 0 && h(StatusLine, { kind: 'empty' }, '暂无消息'),
      h(Text, { color: T.muted }, `←→切换栏  ↑↓滚动  l:${followLatest ? '跟随最新' : '暂停跟随'}`),
    ),
  );
}

export { ChatView };
