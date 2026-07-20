/**
 * memory.ts — 进程内内存缓冲 (sfmc 主进程用)
 *
 * 替代原 sfmc/src/logs.ts 的 allLogs + subscribers 逻辑。
 * 作为 sink 接入 createLogger,或单独通过 pushDirect 写入。
 */

import type { LogEntry, LogLevel, LogSource, Sink } from "./types.js";

export interface MemoryBuffer {
  /** 作为 sink 接入 logger */
  sink: Sink;
  /** 直接写入一条 entry (供 services.ts 捕获子进程 stdout 后调用) */
  pushDirect(text: string, source: LogSource, level: LogLevel): void;
  /** 获取全部日志 (按时间顺序) */
  getAll(): LogEntry[];
  /** 获取最近 n 条,可按 level / source 过滤 */
  getRecent(n: number, levels?: LogLevel[], sources?: LogSource[]): LogEntry[];
  /** 订阅新日志事件,返回取消订阅函数 */
  subscribe(fn: (entry: LogEntry) => void): () => void;
  /** 清空缓冲 */
  clear(): void;
  /** 当前缓冲条数 */
  readonly size: number;
}

export function createMemoryBuffer(maxSize = 5000): MemoryBuffer {
  const allLogs: LogEntry[] = [];
  const subscribers: Array<(entry: LogEntry) => void> = [];

  function push(entry: LogEntry): void {
    allLogs.push(entry);
    if (allLogs.length > maxSize) allLogs.splice(0, allLogs.length - maxSize);
    for (const fn of subscribers) {
      try {
        fn(entry);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    sink: {
      write(entry: LogEntry): void {
        push(entry);
      },
    },
    pushDirect(text, source, level) {
      push({ time: new Date(), text, source, level });
    },
    getAll() {
      return allLogs.slice();
    },
    getRecent(n, levels, sources) {
      const lvls = levels ?? [];
      const srcs = sources ?? [];
      const filtered: LogEntry[] = [];
      for (let i = allLogs.length - 1; i >= 0 && filtered.length < n; i--) {
        const l = allLogs[i]!;
        if (lvls.length && !lvls.includes(l.level)) continue;
        if (srcs.length && !srcs.includes(l.source)) continue;
        filtered.unshift(l);
      }
      return filtered;
    },
    subscribe(fn) {
      subscribers.push(fn);
      return () => {
        const idx = subscribers.indexOf(fn);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    clear() {
      allLogs.length = 0;
    },
    get size() {
      return allLogs.length;
    },
  };
}
