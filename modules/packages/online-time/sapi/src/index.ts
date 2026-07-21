/**
 * @sfmc/module-online-time — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   OnlineTime 单例 (getInstance())
 */
export { OnlineTime } from "./OnlineTime.js";
