/**
 * install.ts — 行为包宿主引导装配器
 *
 * 作为行为包构建产物（`scripts/main.js`）的入口首部调用：
 * ```ts
 * import { installHostBootstrap } from "@sfmc-bds/sdk/module-loader/install";
 * installHostBootstrap();
 * // 各业务模块依次通过 ModuleRegistry.register({...}) 注册自身
 * ```
 *
 * 生命周期：
 * 1. system.beforeEvents.startup：初始化 ConfigManager、启动模块、广播就绪状态
 * 2. world.afterEvents.worldLoad：触发需在世界加载后初始化的模块（bootAfterWorldLoad）
 * 3. system.beforeEvents.shutdown：触发模块的卸载与资源清理（teardown）
 * 4. 依赖倒置装配：统一绑定 DataAdapter 数据适配器与各子系统的鉴权拦截钩子
 *
 * 方案 A：apply 装配作用域 db/config/service，经 ModuleServices 注入 lifecycle，
 * 事务状态与 moduleId 封闭在闭包内；单例门面仍登记以兼容旧模块同步 boot 路径。
 */

import { system, world } from "@minecraft/server";
import {
  clearConfigModuleContext,
  createConfigClient,
  getConfigClient,
  setConfigModuleContext,
} from "../sapi/config/client.js";
import { clearDbModuleContext, getDbClient, setDbModuleContext } from "../sapi/db/client.js";
import { applyDebugFromVariables, initSentryIfConfigured } from "../sapi/diagnostics/sentry.js";
import { debug } from "../sapi/runtime/debug-log.js";
import {
  clearServiceModuleContext,
  getServiceClient,
  setServiceModuleContext,
} from "../sapi/service/client.js";
import type { DataAdapter } from "./data-adapter.js";
import { createHttpDataAdapter } from "./http-data-adapter.js";
import { ConfigManager } from "./internal/config-manager.js";
import {
  announceLoaded,
  bindModuleAuthHooks,
  ModuleRegistry,
  type BdsSystem,
  type ModuleServices,
} from "./runtime.js";

/** 宿主后端抽象接口。 */
export interface HostBackend {
  /** 注入 db-server 数据适配器。 */
  bindDataAdapter(adapter: DataAdapter): void;
  /** 关闭并释放相关资源。 */
  dispose(): void;
}

/** `installHostBootstrap` 初始化引导选项。 */
export interface InstallOptions {
  /** db-server 服务的基准 URL（默认为 "http://127.0.0.1:3001"）。 */
  dbServerUrl?: string;
  /** 可选注入自定义 HostBackend 实现（主要供单元测试使用）。 */
  hostBackend?: HostBackend;
  /**
   * 可选注入自定义 DataAdapter（测试或离线场景使用；默认采用基于 HttpDB 的实现）。
   * 高层业务仅依赖 DataAdapter 抽象（DIP），不直接耦合 HttpDB 具体实现。
   */
  dataAdapter?: DataAdapter;
}

let _installed = false;

/** 行为包引导装配入口：装配 ConfigManager、系统事件生命周期订阅与 DataAdapter。 */
export function installHostBootstrap(options: InstallOptions = {}): HostBackend {
  if (_installed) return _bootstrapBackend();
  _installed = true;

  // 将 BDS SAPI system 注入 module-loader 的 host 抽象（避免模块 loader 顶层硬依赖 @minecraft/server）

  globalThis.__sfmcBdsSystem = system as unknown as BdsSystem;

  // DIP：作用域客户端在 install 侧装配，lifecycle 经 ModuleServices 闭包捕获
  bindModuleAuthHooks({
    apply(id, token, configKey): ModuleServices {
      setDbModuleContext(id, token);
      const db = getDbClient(id);
      const inTx = () => db.isTxRecording();
      setServiceModuleContext(id, token, inTx);
      const service = getServiceClient(id);

      let config;
      if (configKey) {
        setConfigModuleContext(id, configKey, token);
        config = getConfigClient(configKey);
      } else {
        // 无 configKey 时提供占位客户端（与 moduleId 同名键），避免 lifecycle 空引用
        config = createConfigClient(id, id, token);
      }

      return { db, config, service };
    },
    clear(id) {
      clearDbModuleContext(id);
      clearConfigModuleContext(id);
      clearServiceModuleContext(id);
    },
  });

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
