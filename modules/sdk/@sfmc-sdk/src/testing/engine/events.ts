/**
 * 事件信号：对齐 @minecraft/server 的 subscribe / unsubscribe 形状。
 */

export type EventHandler<T> = (event: T) => void;

export interface EventSignal<T> {
  subscribe(handler: EventHandler<T>, options?: unknown): (event: T) => void;
  unsubscribe(handler: EventHandler<T>): void;
  /** 测试侧触发（非 MC 公开 API，仅沙箱）。 */
  emit(event: T): void;
  clear(): void;
  size(): number;
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
      for (const h of [...handlers]) {
        try {
          h(event);
        } catch {
          /* 单个坏 handler 不影响其余 */
        }
      }
    },
    clear() {
      handlers.length = 0;
    },
    size() {
      return handlers.length;
    },
  };
}
