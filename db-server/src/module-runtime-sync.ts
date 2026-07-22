/**
 * module-runtime-sync.ts — enable/disable 时同步进程内运行态
 *
 * lock 落盘后,内存态(enabledSet / enabledManifests / moduleAuth.tokens /
 * builtin service handlers)必须与之一致,否则「只重启 BDS」拿不到新 token
 * (DIP:路由只依赖注入的集合,不感知启停实现)。
 *
 * DRY:token 落盘 / 内置 handler 启停复用 module-auth 与 builtin-handlers,
 * 不在此处再写一份派生与卸载逻辑。
 */

import type { ModuleManifestV2 } from "./manifest-loader.js";
import {
  ensureModuleToken,
  persistModuleAuth,
  revokeModuleToken,
  type ModuleAuthMap,
} from "./module-auth.js";
import {
  registerBuiltinPluginForModule,
  unregisterBuiltinPluginForModule,
  type BuiltinServiceDeps,
} from "./services/builtin-handlers.js";
import type { ServiceRegistry } from "./service-registry.js";
import { log } from "./lib/log.js";

export type LoadedModules = {
  modules: Record<string, ModuleManifestV2 | undefined>;
};

export type SyncModuleRuntimeOpts = {
  moduleId: string;
  enabled: boolean;
  projectRoot: string;
  /** 与 buildModuleAuth 一致:无 AUTH_TOKEN 时 secretGenerated=true */
  envAuthToken: string;
  enabledSet: Set<string>;
  enabledManifests: Map<string, ModuleManifestV2>;
  loadedManifest: LoadedModules;
  moduleAuth: ModuleAuthMap;
  serviceRegistry: ServiceRegistry;
  builtinDeps: BuiltinServiceDeps;
};

/**
 * 同步 enable/disable 后的进程内集合与 token 文件。
 * 调用方负责先写 lock;本函数不碰磁盘 lock。
 */
export function syncModuleRuntimeState(opts: SyncModuleRuntimeOpts): void {
  const {
    moduleId,
    enabled,
    projectRoot,
    envAuthToken,
    enabledSet,
    enabledManifests,
    loadedManifest,
    moduleAuth,
    serviceRegistry,
    builtinDeps,
  } = opts;

  if (enabled) {
    const manifest = loadedManifest.modules[moduleId];
    if (!manifest) {
      log.warn(`[modules] 热启用 ${moduleId}: manifest 缺失(未安装?),仅写 lock`);
      return;
    }
    enabledSet.add(moduleId);
    enabledManifests.set(moduleId, manifest);
    if (ensureModuleToken(moduleAuth, moduleId)) {
      log.info(`[modules] 热启用 ${moduleId}: 派生 module token`);
    }
    persistModuleAuth(projectRoot, moduleAuth, envAuthToken);
    if (registerBuiltinPluginForModule(serviceRegistry, builtinDeps, moduleId)) {
      log.success(`[modules] 热启用 ${moduleId}: 已注册内置 service handlers`);
    }
    return;
  }

  enabledSet.delete(moduleId);
  enabledManifests.delete(moduleId);
  if (revokeModuleToken(moduleAuth, moduleId)) {
    persistModuleAuth(projectRoot, moduleAuth, envAuthToken);
  }
  const n = unregisterBuiltinPluginForModule(serviceRegistry, moduleId);
  if (n > 0) {
    log.info(`[modules] 热禁用 ${moduleId}: 卸下 ${n} 个内置 handlers`);
  }
}
