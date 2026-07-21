/**
 * @sfmc/module-qa — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   QAManager 单例 (getInstance())
 */
export { QAManager } from "./QA.js";
