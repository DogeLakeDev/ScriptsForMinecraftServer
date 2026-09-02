/**
 * @sfmc-bds/sdk/sapi/host — SAPI 宿主适配器与环境配置
 *
 * 由 `@sfmc-bds/sdk/module-loader/install` 在执行 `installHostBootstrap` 时装配。
 * 提供配置路径解析、工作根目录定位及宿主接口适配能力。
 */

export * from "./config/index.js";
export { SFMC_SAPI_HOST_VERSION } from "./version.js";

