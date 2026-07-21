/**
 * @sfmc/module-coop — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - CoopSystem.registerPermissions / registerCommands / init
 *   - CoopCore:合作社领域逻辑(registerCoop / joinCoop / bankControl / buy / sell ...)
 *     仅供同一模块或之后搬到 gui 包的 CoopGUI 内部使用
 *
 * CoopGUI 由 @sfmc/module-coop-gui 导出,模块间 import 走包名空间。
 */

export { CoopSystem } from "./CoopSystem.js";
export { CoopCore } from "./Coop.js";