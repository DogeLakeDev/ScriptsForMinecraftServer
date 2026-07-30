/**
 * service/index.ts — @sfmc-bds/sdk/sapi/service 公开 API
 */

export { service, setServiceModuleContext, clearServiceModuleContext, ServiceError } from "./client.js";
export type { ServiceInfo } from "./client.js";
/** @sfmc-bds/sdk/sapi/service 子路径 semver 版本号。 */
export const SFMC_SAPI_SERVICE_VERSION = "0.1.0" as const;
