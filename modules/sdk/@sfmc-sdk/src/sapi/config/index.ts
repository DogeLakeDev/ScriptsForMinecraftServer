/**
 * config/index.ts — @sfmc-bds/sdk/sapi/config 公开 API
 */

export { config, setConfigModuleContext, clearConfigModuleContext } from "./client.js";
/** `@sfmc-bds/sdk/sapi/config` 子路径 semver 版本号。 */
export const SFMC_SAPI_CONFIG_VERSION = "0.1.0" as const;
