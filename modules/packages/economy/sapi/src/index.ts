/**
 * @sfmc/module-economy — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - EconomyReport.start() / .stop():月度白皮书广播
 *   - getEconomyAccount / applyEconomyTransaction / transferEconomy
 *     / getDailyTasks / submitDailyTask:经济 HTTP 客户端
 *
 * 共享 Money 类(本地账本缓存)仍由 @sfmc/sdk/sapi/runtime 提供。
 */
export { EconomyReport } from "./EconomyReport.js";
export {
  getEconomyAccount,
  applyEconomyTransaction,
  getDailyTasks,
  submitDailyTask,
  transferEconomy,
} from "./EconomyApi.js";