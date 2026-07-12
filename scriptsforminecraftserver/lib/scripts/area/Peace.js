/* ---------------------------------------- *\
 *  Name        :  区域和平                   *
 *  Description :  区域和平                   *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { world, EntityInitializationCause } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import * as Tool from "../libs/Tools";
export class Peace {
    constructor() {
        this.enable = true;
    }
    static getInstance() {
        if (!Peace._instance) {
            Peace._instance = new Peace();
        }
        return Peace._instance;
    }
    init() {
        this.registerEvents();
    }
    registerEvents() {
        world.afterEvents.entitySpawn.subscribe((event) => {
            if (!this.enable)
                return;
            try {
                if (event.cause === EntityInitializationCause.Spawned) {
                    let entity = event.entity;
                    if (this.inPeaceArea(entity) && entity.matches(this.getPeaceEntityQO())) {
                        event.entity.remove();
                    }
                }
            }
            catch { }
        });
    }
    /**
     * 实体是否在和平区域内
     */
    inPeaceArea(entity) {
        for (let area of ConfigManager.getAreas("peace")) {
            if (entity.dimension.id === area.dimension) {
                if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                    return true;
                }
            }
        }
        return false;
    }
    switchPeace() {
        return (this.enable = !this.enable);
    }
    getPeaceEntityQO() {
        const filters = ConfigManager.getPeaceFilters();
        const qo = {};
        for (const f of filters) {
            if (f.family) {
                if (!qo.families)
                    qo.families = [];
                qo.families.push(f.family);
            }
            if (f.exclude_family) {
                if (!qo.excludeFamilies)
                    qo.excludeFamilies = [];
                qo.excludeFamilies.push(f.exclude_family);
            }
        }
        return qo;
    }
}
//# sourceMappingURL=Peace.js.map