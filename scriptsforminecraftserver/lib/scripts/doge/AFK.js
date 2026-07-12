/* ---------------------------------------- *\
 *  Name        :  AFK                      *
 *  Description :  AFK                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { system, world } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import { Command } from "../libs/Command";
// 内存缓存：玩家 ID → (键 → 值)
const afkCache = new Map();
function cacheGet(player, key, fallback) {
    const pc = afkCache.get(player.id);
    if (!pc || !pc.has(key))
        return fallback;
    return pc.get(key);
}
function cacheSet(player, key, value) {
    let pc = afkCache.get(player.id);
    if (!pc) {
        pc = new Map();
        afkCache.set(player.id, pc);
    }
    pc.set(key, value);
}
function cacheDelete(player, key) {
    const pc = afkCache.get(player.id);
    if (pc)
        pc.delete(key);
}
export function init() {
    console.log(`Initializing AFK...`);
    for (let player of world.getAllPlayers()) {
        reset(player);
    }
    console.log(`AFK initialized successfully.`);
}
/**
 * 清除相关属性和标签
 */
export function reset(player) {
    cacheDelete(player, "afk:last_location");
    cacheDelete(player, "afk:step");
    player.removeTag("AFK");
    player.removeTag("NOAFK");
}
/**
 * 即刻进入AFK状态
 */
export function setAFK(player) {
    player.removeTag("NOAFK");
    startAFKScan();
    playerList[player.id] = player.location;
    world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
    cacheSet(player, "afk:step", 0);
    player.addTag("AFK");
}
function locationMoved(lastLocation, nowLocation) {
    let deltaX = lastLocation.x - nowLocation.x;
    if (-1 < deltaX && deltaX < 1) {
        let deltaY = lastLocation.y - nowLocation.y;
        if (-1 < deltaY && deltaY < 1) {
            let deltaZ = lastLocation.z - nowLocation.z;
            if (-1 < deltaZ && deltaZ < 1) {
                return false;
            }
        }
    }
    return true;
}
// 15秒一次全体玩家的位置扫描
const STEP_TIME = 15;
system.runInterval(() => {
    for (let player of world.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
        let lastLoaction = cacheGet(player, "afk:last_location", undefined);
        let nowLocation = player.location;
        if (lastLoaction !== undefined) {
            let nowStep = cacheGet(player, "afk:step", undefined);
            if (!locationMoved(lastLoaction, nowLocation)) {
                // 位置没有改变，步数增加
                if (nowStep === undefined) {
                    nowStep = 1;
                }
                else {
                    nowStep++;
                }
                // 判断是否满足AFK条件
                if (nowStep * STEP_TIME >= ConfigManager.getSetting("afk_time", 120)) {
                    // 满足
                    setAFK(player);
                }
                else {
                    cacheSet(player, "afk:step", nowStep);
                }
            }
            else {
                cacheSet(player, "afk:step", 0);
            }
        }
        cacheSet(player, "afk:last_location", nowLocation);
    }
}, STEP_TIME * 20);
// 5秒一次AFK玩家的位置扫描
var intervalId = undefined;
var playerList = {};
function startAFKScan() {
    if (intervalId !== undefined) {
        return;
    }
    intervalId = system.runInterval(() => {
        let count = 0;
        for (let id in playerList) {
            let player = world.getEntity(id);
            if (player === undefined) {
                delete playerList[id];
            }
            else {
                if (locationMoved(playerList[id], player.location)) {
                    world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
                    player.removeTag("AFK");
                    cacheSet(player, "afk:last_location", player.location);
                    cacheSet(player, "afk:step", 0);
                    delete playerList[id];
                }
                else {
                    count++;
                }
            }
        }
        if (count === 0) {
            stopAFKScan();
        }
    }, 100);
}
function stopAFKScan() {
    system.clearRun(intervalId);
    intervalId = undefined;
}
export function registerCommand() {
    Command.register("afk", "afk.use", setAFK, "进入AFK状态");
    Command.register("noafk", "afk.clear.other", (pl) => {
        if (pl)
            pl.addTag("NOAFK");
    }, "令玩家不会进入AFK状态");
}
//# sourceMappingURL=AFK.js.map