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
 *   4) bindDataAdapter():注入 db-server HTTP 适配器
 *   5) 注册 setModuleGuard 给 Command.trigger 使用
 *
 * 本批 (Stage A+B):占位实现,host adapters (Command/Permission/HttpDB 等) 在 Stage F
 *                  (core-* 模块迁移)完成后实装。
 */

import { system, world } from "@minecraft/server";
import { ConfigManager } from "./internal/config-manager.js";
import { ModuleRegistry } from "./runtime.js";

export interface HostBackend {
  /** 注入 db-server 数据适配器 */
  bindDataAdapter(adapter: unknown): void;
  /** 关闭 db-server HTTP 客户端 */
  dispose(): void;
}

export interface ModuleSurface {
  /** 当前不在 Stage A+B 内消费,留口子给 manifest emitter */
  moduleId: string;
  afterWorldLoad: boolean;
}

export interface InstallOptions {
  /** db-server URL(默认 http://127.0.0.1:3001) */
  dbServerUrl?: string;
  /** 可选注入自定义 HostBackend(测试用) */
  hostBackend?: HostBackend;
  /** 模块 id 列表(默认 undefined = 全部装载,从 catalog 读取) */
  enabledModuleIds?: readonly string[];
}

let _installed = false;

export function installHostBootstrap(options: InstallOptions = {}): HostBackend {
  if (_installed) return _bootstrapStubBackend();
  _installed = true;

  // 1) 占位 data adapter:Stage F 之前 ConsoleData 把 readAll 抛 NOT_IMPLEMENTED;
  //    installHostBootstrap 仍然注册 hooks,只有 ConfigManager.init() 会失败 —
  //    这是允许的中间形态。modules/src/index.ts 还可以装运行。
  ConfigManager.bindDataAdapter(stubDataAdapter());
  if (options.hostBackend) options.hostBackend.bindDataAdapter(undefined);

  // 2) 装配 system.events
  system.beforeEvents.startup.subscribe(async () => {
    try {
      await ConfigManager.init();
    } catch (e) {
      console.warn(`[installHostBootstrap] ConfigManager.init failed: ${(e as Error).message || e}`);
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

  return _bootstrapStubBackend();
}

function _bootstrapStubBackend(): HostBackend {
  return {
    bindDataAdapter: () => undefined,
    dispose: () => undefined,
  };
}

function stubDataAdapter() {
  return {
    checkHealth: async () => undefined,
    getAllConfigs: async () => null,
    getModules: async () => null,
    setAuthToken: () => undefined,
  };
}

function announceLoaded() {
  // runtime.ts 内的同名 export;此处仅为了不让 TS 报 unused 警告
  const _ref = announceLoadedExported;
  void _ref;
}
import { announceLoaded as announceLoadedExported } from "./runtime.js";
