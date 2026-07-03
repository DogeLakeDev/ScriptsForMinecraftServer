/* ---------------------------------------- *\
 *  Name        :  区域飞行                   *
 *  Description :  芜湖                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { system, world, GameMode } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { Storage } from "../libs/Storage";
// 注册权限
Permission.register('fly.use', Permission.Any);
/**
 * 玩家加入事件
 */
export function playerJoinEvent(player) {
    system.runTimeout(() => {
        let areaName = inFlyArea(player);
        if (areaName !== undefined) {
            enableFly(player);
            player.sendMessage(`[Doge] 当前处于飞行区, 已打开飞行模式。`);
            Storage.playerSet(player, "dogefly", areaName);
        }
        // 不在飞行区则什么都不做，不强制改模式不发多余消息
    }, 60);
}
system.runInterval(() => {
    for (let player of world.getPlayers({ "gameMode": GameMode.Survival })) {
        let nowArea = Storage.playerGet(player, "dogefly", undefined);
        let areaName = inFlyArea(player);
        if (areaName !== undefined) {
            // 玩家当前在飞行区内
            if (nowArea === undefined) {
                // 从非飞行区进入
                enableFly(player);
                player.sendMessage(`[Doge] 进入飞行区 ${areaName}, 已打开飞行模式。`);
                Storage.playerSet(player, "dogefly", areaName);
            }
            else if (nowArea !== areaName) {
                // 从一个飞行区进入另一个飞行区，更新区域名
                Storage.playerSet(player, "dogefly", areaName);
            }
        }
        else {
            // 玩家当前不在任何飞行区
            if (nowArea !== undefined) {
                // 离开飞行区
                disableFly(player);
                player.sendMessage(`[Doge] 离开飞行区 ${nowArea}, 已关闭飞行模式。`);
                Storage.playerDelete(player, "dogefly");
            }
        }
    }
}, 40); // 2 秒扫一次
/**
 * 实体是否在飞行区域内
 */
function inFlyArea(entity) {
    for (let area of Config.flyArea) {
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
        console.warn('§c由于新版移除了相关指令，请在世界中开启教育模式。');
    }
}
function disableFly(player) {
    let res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { "includeLiquidBlocks": true, "includePassableBlocks": false });
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