import { world, Entity, EntityInitializationCause} from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools"

var enable = true;
world.afterEvents.entitySpawn.subscribe(event => {
    if(!enable) return;
    try{
        if(event.cause === EntityInitializationCause.Spawned){
            let entity = event.entity;
            if(inPeaceArea(entity)
                && entity.matches({families: ["monster"], excludeFamilies: ["zombie_villager"]})
            ){
                event.entity.remove();
            }
        }
    }
    catch{}
});

/**
 * 实体是否在和平区域内
 * @param {Entity} entity
 * @returns {boolean}
 */
function inPeaceArea(entity){
    for(let area of Config.peaceArea){
        if(entity.dimension.id === area.dimension){
            if(Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])){
                return true;
            }
        }
    }
    return false;
}

/**
 * @returns {boolean}
 */
export function switchPeace(){
    return enable = enable ? false : true;
}
