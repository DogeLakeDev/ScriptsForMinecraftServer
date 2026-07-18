"use strict";
/**
 * memory.ts — 进程内内存缓冲 (sfmc 主进程用)
 *
 * 替代原 sfmc/src/logs.ts 的 allLogs + subscribers 逻辑。
 * 作为 sink 接入 createLogger,或单独通过 pushDirect 写入。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryBuffer = createMemoryBuffer;
function createMemoryBuffer(maxSize = 5000) {
    const allLogs = [];
    const subscribers = [];
    function push(entry) {
        allLogs.push(entry);
        if (allLogs.length > maxSize)
            allLogs.splice(0, allLogs.length - maxSize);
        for (const fn of subscribers) {
            try {
                fn(entry);
            }
            catch {
                /* ignore */
            }
        }
    }
    return {
        sink: {
            write(entry) {
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
            const filtered = [];
            for (let i = allLogs.length - 1; i >= 0 && filtered.length < n; i--) {
                const l = allLogs[i];
                if (lvls.length && !lvls.includes(l.level))
                    continue;
                if (srcs.length && !srcs.includes(l.source))
                    continue;
                filtered.unshift(l);
            }
            return filtered;
        },
        subscribe(fn) {
            subscribers.push(fn);
            return () => {
                const idx = subscribers.indexOf(fn);
                if (idx >= 0)
                    subscribers.splice(idx, 1);
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
//# sourceMappingURL=memory.js.map