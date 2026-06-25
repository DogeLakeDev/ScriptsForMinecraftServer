import { world, Entity, EntityInitializationCause } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";

let enable = true;

world.afterEvents.entitySpawn.subscribe(event => {
    if (!enable) return;
    try {
        if (event.cause === EntityInitializationCause.Spawned) {
            const entity = event.entity;
            if (inPeaceArea(entity)
                && entity.matches({ families: ["monster"], excludeFamilies: ["zombie_villager", "wither", "illager"] })
            ) {
                event.entity.remove();
            }
        }
    } catch { /* ignore */ }
});

function inPeaceArea(entity: Entity): boolean {
    for (const area of Config.peaceArea) {
        if (entity.dimension.id === area.dimension) {
            if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                return true;
            }
        }
    }
    return false;
}

export function switchPeace(): boolean {
    enable = !enable;
    return enable;
}

function registerCommand(): void {
    Command.register("peace", Permission.OP, () => {
        return switchPeace() ? "开启区域和平" : "关闭区域和平";
    }, "切换区域和平");
}

registerCommand();
