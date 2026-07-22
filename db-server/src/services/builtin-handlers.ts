/**
 * services/builtin-handlers.ts — 进程内置 service 插件注册表
 *
 * 新增内置 handler 只追加 BUILTIN_SERVICE_PLUGINS(OCP),
 * 勿在 index.ts 再写 if (enabledSet.has(...)) registerXxx 链。
 */

import type { DatabaseSync } from "node:sqlite";
import type { QueryFn } from "../lib/sqlite.js";
import type { ServiceRegistry } from "../service-registry.js";
import { registerEconomyHandlers } from "./economy-handlers.js";

export type BuiltinServiceDeps = { query: QueryFn; db: DatabaseSync };

export type BuiltinServicePlugin = {
  moduleId: string;
  register: (registry: ServiceRegistry, deps: BuiltinServiceDeps) => void;
  /** 与 register 写入的 handler 名对齐,供热禁用 unregister */
  serviceNames?: string[];
};

/** 内置 service 插件清单 — 唯一扩展点 */
export const BUILTIN_SERVICE_PLUGINS: BuiltinServicePlugin[] = [
  {
    moduleId: "feature-economy",
    register: registerEconomyHandlers,
    serviceNames: [
      "economy.account.get",
      "economy.account.debit",
      "economy.account.credit",
      "economy.account.transfer",
      "economy.dailyTasks.list",
      "economy.dailyTasks.submit",
      "economy.stats.monthly",
    ],
  },
];

/** 按 enabledSet 注册内置插件,返回已注册插件数 */
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

/** 热启用:只注册单个内置插件(若尚未注册) */
export function registerBuiltinPluginForModule(
  registry: ServiceRegistry,
  deps: BuiltinServiceDeps,
  moduleId: string
): boolean {
  const plugin = BUILTIN_SERVICE_PLUGINS.find((p) => p.moduleId === moduleId);
  if (!plugin) return false;
  const already = (plugin.serviceNames ?? []).some((n) => registry.list().some((h) => h.name === n));
  if (already) return false;
  plugin.register(registry, deps);
  return true;
}

/** 热禁用:卸掉该模块的内置 handler */
export function unregisterBuiltinPluginForModule(registry: ServiceRegistry, moduleId: string): number {
  const plugin = BUILTIN_SERVICE_PLUGINS.find((p) => p.moduleId === moduleId);
  if (!plugin?.serviceNames) return 0;
  let n = 0;
  for (const name of plugin.serviceNames) {
    if (registry.list().some((h) => h.name === name)) {
      registry.unregisterHandler(name);
      n += 1;
    }
  }
  return n;
}
