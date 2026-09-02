/**
 * services/builtin-handlers.ts — 进程内置跨模块服务插件注册表
 *
 * 遵循开闭原则（OCP）：新增内置服务仅需向 `BUILTIN_SERVICE_PLUGINS` 追加配置，
 * 避免在主入口硬编码 `if (enabledSet.has(...)) registerXxx` 注册链。
 */

import type { DatabaseSync } from "node:sqlite";
import type { QueryFn } from "../lib/sqlite.js";
import type { ServiceRegistry } from "../service-registry.js";
import { registerEconomyHandlers } from "./economy-handlers.js";

export type BuiltinServiceDeps = { query: QueryFn; db: DatabaseSync };

export type BuiltinServicePlugin = {
  moduleId: string;
  register: (registry: ServiceRegistry, deps: BuiltinServiceDeps) => void;
};

/** 内置 service 插件清单 — 扩展注册列表。 */
export const BUILTIN_SERVICE_PLUGINS: BuiltinServicePlugin[] = [
  { moduleId: "feature-economy", register: registerEconomyHandlers },
];

/**
 * 根据已启用模块集合批量注册内置服务插件。
 *
 * @param registry 服务注册表实例。
 * @param deps 数据库查询与连接依赖。
 * @param enabledSet 当前处于启用状态的模块 ID 集合。
 * @returns 成功注册的插件数量。
 */
export function registerEnabledBuiltinServices(
  registry: ServiceRegistry,
  deps: BuiltinServiceDeps,
  enabledSet: Set<string>
): number {
  let n = 0;
  for (const plugin of BUILTIN_SERVICE_PLUGINS) {
    if (!enabledSet.has(plugin.moduleId)) continue;
    plugin.register(registry, deps);
    n += 1;
  }
  return n;
}

/**
 * 热启用指定模块的内置服务插件（若尚未注册）。
 *
 * @param registry 服务注册表实例。
 * @param deps 数据库依赖。
 * @param moduleId 目标模块唯一标识符。
 * @returns 若成功注册返回 `true`，若插件不存在或已注册则返回 `false`。
 */
export function registerBuiltinPluginForModule(
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
 * 热禁用指定模块的全部服务处理器。
 *
 * @param registry 服务注册表实例。
 * @param moduleId 待卸载服务的模块 ID。
 * @returns 成功卸载的服务数量。
 */
export function unregisterBuiltinPluginForModule(registry: ServiceRegistry, moduleId: string): number {

  let n = 0;
  for (const h of registry.list()) {
    if (h.moduleId !== moduleId) continue;
    registry.unregisterHandler(h.name);
    n += 1;
  }
  return n;
}
