/**
 * @sfmc/module-scoreboard-sync — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - ScoreboardSync.registerCommands / init / load
 *   - ScoreboardsBackup():运行期手动备份钩子
 */

export { ScoreboardSync, ScoreboardsBackup } from "./ScoreboardsData.js";