import { system } from "@minecraft/server";
import { ConfigManager } from "./internal/config-manager.js";
import { ModuleId, Modules } from "./internal/module-keys.js";
import { setConfigModuleContext, clearConfigModuleContext } from "../sapi/config/client.js";
import {
  setDbModuleContext,
  clearDbModuleContext,
  isDbTxRecording,
} from "../sapi/db/client.js";
import { setServiceModuleContext, clearServiceModuleContext } from "../sapi/service/client.js";
// Command 类尚未迁入 @sfmc-bds/sdk (Stage F 之后实装)。本批 (Stage A+B) 把所有
// Command.unregister / Command.unregisterByModule 调用换成 stub,行为等价 noop;
// 实际命令注销由 modules 自己在 cleanup() 中调各自的 unregister 接口(已存在)。
// 完整迁移后这里恢复 import { Command } from "../sapi/host/index.js" + 值调用。
const _cmdUnregister = (_name: string) => undefined;
const _cmdUnregisterByModule = (_module: string) => undefined;

export type ModuleLifecycle = {
  registerCommands?(): void;
  registerPermissions?(): void;
  registerEvents?(): void;
  init?(): void;
  cleanup?(): void;
};

export type ModuleDescriptor = {
  /**
   * 模块身份:优先用 catalog/manifest id(如 feature-afk)。
   * OCP:新模块不必改 Modules 枚举;旧键(afk)仍可通过 Modules 别名解析启停。
   */
  id: ModuleId;
  afterWorldLoad?: boolean;
  lifecycle: ModuleLifecycle;
};

type CleanUpFn = () => void;

const descriptors: ModuleDescriptor[] = [];
const cleanups = new Map<string, CleanUpFn[]>();
const booted = new Set<string>();
const lastEnabled = new Map<string, boolean>();
let worldLoaded = false;

/** 启停查询键:catalog id 本身 + 旧 Modules 枚举映射的 configKey。 */
function enableKeysFor(id: ModuleId): string[] {
  const keys = [id];
  const legacy = (Modules as Record<string, string>)[id];
  if (legacy && legacy !== id) keys.push(legacy);
  const configKey = ConfigManager.getModuleConfigKey(id);
  if (configKey && !keys.includes(configKey)) keys.push(configKey);
  return keys;
}

/** 启动前注入 db/config/service 模块身份(DIP:token 来自 configs/all,非 fs)。 */
function applyModuleAuthContext(id: ModuleId): void {
  const token = ConfigManager.getModuleToken(id);
  const configKey = ConfigManager.getModuleConfigKey(id) || (Modules as Record<string, string>)[id] || "";
  if (!token) {
    console.warn(
      `[Module:${id}] 无 module token(configs/all.module_tokens 缺失);` +
        ` v2 db/config/service 调用将 401`
    );
  }
  setDbModuleContext(id, token);
  setServiceModuleContext(id, token, isDbTxRecording);
  if (configKey) {
    setConfigModuleContext(id, configKey, token);
  }
}

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
    // 任一索引键启用即视为 active(id / legacy Modules / configKey)
    return enableKeysFor(id).some((k) => ConfigManager.isEnabled(k));
  }

  static trackCleanup(modId: ModuleId, fn: CleanUpFn): void {
    if (!cleanups.has(modId)) cleanups.set(modId, []);
    cleanups.get(modId)!.push(fn);
  }

  static trackCommand(modId: ModuleId, name: string): void {
    ModuleRegistry.trackCleanup(modId, () => _cmdUnregister(name));
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
      lastEnabled.set(d.id, ModuleRegistry.isActive(d.id));
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
      const cur = ModuleRegistry.isActive(d.id);
      const prev = lastEnabled.has(d.id) ? lastEnabled.get(d.id)! : cur;
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
      lastEnabled.set(d.id, cur);
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
        applyModuleAuthContext(d.id);
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
        applyModuleAuthContext(d.id);
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
      applyModuleAuthContext(id);
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
    // 2. 注销模块持有的命令(用 catalog id;旧 Modules 别名作次选)
    try {
      _cmdUnregisterByModule(id);
      const legacy = (Modules as Record<string, string>)[id];
      if (legacy) _cmdUnregisterByModule(legacy);
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
    // 清身份避免禁用后仍带旧 token 调用(Demeter:只清本模块上下文)
    clearDbModuleContext();
    clearConfigModuleContext();
    clearServiceModuleContext();
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
