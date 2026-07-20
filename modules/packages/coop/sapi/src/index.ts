/**
 * @sfmc/module-coop — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - CoopSystem.registerPermissions / registerCommands / init
 *   - CoopCore:合作社领域逻辑(registerCoop / joinCoop / bankControl / buy / sell ...)
 *     仅供同一模块或之后搬到 gui 包的 CoopGUI 内部使用
 *
 * CoopSystem 依赖 scriptsforminecraftserver/scripts/gui/CoopGUI.js,该 GUI
 * 文件按计划留在旧路径下,直到 stage H 把 gui/CoopGUI 搬走。模块导入通过
 * 5-up 相对路径指过去,行为保持等价。
 */

export { CoopSystem } from "./CoopSystem.js";
export { CoopCore } from "./Coop.js";