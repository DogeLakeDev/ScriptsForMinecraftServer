/**
 * @sfmc/module-land-gui — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - LandGUI.showMainMenu / startApplication 静态方法
 *
 * 内部 API 调用折叠在 ./LandApi.ts(原 scripts/api/LandApi.ts)
 */

export { LandGUI } from "./LandGUI.js";
export * as LandApi from "./LandApi.js";