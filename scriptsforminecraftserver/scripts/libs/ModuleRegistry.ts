import { system } from "@minecraft/server";
import { Command } from "./Command";
import { ConfigManager } from "./ConfigManager";
import { ModuleId, Modules } from "./ModuleKeys";

export type ModuleLifecycle = {
  registerCommands?(): void;
  registerPermissions?(): void;
  registerEvents?(): void;
  init?(): void;
  cleanup?(): void;
};

export type ModuleDescriptor = {
  id: ModuleId;
  afterWorldLoad?: boolean;
  lifecycle: ModuleLifecycle;
};

type CleanUpFn = () => void;

const descriptors: ModuleDescriptor[] = [];
const cleanups = new Map<ModuleId, CleanUpFn[]>();
const booted = new Set<ModuleId>();
const lastEnabled = new Map<string, boolean>();
let worldLoaded = false;

export class ModuleRegistry {
  static register(descriptor: ModuleDescriptor): void {
    descriptors.push(descriptor);
  }

  static list(): ModuleDescriptor[] {
    return [...descriptors];
  }

  static get(id: ModuleId): ModuleDescriptor | undefined {
    return descriptors.find((d) => d.id === id);
  }

  static isActive(id: ModuleId): boolean {
    return ConfigManager.isEnabled(Modules[id]);
  }

  static trackCleanup(modId: ModuleId, fn: CleanUpFn): void {
    if (!cleanups.has(modId)) cleanups.set(modId, []);
    cleanups.get(modId)!.push(fn);
  }

  static trackCommand(modId: ModuleId, name: string): void {
    ModuleRegistry.trackCleanup(modId, () => Command.unregister(name));
  }

  static trackSystemRun(modId: ModuleId, runId: number): void {
    ModuleRegistry.trackCleanup(modId, () => {
      try {
        system.clearRun(runId);
      } catch {}
    });
  }

  static clearLastEnabled(): void {
    lastEnabled.clear();
  }

  static snapshotEnabled(): void {
    for (const d of descriptors) {
      lastEnabled.set(Modules[d.id], ModuleRegistry.isActive(d.id));
    }
  }

  /**
   * Compare current enabled state vs last snapshot, call cleanup/boot for changed modules.
   * Returned array: [{ id, action: 'disable'|'enable' }]
   */
  static reconcile(): Array<{ id: ModuleId; action: "disable" | "enable" }> {
    if (!ConfigManager.isReady()) return [];
    const changes: Array<{ id: ModuleId; action: "disable" | "enable" }> = [];
    for (const d of descriptors) {
      const key = Modules[d.id];
      const cur = ModuleRegistry.isActive(d.id);
      const prev = lastEnabled.has(key) ? lastEnabled.get(key)! : cur;
      if (prev === cur) continue;
      if (prev && !cur) {
        try {
          ModuleRegistry.cleanupModule(d.id);
        } catch (e) {
          console.warn(`[Module:${d.id}] cleanup failed: ${(e as Error).message || e}`);
        }
        changes.push({ id: d.id, action: "disable" });
      } else if (!prev && cur) {
        try {
          ModuleRegistry.bootModule(d.id);
        } catch (e) {
          console.warn(`[Module:${d.id}] boot failed: ${(e as Error).message || e}`);
        }
        changes.push({ id: d.id, action: "enable" });
      }
      lastEnabled.set(key, cur);
    }
    return changes;
  }

  static bootAll(): void {
    if (!ConfigManager.isReady()) return;
    for (const d of descriptors) {
      if (!ModuleRegistry.isActive(d.id)) continue;
      ModuleRegistry.bootModule(d.id);
    }
  }

  static bootAfterWorldLoad(): void {
    if (!ConfigManager.isReady()) return;
    worldLoaded = true;
    for (const d of descriptors) {
      if (!d.afterWorldLoad) continue;
      if (!ModuleRegistry.isActive(d.id)) continue;
      try {
        d.lifecycle.init?.();
      } catch (e) {
        console.warn(`[Module:${d.id}] init failed: ${(e as Error).message || e}`);
      }
    }
  }

  static bootTasks(): void {
    if (!ConfigManager.isReady()) return;
    for (const d of descriptors) {
      if (d.afterWorldLoad) continue;
      if (!ModuleRegistry.isActive(d.id)) continue;
      try {
        d.lifecycle.init?.();
      } catch (e) {
        console.warn(`[Module:${d.id}] task start failed: ${(e as Error).message || e}`);
      }
    }
  }

  static bootModule(id: ModuleId): void {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    if (!ModuleRegistry.isActive(id)) return;
    if (booted.has(id)) return;
    try {
      d.lifecycle.registerPermissions?.();
      d.lifecycle.registerCommands?.();
      d.lifecycle.registerEvents?.();
      if (!d.afterWorldLoad || worldLoaded) {
        d.lifecycle.init?.();
      }
      booted.add(id);
    } catch (e) {
      console.warn(`[Module:${id}] boot failed: ${(e as Error).message || e}`);
    }
  }

  static cleanupModule(id: ModuleId): void {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    // 1. 调模块自身 cleanup
    try {
      d.lifecycle.cleanup?.();
    } catch (e) {
      console.warn(`[Module:${id}] cleanup hook failed: ${(e as Error).message || e}`);
    }
    // 2. 注销模块持有的命令
    try {
      Command.unregisterByModule(Modules[id]);
    } catch {}
    // 3. 注销模块注册的事件订阅 / runInterval
    const fns = cleanups.get(id);
    if (fns) {
      for (const fn of fns) {
        try {
          fn();
        } catch (e) {
          console.warn(`[Module:${id}] cleanup fn failed: ${(e as Error).message || e}`);
        }
      }
      cleanups.set(id, []);
    }
    booted.delete(id);
  }

  static teardown(): void {
    for (const d of descriptors) {
      try {
        ModuleRegistry.cleanupModule(d.id);
      } catch {}
    }
  }

  static isBooted(id: ModuleId): boolean {
    return booted.has(id);
  }
}

export function guardEvent(): boolean {
  return ConfigManager.isReady();
}

export function announceLoaded(): void {
  const active = descriptors.filter((d) => ModuleRegistry.isActive(d.id)).map((d) => d.id);
  console.log(`[ModuleRegistry] 已启动模块: ${active.join(", ") || "无"}`);
}
