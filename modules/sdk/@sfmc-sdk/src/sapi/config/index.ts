/**
 * config/index.ts — @sfmc-bds/sdk/sapi/config 公开 API
 *
 * 推荐：createConfigClient / ModuleServices.config（onChange 按客户端隔离）
 * 兼容：单例 config + setConfigModuleContext
 */

export {
  config,
  createConfigClient,
  getConfigClient,
  setConfigModuleContext,
  clearConfigModuleContext,
} from "./client.js";
export type { ConfigClient } from "./client.js";
/** `@sfmc-bds/sdk/sapi/config` 子路径 semver 版本号。 */
export const SFMC_SAPI_CONFIG_VERSION = "0.1.0" as const;
