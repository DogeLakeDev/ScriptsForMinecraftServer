/**
 * log-buffer-hooks.js — React hook 桥接 log buffer 变化
 */
import { useState, useEffect } from 'react';
import { logBuf, logFns } from './log-buffer.js';

export function useLogs(sourceFilter) {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    logFns.add(f);
    return () => logFns.delete(f);
  }, []);
  const all = sourceFilter ? logBuf.filter(e => e.source === sourceFilter) : logBuf;
  return { total: all.length, all };
}
