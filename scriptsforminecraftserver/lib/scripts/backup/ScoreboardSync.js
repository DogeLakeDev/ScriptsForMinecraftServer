/**
 * ScoreboardSync — 计分板同步模块
 *
 * 功能：
 *   1. sync()   — 读取游戏内全部计分板，全量覆盖写入 db-server
 *   2. load()   — 从 db-server 读取数据，恢复到游戏计分板
 *   3. init()   — 注册命令 + 自动定时同步
 *
 * API 表：sfmc_scoreboards
 */
import { world, system, ScoreboardIdentityType } from "@minecraft/server";
import { HttpDB } from "../libs/HttpDB";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Msg } from "../libs/Tools";
/** 自动同步间隔（毫秒） */
const AUTO_SYNC_INTERVAL = 300000; // 5 分钟
export class ScoreboardSync {
    /** 初始化：注册权限、命令、定时同步 */
    static init() {
        if (this.initialized)
            return;
        this.initialized = true;
        Permission.register('scoreboard.sync', Permission.OP);
        Permission.register('scoreboard.load', Permission.OP);
        Command.register("sbs", 'scoreboard.sync', (player) => {
            if (!player)
                return;
            this.sync().then(() => {
                Msg.success("计分板已同步到数据库", player);
            });
        }, "同步计分板到数据库");
        // 注册 load 子命令形式：!sbs load
        // 由于命令系统是单层映射，用 !sbsload 代替（或者用 !sbs load 需要改造 trigger）
        // 这里注册为 !sbs_load
        Command.register("sbs_load", 'scoreboard.load', (player) => {
            if (!player)
                return;
            this.load().then((result) => {
                Msg.success(`计分板恢复完成：成功 ${result.success}，失败 ${result.fail}`, player);
            });
        }, "从数据库恢复计分板");
        // 定时自动同步
        system.runInterval(() => {
            this.sync();
        }, AUTO_SYNC_INTERVAL / 50);
        console.info("[ScoreboardSync] 已初始化，自动同步间隔 5 分钟");
    }
    /** 同步：游戏 → db-server */
    static sync() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const entries = [];
                for (const obj of world.scoreboard.getObjectives()) {
                    const scores = obj.getScores();
                    for (const info of scores) {
                        const identity = info.participant;
                        let id = '';
                        // Player 类型时尝试取 id
                        if (identity.type === ScoreboardIdentityType.Player) {
                            try {
                                const entity = identity.getEntity();
                                if (entity && 'id' in entity) {
                                    id = entity.id || '';
                                }
                            }
                            catch (_a) {
                                // 玩家可能已离线
                            }
                        }
                        entries.push({
                            objectiveId: obj.id,
                            objectiveDisplay: obj.displayName,
                            participantId: identity.id,
                            participantType: identity.type,
                            participantName: identity.displayName,
                            id,
                            score: info.score,
                        });
                    }
                }
                if (entries.length === 0) {
                    console.warn("[ScoreboardSync] 计分板无数据，跳过同步");
                    return;
                }
                const ok = yield HttpDB.syncScoreboards(entries);
                if (ok) {
                    console.info(`[ScoreboardSync] 同步完成：${entries.length} 条数据`);
                }
                else {
                    console.warn("[ScoreboardSync] 同步失败：db-server 不可用");
                }
            }
            catch (err) {
                console.error(`[ScoreboardSync] 同步出错：${err}`);
            }
        });
    }
    /** 恢复：db-server → 游戏 */
    static load() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const entries = yield HttpDB.loadScoreboards();
                if (!entries || entries.length === 0) {
                    console.info("[ScoreboardSync] 数据库无计分板数据");
                    return { success: 0, fail: 0 };
                }
                let success = 0;
                let fail = 0;
                // 按 objective_id 分组
                const groups = new Map();
                for (const e of entries) {
                    const list = groups.get(e.objective_id) || [];
                    list.push(e);
                    groups.set(e.objective_id, list);
                }
                for (const [objId, objEntries] of groups) {
                    // 确保记分项存在
                    let objective = world.scoreboard.getObjective(objId);
                    if (!objective) {
                        try {
                            objective = world.scoreboard.addObjective(objId, objEntries[0].objective_display || objId);
                        }
                        catch (err) {
                            console.warn(`[ScoreboardSync] 无法创建记分项 "${objId}"：${err}`);
                            fail += objEntries.length;
                            continue;
                        }
                    }
                    for (const e of objEntries) {
                        try {
                            // Player 类型：优先用 id 匹配在线玩家
                            if (e.participant_type === 'Player' && e.id) {
                                const player = [...world.getPlayers()].find(p => p.id === e.id);
                                if (player === null || player === void 0 ? void 0 : player.scoreboardIdentity) {
                                    objective.setScore(player.scoreboardIdentity, e.score);
                                    success++;
                                    continue;
                                }
                            }
                            // Fallback：直接用参与者名称字符串（兼容 FakePlayer / 离线玩家）
                            objective.setScore(e.participant_name || `#${e.participant_id}`, e.score);
                            success++;
                        }
                        catch (_a) {
                            fail++;
                        }
                    }
                }
                console.info(`[ScoreboardSync] 恢复完成：成功 ${success}，失败 ${fail}`);
                return { success, fail };
            }
            catch (err) {
                console.error(`[ScoreboardSync] 恢复出错：${err}`);
                return { success: 0, fail: 0 };
            }
        });
    }
}
ScoreboardSync.initialized = false;
//# sourceMappingURL=ScoreboardSync.js.map