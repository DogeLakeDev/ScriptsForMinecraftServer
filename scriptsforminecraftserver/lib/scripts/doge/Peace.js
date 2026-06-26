/* ---------------------------------------- *\
 *  Name        :  区域和平                   *
 *  Description :  区域和平                   *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { world, EntityInitializationCause } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";
export class Peace {
    constructor() {
        this.enable = true;
    }
    /**
     * @returns {Peace}
     */
    static getInstance() {
        if (!Peace._instance) {
            Peace._instance = new Peace();
        }
        return Peace._instance;
    }
    init() {
        this.registerEvents();
        this.registerCommands();
    }
    registerEvents() {
        world.afterEvents.entitySpawn.subscribe(event => {
            if (!this.enable)
                return;
            try {
                if (event.cause === EntityInitializationCause.Spawned) {
                    let entity = event.entity;
                    if (this.inPeaceArea(entity)
                        && entity.matches({ families: ["monster"], excludeFamilies: ["zombie_villager", "wither", "illager"] })) {
                        event.entity.remove();
                    }
                }
            }
            catch (_a) { }
        });
    }
    /**
     * 实体是否在和平区域内
     */
    inPeaceArea(entity) {
        for (let area of Config.peaceArea) {
            if (entity.dimension.id === area.dimension) {
                if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                    return true;
                }
            }
        }
        return false;
    }
    switchPeace() {
        return this.enable = !this.enable;
    }
    registerCommands() {
        Command.register("peace", Permission.OP, () => {
            return Peace.getInstance().switchPeace() ? "开启区域和平" : "关闭区域和平";
        }, "切换区域和平");
    }
}
//# sourceMappingURL=Peace.js.map