/**
 * @sfmc/module-scoreboard-sync — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - ScoreboardSync.registerCommands / init / load
 *   - ScoreboardsBackup():运行期手动备份钩子
 */

export { ScoreboardSync, ScoreboardsBackup } from "./ScoreboardsData.js";