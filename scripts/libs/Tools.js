import { Player, world } from "@minecraft/server";

// 判断坐标是否在某区域内 (2D, 包含边界)
export function pointInArea_2D(x,z,areaStart_x,areaStart_z,areaEnd_x,areaEnd_z){
    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }
    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }
    return true;

}
export function pointInArea_3D(x,y,z,areaStart_x,areaStart_y,areaStart_z,areaEnd_x,areaEnd_y,areaEnd_z){
    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }
    if(areaStart_y < areaEnd_y){
        if(y < areaStart_y || areaEnd_y < y){
            return false;
        }
    }
    else{
        if(y < areaEnd_y || areaStart_y < y){
            return false;
        }
    }
    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }
    return true;
}
/**
 * 
 * @param {string} name 
 * @returns 
 */
export function playerCMDName(name){
    if (name.indexOf(' ') != -1) {
        return '"' + name + '"'
    }
    return name;
}

export function logger(str){
    
    for(let pl of world.getPlayers()){
        pl.sendMessage({rawtext:[{"text": `${str}`}]})
    }
}
