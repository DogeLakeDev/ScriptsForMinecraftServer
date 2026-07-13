/* ---------------------------------------- *\
 *  Name        :  区域飞行                   *
 *  Description :  芜湖                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { system, world, GameMode } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import * as Tool from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { Msg } from "../libs/Tools";
export function init() {
    Permission.register("fly.use", Permission.Any);
}
/**
 * 玩家加入事件
 */
export function playerJoinEvent(player) {
    system.runTimeout(() => {
        let areaName = inFlyArea(player);
        if (areaName !== undefined) {
            enableFly(player);
            Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
            player.setDynamicProperty("hpbe:dogefly", areaName);
        }
    }, 60);
}
let scanRunId;
function startScan() {
    if (scanRunId !== undefined)
        return;
    scanRunId = system.runInterval(() => {
        for (let player of world.getPlayers({ gameMode: GameMode.Survival })) {
            let nowArea = player.getDynamicProperty("hpbe:dogefly");
            let areaName = inFlyArea(player);
            if (areaName !== undefined) {
                if (nowArea === undefined) {
                    enableFly(player);
                    Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
                    player.setDynamicProperty("hpbe:dogefly", areaName);
                }
                else if (nowArea !== areaName) {
                    player.setDynamicProperty("hpbe:dogefly", areaName);
                }
            }
            else {
                if (nowArea !== undefined) {
                    disableFly(player);
                    Msg.info(`离开飞行区 ${nowArea}, 已关闭飞行模式。`, player);
                    player.setDynamicProperty("hpbe:dogefly", undefined);
                }
            }
        }
    }, 40);
}
export function stop() {
    if (scanRunId !== undefined) {
        try {
            system.clearRun(scanRunId);
        }
        catch { }
        scanRunId = undefined;
    }
}
export function boot() {
    if (scanRunId === undefined)
        startScan();
}
/**
 * 实体是否在飞行区域内
 */
function inFlyArea(entity) {
    for (let area of ConfigManager.getAreas("fly")) {
        if (entity.dimension.id === area.dimension) {
            if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                return area.name;
            }
        }
    }
    return undefined;
}
function enableFly(player) {
    try {
        player.runCommand("gamerule sendcommandfeedback false");
        player.runCommand("ability @s mayfly true");
        player.runCommand("gamerule sendcommandfeedback true");
    }
    catch (_) {
        console.warn("§c由于新版移除了相关指令，请在世界中开启教育模式。");
    }
}
function disableFly(player) {
    let res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { includeLiquidBlocks: true, includePassableBlocks: false });
    if (res !== undefined) {
        player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
    }
    try {
        player.runCommand("gamerule sendcommandfeedback false");
        player.runCommand("ability @s mayfly false");
        player.runCommand("gamemode adventure");
        player.runCommand("gamemode survival");
        player.runCommand("gamerule sendcommandfeedback true");
    }
    catch (_) { }
}
//# sourceMappingURL=Fly.js.map