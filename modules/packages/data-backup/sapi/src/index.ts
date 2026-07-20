/**
 * @sfmc/module-data-backup — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - getPlayerData(player):快照当前玩家数据 (player join/leave)
 *   - getWorldData / syncWorldData:世界 gameRules 快照 + 上报
 *   - PlayersDataApi.getPlayers / savePlayers:DB 读写
 *   - WorldDataApi.saveWorldData:DB 写入
 */
export { getPlayerData, isPlayerExists } from "./PlayerData.js";
export { getWorldData, syncWorldData } from "./WorldData.js";
export { getPlayers, savePlayers } from "./PlayersDataApi.js";
export { saveWorldData } from "./WorldDataApi.js";