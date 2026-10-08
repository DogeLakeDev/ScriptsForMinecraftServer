/** 已收编至平台的模块及其兼容服务名称。旧配置、包目录和历史表保留。 */
export const RETIRED_PLATFORM_MODULES = ["monitor", "qq-link", "feature-qq-link"] as const;
export const PLATFORM_MONITORING_SERVICES = ["tps.current", "tps.status", "monitor.metrics"] as const;
/** 平台宿主身份：提供监控服务，并可作为可选跨模块服务调用方（如 QQ 账号快照）。 */
export const PLATFORM_SERVICE_OWNER = "_platform";
export function isRetiredPlatformModule(id: string): boolean {
  return RETIRED_PLATFORM_MODULES.some((value) => value === id);
}
