/**
 * @sfmc/module-clean — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   Clean 类 + registerCommand 函数
 */
export { Clean, registerCommand } from "./Clean.js";
