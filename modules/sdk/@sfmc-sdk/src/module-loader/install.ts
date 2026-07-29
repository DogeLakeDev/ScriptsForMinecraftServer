/**
 * module-loader/install.ts — 行为包启动入口
 *
 * 由 BP 构建产物 (scripts/main.js) 顶端调用:
 *   installHostBootstrap();
 *   // 然后 module 包通过 ModuleRegistry.register({...}) 注册自身
 *
 * installHostBootstrap 干了:
 *   1) system.beforeEvents.startup.subscribe:ConfigManager.init() + bootAll + snapshot
 *   2) world.afterEvents.worldLoad.subscribe:bootAfterWorldLoad
 *   3) system.beforeEvents.shutdown.subscribe:teardown
 *   4) bindDataAdapter():注入 db-server HTTP 适配器(DIP:经 DataAdapter)
 *   5) 注册 setModuleGuard 给 Command.trigger 使用
 */

import { system, world } from "@minecraft/server";
import { applyDebugFromVariables, initSentryIfConfigured } from "../sapi/diagnostics/sentry.js";
import { debug } from "../sapi/runtime/debug-log.js";
import { createHttpDataAdapter } from "./http-data-adapter.js";
import type { DataAdapter } from "./data-adapter.js";
import { ConfigManager } from "./internal/config-manager.js";
import { ModuleRegistry, type BdsSystem } from "./runtime.js";

export interface HostBackend {
  /** 注入 db-server 数据适配器 */
  bindDataAdapter(adapter: DataAdapter): void;
  /** 关闭 db-server HTTP 客户端 */
  dispose(): void;
}

/** 模块 surface 元信息（manifest emitter 预留）。 */
export interface ModuleSurface {
  /** 当前不在 Stage A+B 内消费,留口子给 manifest emitter */
  moduleId: string;
  /** 是否推迟到 worldLoad 后 init。 */
  afterWorldLoad: boolean;
}

/** installHostBootstrap 可选参数。 */
export interface InstallOptions {
  /** db-server URL(默认 http://127.0.0.1:3001) */
  dbServerUrl?: string;
  /** 可选注入自定义 HostBackend(测试用) */
  hostBackend?: HostBackend;
  /**
   * 测试/离线可注入自定义 DataAdapter;默认走 HttpDB 实现。
   * 高层只依赖 DataAdapter 抽象(DIP),不直接依赖 HttpDB。
   */
  dataAdapter?: DataAdapter;
  /** 模块 id 列表(默认 undefined = 全部装载,从 catalog 读取) */
  enabledModuleIds?: readonly string[];
}

let _installed = false;

/** 行为包启动入口：装配 ConfigManager、事件订阅与 DataAdapter。 */
export function installHostBootstrap(options: InstallOptions = {}): HostBackend {
  if (_installed) return _bootstrapBackend();
  _installed = true;

  // DIP:把 BDS SAPI system 注入 module-loader 的 host 抽象。
  // 模块 loader 只引用 globalThis.__sfmcBdsSystem,不顶层 import @minecraft/server。
  globalThis.__sfmcBdsSystem = system as unknown as BdsSystem;

  // DIP:ConfigManager ← DataAdapter;默认 HttpDB,可被 options 替换(测试/自定义 host)
  const adapter =
    options.dataAdapter ?? createHttpDataAdapter(options.dbServerUrl ? { baseUrl: options.dbServerUrl } : undefined);
  ConfigManager.bindDataAdapter(adapter);
  if (options.hostBackend) options.hostBackend.bindDataAdapter(adapter);

  // 装配 system.events
  system.beforeEvents.startup.subscribe(async () => {
    // Sentry / 控制台 debug：DSN 与 sfmc_debug 均缺省关闭
    initSentryIfConfigured();
    applyDebugFromVariables();
    try {
      await ConfigManager.init();
    } catch (e) {
      debug.e("HOST", "ConfigManager.init failed", e);
    }
    ModuleRegistry.bootAll();
    ModuleRegistry.snapshotEnabled();
    announceLoaded();
  });

  world.afterEvents.worldLoad.subscribe(() => {
    if (!ConfigManager.isReady()) return;
    ModuleRegistry.bootAfterWorldLoad();
  });

  system.beforeEvents.shutdown.subscribe(() => {
    try {
      ModuleRegistry.teardown();
    } catch {}
  });

  return _bootstrapBackend();
}

function _bootstrapBackend(): HostBackend {
  return {
    bindDataAdapter: (adapter: DataAdapter) => {
      ConfigManager.bindDataAdapter(adapter);
    },
    dispose: () => undefined,
  };
}

function announceLoaded() {
  // runtime.ts 内的同名 export;此处仅为了不让 TS 报 unused 警告
  const _ref = announceLoadedExported;
  void _ref;
}
import { announceLoaded as announceLoadedExported } from "./runtime.js";
