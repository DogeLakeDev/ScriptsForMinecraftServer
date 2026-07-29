import { system } from "@minecraft/server";
import { debug } from "../sapi/runtime/debug-log.js";
import { ConfigManager } from "./internal/config-manager.js";
import { ModuleId } from "./internal/module-keys.js";
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

/** 模块生命周期钩子（各阶段可选）。 */
export type ModuleLifecycle = {
  /** 注册 `!` 指令。 */
  registerCommands?(): void;
  /** 注册命名权限。 */
  registerPermissions?(): void;
  /** 订阅游戏事件。 */
  registerEvents?(): void;
  /** 模块初始化（定时任务、世界加载后逻辑等）。 */
  init?(): void;
  /** 模块清理（注销事件、释放资源）。 */
  cleanup?(): void;
};

/** 模块注册描述符（由 `ModuleRegistry.register` 提交）。 */
export type ModuleDescriptor = {
  /**
   * 模块身份:优先用 catalog/manifest id(如 feature-afk)。
   * OCP:新模块不必改 Modules 枚举;旧键(afk)仍可通过 Modules 别名解析启停。
   */
  id: ModuleId;
  /** 为 true 时 init 推迟到 worldLoad 之后。 */
  afterWorldLoad?: boolean;
  /** 生命周期钩子集合。 */
  lifecycle: ModuleLifecycle;
};

/** 模块 cleanup 回调签名（供模块作者传给 `ModuleRegistry.trackCleanup`）。 */
export type CleanUpFn = () => void;

const descriptors: ModuleDescriptor[] = [];
const cleanups = new Map<string, CleanUpFn[]>();
const booted = new Set<string>();
const lastEnabled = new Map<string, boolean>();
let worldLoaded = false;

/** 启停查询键:catalog id 本身 + 旧 Modules 枚举映射的 configKey。 */
function enableKeysFor(id: ModuleId): string[] {
  const keys = [id];
  const configKey = ConfigManager.getModuleConfigKey(id);
  if (configKey && !keys.includes(configKey)) keys.push(configKey);
  return keys;
}

/** 启动前注入 db/config/service 模块身份(DIP:token 来自 configs/all,非 fs)。 */
function applyModuleAuthContext(id: ModuleId): void {
  const token = ConfigManager.getModuleToken(id);
  const configKey = ConfigManager.getModuleConfigKey(id) || "";
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

/** 模块注册表：启动、启停对账与 cleanup 追踪。 */
export class ModuleRegistry {
  /** 注册模块描述符（构建时各模块包调用）。 */
  static register(descriptor: ModuleDescriptor): void {
    descriptors.push(descriptor);
  }

  /** 返回已注册模块列表副本。 */
  static list(): ModuleDescriptor[] {
    return [...descriptors];
  }

  /** 按 id 查找模块描述符。 */
  static get(id: ModuleId): ModuleDescriptor | undefined {
    return descriptors.find((d) => d.id === id);
  }

  /** 模块是否处于启用且可启动状态。 */
  static isActive(id: ModuleId): boolean {
    // 任一索引键启用即视为 active(id / legacy Modules / configKey)
    return enableKeysFor(id).some((k) => ConfigManager.isEnabled(k));
  }

  /** 登记模块 cleanup 回调（禁用时统一执行）。 */
  static trackCleanup(modId: ModuleId, fn: CleanUpFn): void {
    if (!cleanups.has(modId)) cleanups.set(modId, []);
    cleanups.get(modId)!.push(fn);
  }

  /** 登记指令 cleanup（模块禁用时注销）。 */
  static trackCommand(modId: ModuleId, name: string): void {
    ModuleRegistry.trackCleanup(modId, () => _cmdUnregister(name));
  }

  /** 登记 system.runInterval/run 的 cleanup。 */
  static trackSystemRun(modId: ModuleId, runId: number): void {
    ModuleRegistry.trackCleanup(modId, () => {
      try {
        system.clearRun(runId);
      } catch {}
    });
  }

  /** 清空启停快照（测试或重建前）。 */
  static clearLastEnabled(): void {
    lastEnabled.clear();
  }

  /** 记录当前各模块启用状态，供后续 reconcile 对比。 */
  static snapshotEnabled(): void {
    for (const d of descriptors) {
      lastEnabled.set(d.id, ModuleRegistry.isActive(d.id));
    }
  }

  /**
   * 对比当前启用态与上次快照，对变化模块执行 cleanup/boot。
   * @returns 变更列表 `[{ id, action: 'disable'|'enable' }]`
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
          debug.e("Module", `[${d.id}] cleanup failed`, e);
        }
        changes.push({ id: d.id, action: "disable" });
      } else if (!prev && cur) {
        try {
          ModuleRegistry.bootModule(d.id);
        } catch (e) {
          debug.e("Module", `[${d.id}] boot failed`, e);
        }
        changes.push({ id: d.id, action: "enable" });
      }
      lastEnabled.set(d.id, cur);
    }
    return changes;
  }

  /** 启动所有已启用且尚未 boot 的模块。 */
  static bootAll(): void {
    if (!ConfigManager.isReady()) return;
    for (const d of descriptors) {
      if (!ModuleRegistry.isActive(d.id)) continue;
      ModuleRegistry.bootModule(d.id);
    }
  }

  /** 世界加载后：对 `afterWorldLoad` 模块执行 init。 */
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
        debug.e("Module", `[${d.id}] init failed`, e);
      }
    }
  }

  /** 对非 afterWorldLoad 模块执行 init（定时任务等）。 */
  static bootTasks(): void {
    if (!ConfigManager.isReady()) return;
    for (const d of descriptors) {
      if (d.afterWorldLoad) continue;
      if (!ModuleRegistry.isActive(d.id)) continue;
      try {
        applyModuleAuthContext(d.id);
        d.lifecycle.init?.();
      } catch (e) {
        debug.e("Module", `[${d.id}] task start failed`, e);
      }
    }
  }

  /** 启动单个模块（权限/命令/事件/init 按序）。 */
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
      debug.e("Module", `[${id}] boot failed`, e);
    }
  }

  /** 清理单个模块（cleanup 钩子、命令注销、身份上下文）。 */
  static cleanupModule(id: ModuleId): void {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    // 1. 调模块自身 cleanup
    try {
      d.lifecycle.cleanup?.();
    } catch (e) {
      debug.e("Module", `[${id}] cleanup hook failed`, e);
    }
    // 2. 注销模块持有的命令
    try {
      _cmdUnregisterByModule(id);
    } catch {}
    // 3. 注销模块注册的事件订阅 / runInterval
    const fns = cleanups.get(id);
    if (fns) {
      for (const fn of fns) {
        try {
          fn();
        } catch (e) {
          debug.e("Module", `[${id}] cleanup fn failed`, e);
        }
      }
      cleanups.set(id, []);
    }
    booted.delete(id);
    // 清身份避免禁用后仍带旧 token 调用(Demeter:只清本模块上下文,勿误清其他模块桶)
    clearDbModuleContext(id);
    clearConfigModuleContext(id);
    clearServiceModuleContext(id);
  }

  /** 清理全部已注册模块（shutdown 时调用）。 */
  static teardown(): void {
    for (const d of descriptors) {
      try {
        ModuleRegistry.cleanupModule(d.id);
      } catch {}
    }
  }

  /** 模块是否已完成 boot。 */
  static isBooted(id: ModuleId): boolean {
    return booted.has(id);
  }
}

/** 事件处理器守卫：ConfigManager 未就绪时跳过。 */
export function guardEvent(): boolean {
  return ConfigManager.isReady();
}

/** 控制台打印当前已启动模块列表。 */
export function announceLoaded(): void {
  const active = descriptors.filter((d) => ModuleRegistry.isActive(d.id)).map((d) => d.id);
  console.log(`[ModuleRegistry] 已启动模块: ${active.join(", ") || "无"}`);
}
