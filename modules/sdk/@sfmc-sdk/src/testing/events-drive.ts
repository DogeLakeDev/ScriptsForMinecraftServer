/**
 * sb.events — 按路径 1:1 emit（hub + Event 类型来自 playground-meta）
 */

import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";
import type { FakeWorld } from "./engine/world.js";
import type { FakeSystem } from "./engine/system.js";
import type { EventSignal } from "./engine/events.js";
import type { SandboxObjects } from "./objects.js";

type Host = { world: FakeWorld; system: FakeSystem; objects?: SandboxObjects };

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

export function createEventsDrive(host: Host) {
  return {
    meta: PLAYGROUND_META.events,
    eventTypes: PLAYGROUND_META.eventTypes,
    /** 路径如 world.afterEvents.playerJoin */
    emit(path: string, payload: unknown = {}): void {
      if (!knownPath(path)) {
        throw new Error(`event not in PLAYGROUND_META: ${path}`);
      }
      let resolved = payload;
      if (host.objects && payload && typeof payload === "object") {
        resolved = host.objects.resolve(payload);
      }
      resolveSignal(host, path).emit(resolved);
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
