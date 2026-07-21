/**
 * config/index.ts — @sfmc/sdk/sapi/config 公开 API
 */

export { config, setConfigModuleContext, clearConfigModuleContext } from "./client.js";
export const SFMC_SAPI_CONFIG_VERSION = "0.1.0" as const;
