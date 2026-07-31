/**
 * sb.events — 按路径 1:1 emit（hub + Event 类型来自 playground-meta）
 */

import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";
import type { FakeWorld } from "./engine/overrides/world.js";
import type { FakeSystem } from "./engine/overrides/system.js";
import type { EventEmitResult, EventSignal } from "./engine/overrides/events.js";
import type { SandboxObjects } from "./objects.js";

type Host = { world: FakeWorld; system: FakeSystem; objects?: SandboxObjects };

export type EventsEmitMeta = {
  path: string;
  listeners: number;
  errors: { message: string; stack?: string }[];
};

function resolveSignal(host: Host, path: string): EventSignal<unknown> {
  const parts = path.split(".");
  if (parts.length !== 3) {
    throw new Error(`invalid event path: ${path}`);
  }
  const root = parts[0]!;
  const hub = parts[1]!;
  const signal = parts[2]!;
  const bag =
    root === "world"
      ? (host.world as unknown as Record<string, Record<string, EventSignal<unknown>>>)[hub]
      : root === "system"
        ? (host.system as unknown as Record<string, Record<string, EventSignal<unknown>>>)[hub]
        : undefined;
  if (!bag) throw new Error(`unknown event root: ${path}`);
  const sig = bag[signal];
  if (!sig || typeof sig.emit !== "function") {
    throw new Error(`unknown or non-emit signal: ${path}`);
  }
  return sig;
}

function knownPath(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLAYGROUND_META.eventTypes, path);
}

/** payload 树是否含 $ref（有则须解析成实例；无则保持同一引用供 cancel 等原地改写）。 */
function payloadNeedsResolve(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(payloadNeedsResolve);
  const o = value as Record<string, unknown>;
  if (typeof o.$ref === "string") return true;
  return Object.values(o).some(payloadNeedsResolve);
}

export function createEventsDrive(host: Host) {
  let lastMeta: EventsEmitMeta | null = null;

  return {
    meta: PLAYGROUND_META.events,
    eventTypes: PLAYGROUND_META.eventTypes,
    /** 最近一次 emit 的订阅数 / 回调错误（供 playground lastEmit） */
    lastMeta(): EventsEmitMeta | null {
      return lastMeta;
    },
    /** 当前信号上已 subscribe 的回调数 */
    listenerCount(path: string): number {
      if (!knownPath(path)) {
        throw new Error(`event not in PLAYGROUND_META: ${path}`);
      }
      return resolveSignal(host, path).size();
    },
    /**
     * 已有 listener 的事件 path 摘要（只扫 hub 已物化信号，不惰性造空信号）。
     * 含模块 registerEvents 与宿主 chat→命令桥等。
     */
    subscribedPaths(): { path: string; listeners: number }[] {
      const out: { path: string; listeners: number }[] = [];
      const hubs: { root: "world" | "system"; name: string; bag: unknown }[] = [
        { root: "world", name: "afterEvents", bag: host.world.afterEvents },
        { root: "world", name: "beforeEvents", bag: host.world.beforeEvents },
        { root: "system", name: "afterEvents", bag: host.system.afterEvents },
        { root: "system", name: "beforeEvents", bag: host.system.beforeEvents },
      ];
      for (const h of hubs) {
        const bag = h.bag as { _signals?: () => Map<string, EventSignal<unknown>> };
        const signals = typeof bag?._signals === "function" ? bag._signals() : null;
        if (!signals) continue;
        for (const [signal, sig] of signals) {
          const n = sig.size();
          if (n <= 0) continue;
          const path = `${h.root}.${h.name}.${signal}`;
          if (!knownPath(path)) continue;
          out.push({ path, listeners: n });
        }
      }
      return out.sort((a, b) => a.path.localeCompare(b.path));
    },
    /**
     * 路径如 world.afterEvents.playerJoin；
     * 同步调用该信号全部订阅回调，返回 emit 后的事件对象（可含 cancel 等副作用）。
     */
    emit(path: string, payload: unknown = {}): unknown {
      if (!knownPath(path)) {
        throw new Error(`event not in PLAYGROUND_META: ${path}`);
      }
      let resolved = payload;
      if (host.objects && payload && typeof payload === "object" && payloadNeedsResolve(payload)) {
        resolved = host.objects.resolve(payload);
      }
      const result: EventEmitResult = resolveSignal(host, path).emit(resolved);
      lastMeta = {
        path,
        listeners: result.listeners,
        errors: result.errors,
      };
      return resolved;
    },
    /** 信号对应的 Event 类名 */
    eventType(path: string): string | undefined {
      const e = PLAYGROUND_META.eventTypes[path as keyof typeof PLAYGROUND_META.eventTypes];
      return e?.eventType;
    },
    paths(): string[] {
      return Object.keys(PLAYGROUND_META.eventTypes).sort();
    },
  };
}

export type SandboxEvents = ReturnType<typeof createEventsDrive>;
