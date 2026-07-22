/**
 * module-runtime-sync.ts — enable/disable 时同步进程内运行态
 *
 * lock 落盘后,鉴态(enabledSet / enabledManifests / moduleAuth.tokens /
 * builtin service handlers)必须与之一致,否则「只重启 BDS」拿不到新 token
 * (DIP:路由只依赖注入的集合,不感知启停实现)。
 */

import { writeJson } from "@sfmc-bds/sdk/node/config";
import { join } from "node:path";
import type { ModuleManifestV2 } from "./manifest-loader.js";
import { deriveToken, type ModuleAuthMap } from "./module-auth.js";
import {
  BUILTIN_SERVICE_PLUGINS,
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
  enabledSet: Set<string>;
  enabledManifests: Map<string, ModuleManifestV2>;
  loadedManifest: LoadedModules;
  moduleAuth: ModuleAuthMap;
  serviceRegistry: ServiceRegistry;
  builtinDeps: BuiltinServiceDeps;
};

/** 把当前 moduleAuth.tokens 写回 data/module-tokens.json(不轮换 secret)。 */
export function persistModuleAuthTokens(projectRoot: string, auth: ModuleAuthMap): void {
  const outFile = join(projectRoot, "data", "module-tokens.json");
  writeJson(outFile, {
    tokens: auth.tokens,
    secret: auth.secret,
    generatedAt: new Date().toISOString(),
    secretGenerated: false,
  });
}

/** 卸掉某模块在 ServiceRegistry 上的全部 handler。 */
export function unregisterHandlersForModule(registry: ServiceRegistry, moduleId: string): number {
  let n = 0;
  for (const h of registry.list()) {
    if (h.moduleId !== moduleId) continue;
    registry.unregisterHandler(h.name);
    n += 1;
  }
  return n;
}

/** 若该 moduleId 有内置插件且尚未注册,则注册。 */
export function registerBuiltinForModule(
  registry: ServiceRegistry,
  deps: BuiltinServiceDeps,
  moduleId: string
): boolean {
  const plugin = BUILTIN_SERVICE_PLUGINS.find((p) => p.moduleId === moduleId);
  if (!plugin) return false;
  const already = registry.list().some((h) => h.moduleId === moduleId);
  if (already) return false;
  plugin.register(registry, deps);
  return true;
}

/**
 * 同步 enable/disable 后的进程内集合与 token 文件。
 * 调用方负责先写 lock;本函数不碰磁盘 lock。
 */
export function syncModuleRuntimeState(opts: SyncModuleRuntimeOpts): void {
  const {
    moduleId,
    enabled,
    projectRoot,
    enabledSet,
    enabledManifests,
    loadedManifest,
    moduleAuth,
    serviceRegistry,
    builtinDeps,
  } = opts;

  if (enabled) {
    enabledSet.add(moduleId);
    const manifest = loadedManifest.modules[moduleId];
    if (manifest) enabledManifests.set(moduleId, manifest);
    moduleAuth.tokens[moduleId] = deriveToken(moduleId, moduleAuth.secret);
    persistModuleAuthTokens(projectRoot, moduleAuth);
    if (registerBuiltinForModule(serviceRegistry, builtinDeps, moduleId)) {
      log.info(`[service] runtime-enable: registered builtin handlers for ${moduleId}`);
    }
    log.info(`[modules] runtime-enable ${moduleId} (token+enabledSet synced)`);
    return;
  }

  enabledSet.delete(moduleId);
  enabledManifests.delete(moduleId);
  delete moduleAuth.tokens[moduleId];
  persistModuleAuthTokens(projectRoot, moduleAuth);
  const removed = unregisterHandlersForModule(serviceRegistry, moduleId);
  if (removed > 0) {
    log.info(`[service] runtime-disable: unregistered ${removed} handler(s) for ${moduleId}`);
  }
  log.info(`[modules] runtime-disable ${moduleId} (token+enabledSet synced)`);
}
