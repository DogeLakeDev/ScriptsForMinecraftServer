/** 已收编至平台的模块及其兼容服务名称。旧配置、包目录和历史表保留。 */
export const RETIRED_PLATFORM_MODULES = ["monitor"] as const;
export const PLATFORM_MONITORING_SERVICES = ["tps.current", "tps.status", "monitor.metrics"] as const;
export const PLATFORM_SERVICE_OWNER = "_platform";
export function isRetiredPlatformModule(id: string): boolean {
  return RETIRED_PLATFORM_MODULES.some((value) => value === id);
}
