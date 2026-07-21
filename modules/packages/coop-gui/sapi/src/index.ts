/**
 * @sfmc/module-coop-gui — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - CoopGUI (表单面板主类):mainPanel / openShopMgr 静态方法
 *
 * 内部 API 调用折叠在 ./CoopApi.ts(原 scripts/api/CoopApi.ts)
 */

export { CoopGUI } from "./CoopGUI.js";
export * as CoopApi from "./CoopApi.js";