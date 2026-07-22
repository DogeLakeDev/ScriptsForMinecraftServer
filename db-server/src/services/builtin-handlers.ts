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
};

/** 内置 service 插件清单 — 唯一扩展点 */
export const BUILTIN_SERVICE_PLUGINS: BuiltinServicePlugin[] = [
  { moduleId: "feature-economy", register: registerEconomyHandlers },
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
