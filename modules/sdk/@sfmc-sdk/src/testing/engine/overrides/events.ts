/**
 * 事件信号：对齐 @minecraft/server 的 subscribe / unsubscribe 形状。
 */

export type EventHandler<T> = (event: T) => void;

/** emit 同步调用所有订阅后的摘要（测试 / playground 可观测）。 */
export type EventEmitResult = {
  listeners: number;
  errors: { message: string; stack?: string }[];
};

export interface EventSignal<T> {
  subscribe(handler: EventHandler<T>, options?: unknown): (event: T) => void;
  unsubscribe(handler: EventHandler<T>): void;
  /** 测试侧触发（非 MC 公开 API，仅沙箱）：同步调用已订阅回调。 */
  emit(event: T): EventEmitResult;
  clear(): void;
  size(): number;
}

function toEmitError(e: unknown): { message: string; stack?: string } {
  if (e instanceof Error) {
    const row: { message: string; stack?: string } = { message: e.message };
    if (e.stack) row.stack = e.stack;
    return row;
  }
  return { message: String(e) };
}

export function createEventSignal<T>(): EventSignal<T> {
  const handlers: EventHandler<T>[] = [];
  return {
    subscribe(handler, _options?) {
      handlers.push(handler);
      return handler;
    },
    unsubscribe(handler) {
      const i = handlers.indexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    },
    emit(event) {
      const snapshot = [...handlers];
      const errors: { message: string; stack?: string }[] = [];
      for (const h of snapshot) {
        try {
          const ret = h(event) as unknown;
          // async 回调拒绝无法进同步 errors，至少打日志避免「看起来没跑到」
          if (ret != null && typeof (ret as { then?: unknown }).then === "function") {
            void Promise.resolve(ret).catch((e) => {
              const err = toEmitError(e);
              console.error(`[sfmc-testing] event listener rejected: ${err.message}`);
            });
          }
        } catch (e) {
          const err = toEmitError(e);
          errors.push(err);
          console.error(`[sfmc-testing] event listener threw: ${err.message}`);
        }
      }
      return { listeners: snapshot.length, errors };
    },
    clear() {
      handlers.length = 0;
    },
    size() {
      return handlers.length;
    },
  };
}

/** 1:1 事件 hub：访问任意信号名时惰性 createEventSignal。 */
export function createEventHub<T = unknown>(
  seed?: Record<string, EventSignal<T>>
): Record<string, EventSignal<T>> & { _clearAll(): void; _signals(): Map<string, EventSignal<T>> } {
  const map = new Map<string, EventSignal<T>>();
  if (seed) {
    for (const [k, v] of Object.entries(seed)) map.set(k, v);
  }
  const hub = new Proxy({} as Record<string, EventSignal<T>>, {
    get(_t, prop) {
      if (prop === "_clearAll") {
        return () => {
          for (const s of map.values()) s.clear();
          map.clear();
        };
      }
      if (prop === "_signals") return () => map;
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") return undefined;
      if (!map.has(prop)) map.set(prop, createEventSignal<T>());
      return map.get(prop);
    },
    has(_t, prop) {
      return typeof prop === "string" && prop !== "then";
    },
    ownKeys() {
      return [...map.keys()];
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (typeof prop !== "string") return undefined;
      return { configurable: true, enumerable: true, value: hub[prop] };
    },
  }) as Record<string, EventSignal<T>> & {
    _clearAll(): void;
    _signals(): Map<string, EventSignal<T>>;
  };
  return hub;
}
