import type { ConfigClient } from "../sapi/config/client.js";
import type { DbClient } from "../sapi/db/client.js";
import { debug } from "../sapi/runtime/debug-log.js";
import type { ServiceClient } from "../sapi/service/client.js";
import { ConfigManager } from "./internal/config-manager.js";

/** catalog/manifest 模块 id（如 feature-afk）。 */
export type ModuleId = string;

/**
 * BDS SAPI host 抽象（由 install.ts 在 BDS 进程里注入）。
 * 模块 loader 只调用 stub 接口，不直接 import @minecraft/server——
 * 让模块 entry 在 `node --test` 等非 BDS 环境里也能 import module-loader。
 */
export type BdsSystem = {
  clearRun(id: number): void;
  runInterval?(cb: () => void, ticks?: number): number;
  run?(cb: () => void, ticks?: number): number;
};

/**
 * 模块作用域运行时客户端（由 installHostBootstrap 在 apply 时装配）。
 * 生命周期钩子应闭包捕获此处的 db/config/service，避免使用进程级单例串身份。
 */
export type ModuleServices = {
  db: DbClient;
  config: ConfigClient;
  service: ServiceClient;
};

/**
 * 模块身份注入钩子（db/config/service client）。
 * 由 `module-loader/install` 绑定真实实现；测试环境可 noop 或不绑。
 * apply 可返回 ModuleServices，供 lifecycle 闭包捕获（方案 A）。
 */
export type ModuleAuthHooks = {
  apply(id: string, token: string, configKey: string): ModuleServices | void;
  clear(id: string): void;
};

export {}; /* 确保本文件被当作 module（declare global 才能生效） */

declare global {
  // eslint-disable-next-line no-var
  var __sfmcBdsSystem: BdsSystem | undefined;
}

interface GlobalModuleLoaderState {
  descriptors: ModuleDescriptor[];
  booted: Set<string>;
  initialized: Set<string>;
  worldLoaded: boolean;
  authHooks: ModuleAuthHooks | null;
}

const gModuleState: GlobalModuleLoaderState = (((globalThis as unknown as Record<string, unknown>)
  .__sfmcModuleLoaderState as GlobalModuleLoaderState) ??= {
  descriptors: [],
  booted: new Set<string>(),
  initialized: new Set<string>(),
  worldLoaded: false,
  authHooks: null,
});

/** 由 installHostBootstrap 注入 db/config/service 身份钩子（DIP）。 */
export function bindModuleAuthHooks(hooks: ModuleAuthHooks): void {
  gModuleState.authHooks = hooks;
}

/** 模块生命周期钩子（各阶段可选）。services 为作用域客户端。命令须在模块顶层声明。 */
export type ModuleLifecycle = {
  /** 注册命名权限。 */
  registerPermissions?(services?: ModuleServices): void;
  /** 订阅游戏事件。 */
  registerEvents?(services?: ModuleServices): void;
  /** 模块初始化（定时任务、世界加载后逻辑等）。 */
  init?(services?: ModuleServices): void;
  /** 模块清理（注销事件、释放资源）。 */
  cleanup?(services?: ModuleServices): void;
};

/** 模块注册描述符（由 `ModuleRegistry.register` 提交）。 */
export type ModuleDescriptor = {
  /**
   * 模块身份:优先用 catalog/manifest id(如 feature-afk)。
   * 启停同时按 catalog id 与 configKey 双索引查询。
   */
  id: ModuleId;
  /** 为 true 时 init 推迟到 worldLoad 之后。 */
  afterWorldLoad?: boolean;
  /** 生命周期钩子集合。 */
  lifecycle: ModuleLifecycle;
};

/** 启停查询键:catalog id 本身 + 对应 configKey。 */
function enableKeysFor(id: ModuleId): string[] {
  const keys = [id];
  const configKey = ConfigManager.getModuleConfigKey(id);
  if (configKey && !keys.includes(configKey)) keys.push(configKey);
  return keys;
}

/** 启动前注入 db/config/service 模块身份(DIP:token 来自 configs/all,非 fs)。 */
function applyModuleAuthContext(id: ModuleId): ModuleServices | undefined {
  const token = ConfigManager.getModuleToken(id);
  const configKey = ConfigManager.getModuleConfigKey(id) || "";
  if (!token) {
    console.warn(
      `[Module:${id}] 无 module token(configs/all.module_tokens 缺失);` + ` v2 db/config/service 调用将 401`
    );
  }
  const services = gModuleState.authHooks?.apply(id, token, configKey);
  return services || undefined;
}

/** 模块注册表：冷启动生命周期与 shutdown cleanup。 */
export class ModuleRegistry {
  /** 注册模块描述符（构建时各模块包调用）。 */
  static register(descriptor: ModuleDescriptor): void {
    gModuleState.descriptors.push(descriptor);
  }

  /** 返回已注册模块列表副本。 */
  static list(): ModuleDescriptor[] {
    return [...gModuleState.descriptors];
  }

  /** 按 id 查找模块描述符。 */
  static get(id: ModuleId): ModuleDescriptor | undefined {
    return gModuleState.descriptors.find((d) => d.id === id);
  }

  /** 模块是否处于启用且可启动状态（启动时 ConfigManager 缓存）。 */
  static isActive(id: ModuleId): boolean {
    return enableKeysFor(id).some((k) => ConfigManager.isEnabled(k));
  }

  /** 启动所有已启用且尚未 boot 的模块（串行等待以防多模块并发 init 状态污染）。 */
  static async bootAll(): Promise<void> {
    if (!ConfigManager.isReady()) return;
    for (const d of gModuleState.descriptors) {
      if (!ModuleRegistry.isActive(d.id)) continue;
      await ModuleRegistry.bootModule(d.id);
    }
  }

  /** 世界加载后：对已 boot 且未 init 的 afterWorldLoad 模块执行 init。 */
  static async bootAfterWorldLoad(): Promise<void> {
    if (!ConfigManager.isReady()) return;
    gModuleState.worldLoaded = true;
    for (const d of gModuleState.descriptors) {
      if (!d.afterWorldLoad) continue;
      if (!ModuleRegistry.isActive(d.id)) continue;
      if (!gModuleState.booted.has(d.id)) continue;
      if (gModuleState.initialized.has(d.id)) continue;
      await ModuleRegistry.initModule(d.id);
    }
  }

  /** 启动单个模块（权限/事件；init 按 afterWorldLoad 分相）。 */
  static async bootModule(id: ModuleId): Promise<void> {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    if (!ModuleRegistry.isActive(id)) return;
    if (gModuleState.booted.has(id)) return;
    try {
      const services = applyModuleAuthContext(id);
      try {
        d.lifecycle.registerPermissions?.(services);
      } catch (e) {
        debug.e("Module", `[${id}] registerPermissions failed`, e);
      }
      try {
        d.lifecycle.registerEvents?.(services);
      } catch (e) {
        debug.e("Module", `[${id}] registerEvents failed`, e);
      }
      gModuleState.booted.add(id);
      if (!d.afterWorldLoad || gModuleState.worldLoaded) {
        await ModuleRegistry.initModule(id);
      }
    } catch (e) {
      debug.e("Module", `[${id}] boot failed`, e);
    }
  }

  /** 执行单个模块的 init 生命周期（串行等待异步就绪并标记 initialized）。 */
  static async initModule(id: ModuleId): Promise<void> {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    if (gModuleState.initialized.has(id)) return;
    try {
      const services = applyModuleAuthContext(id);
      const res = d.lifecycle.init?.(services);
      if (res && typeof (res as Promise<void>).then === "function") {
        await res;
      }
      gModuleState.initialized.add(id);
    } catch (e) {
      debug.e("Module", `[${id}] init failed`, e);
    }
  }

  /** 清理单个模块（lifecycle.cleanup + 身份上下文）。 */
  static cleanupModule(id: ModuleId): void {
    const d = ModuleRegistry.get(id);
    if (!d) return;
    try {
      d.lifecycle.cleanup?.();
    } catch (e) {
      debug.e("Module", `[${id}] cleanup hook failed`, e);
    }
    gModuleState.booted.delete(id);
    gModuleState.initialized.delete(id);
    gModuleState.authHooks?.clear(id);
  }

  /** 清理全部已注册模块（shutdown 时调用）。 */
  static teardown(): void {
    for (const d of gModuleState.descriptors) {
      try {
        ModuleRegistry.cleanupModule(d.id);
      } catch {}
    }
  }

  /** 模块是否已完成 register* 阶段。 */
  static isBooted(id: ModuleId): boolean {
    return gModuleState.booted.has(id);
  }

  /** 宿主是否已走过 worldLoad 分相（`bootAfterWorldLoad` 已调用）。 */
  static isWorldLoaded(): boolean {
    return gModuleState.worldLoaded;
  }

  /**
   * boot 分相只读快照（沙箱「已装载」清单用）。
   * startup = ConfigManager 已就绪；worldLoad = 已执行 bootAfterWorldLoad。
   */
  static getBootPhase(): { startup: boolean; worldLoad: boolean; summary: string } {
    const startup = ConfigManager.isReady();
    const worldLoad = gModuleState.worldLoaded;
    let summary: string;
    if (startup && worldLoad) summary = "已 startup · 已 worldLoad";
    else if (startup) summary = "已 startup · 未 worldLoad";
    else if (worldLoad) summary = "未 startup · 已 worldLoad";
    else summary = "未完成 boot 分相";
    return { startup, worldLoad, summary };
  }

  /** 测试沙箱复位注册表（勿在 BDS 生产路径调用）。 */
  static resetForTesting(): void {
    for (const d of [...gModuleState.descriptors]) {
      try {
        ModuleRegistry.cleanupModule(d.id);
      } catch {
        /* ignore */
      }
    }
    gModuleState.descriptors.length = 0;
    gModuleState.booted.clear();
    gModuleState.initialized.clear();
    gModuleState.worldLoaded = false;
  }
}

/** 控制台打印当前已启动模块列表。 */
export function announceLoaded(): void {
  const active = gModuleState.descriptors.filter((d) => ModuleRegistry.isActive(d.id)).map((d) => d.id);
  console.log(`[ModuleRegistry] 已启动模块: ${active.join(", ") || "无"}`);
}
