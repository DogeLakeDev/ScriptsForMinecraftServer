import { Player, system, world, GameMode } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";

export function playerJoinEvent(player: Player): void {
    system.runTimeout(() => {
        const areaName = inFlyArea(player);
        if (areaName !== undefined) {
            enableFly(player);
            player.sendMessage("[Doge] 当前处于飞行区, 已打开飞行模式。");
            player.setDynamicProperty("dogefly", areaName);
        } else {
            disableFly(player);
            player.sendMessage("[Doge] 当前不处于飞行区, 已关闭飞行模式。");
            player.setDynamicProperty("dogefly", undefined);
        }
    }, 60);
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const nowArea = player.getDynamicProperty("dogefly") as string | undefined;
        const areaName = inFlyArea(player);
        if (nowArea === undefined) {
            if (areaName !== undefined) {
                enableFly(player);
                player.sendMessage(`[Doge] 进入飞行区 ${areaName}, 已打开飞行模式。`);
                player.setDynamicProperty("dogefly", areaName);
            }
        } else {
            if (areaName === undefined) {
                disableFly(player);
                player.sendMessage(`[Doge] 离开飞行区 ${nowArea}, 已关闭飞行模式。`);
                player.setDynamicProperty("dogefly", undefined);
            }
        }
    }
}, 400);

function inFlyArea(entity: Player): string | undefined {
    for (const area of Config.flyArea) {
        if (entity.dimension.id === area.dimension) {
            if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                return area.name;
            }
        }
    }
    return undefined;
}

function enableFly(player: Player): void {
    player.runCommand("ability @s mayfly true");
}

function disableFly(player: Player): void {
    const res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { includeLiquidBlocks: true, includePassableBlocks: false });
    if (res !== undefined) {
        player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
    }

    player.runCommand("ability @s mayfly false");
    player.setGameMode(GameMode.Adventure);
    player.setGameMode(GameMode.Survival);
}
