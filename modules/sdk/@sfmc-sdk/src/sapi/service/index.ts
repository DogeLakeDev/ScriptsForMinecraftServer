/**
 * service/index.ts — @sfmc-bds/sdk/sapi/service 公开 API
 *
 * 推荐：createServiceClient / ModuleServices.service（与配对 DbClient.isTxRecording 绑定）
 * 兼容：单例 service + setServiceModuleContext
 */

export {
  service,
  provide,
  clearLocalProvides,
  createServiceClient,
  getServiceClient,
  setServiceModuleContext,
  clearServiceModuleContext,
  ServiceError,
} from "./client.js";
export type { ServiceClient, ServiceHandler, ServiceInfo } from "./client.js";
/** @sfmc-bds/sdk/sapi/service 子路径 semver 版本号。 */
export const SFMC_SAPI_SERVICE_VERSION = "0.1.0" as const;
