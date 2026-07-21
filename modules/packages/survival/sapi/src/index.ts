/**
 * @sfmc/module-survival — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - SurvivalArea.getInstance():注册命令/权限、订阅事件、生命周期
 *
 * 跨包依赖通过 @sfmc/module-creative 拉取 CreativeArea.enable 状态。
 */

export { SurvivalArea } from "./SurvivalArea.js";