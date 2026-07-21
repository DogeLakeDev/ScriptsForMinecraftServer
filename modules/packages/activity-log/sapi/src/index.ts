/**
 * @sfmc/module-activity-log — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - ActivityLog.registerEvents() / init() / cleanup()
 *
 * 内部 HTTP 上报走 HttpDB 客户端 + 2 秒 flush,定时清理 6 小时一次。
 */
export { ActivityLog } from "./ActivityLog.js";