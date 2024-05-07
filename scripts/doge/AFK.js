// ==================== Title ====================

  /* ---------------------------------------- *\
   *  Name        :  DogeLake AFK             *
   *  Description :  AFK                      *
   *  Version     :  1.0.0                    *
   *  Author      :  ENIAC_Jushi              *
  \* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Config } from "../data/Config";

// 初始化
for(let player of world.getAllPlayers()){
    reset(player);
}
/**
 * 清除相关动态属性和标签
 * @param {Player} player 
 */
export function reset(player){
    player.setDynamicProperty("afk:last_location");
    player.setDynamicProperty("afk:step");
    player.removeTag("AFK");
    player.removeTag("NOAFK");
}
/**
 * 即刻进入AFK状态
 * @param {Player} player 
 */
export function setAFK(player){
    startAFKScan();
    playerList[player.id] = player.location;
    world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
    player.setDynamicProperty("afk:step", 0);
    player.addTag("AFK");
}

function locationMoved(lastLoaction, nowLocation){
    let deltaX = lastLoaction.x - nowLocation.x;
    if(-1 < deltaX && deltaX < 1){
        let deltaY = lastLoaction.y - nowLocation.y;
        if(-1 < deltaY && deltaY < 1){
            let deltaZ = lastLoaction.z - nowLocation.z;
            if(-1 < deltaZ && deltaZ < 1){
                return false;
            }
        }
    }
    return true;
}

// 15秒一次全体玩家的位置扫描
const STEPTIME = 15;
system.runInterval(()=>{
    for(let player of world.getPlayers({"excludeTags": ["AFK", "NOAFK"]})){

        let lastLoaction = player.getDynamicProperty("afk:last_location");
        let nowLocation = player.location;
        
        if(lastLoaction !== undefined){
            let nowStep = player.getDynamicProperty("afk:step");
            if(!locationMoved(lastLoaction, nowLocation)){
                // 位置没有改变，步数增加
                if(nowStep===undefined){
                    nowStep = 1;
                }
                else{
                    nowStep ++;
                }
                
                // 判断是否满足AFK条件
                if(nowStep*STEPTIME >= Config.AFKTime){
                    // 满足
                    setAFK(player)
                }
                else{
                    player.setDynamicProperty("afk:step", nowStep);
                }
            }
            else{
                player.setDynamicProperty("afk:step", 0);
            }
        }

        player.setDynamicProperty("afk:last_location", nowLocation);
    }
}, STEPTIME*20);

// 5秒一次AFK玩家的位置扫描
var intervalId = undefined;
var playerList = {}; // [{pl:Player, location:{x,y,z}}]
function startAFKScan(){
    if(intervalId === undefined){
        intervalId = system.runInterval(()=>{
            let count = 0;
            for(let id in playerList){
                let player = world.getEntity(id);
                if(player === undefined){
                    delete playerList.id;
                }
                else{
                    if(locationMoved(playerList[id], player.location)){
                        world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
                        player.removeTag("AFK");
                        player.setDynamicProperty("afk:last_location", player.location);
                        player.setDynamicProperty("afk:step", 0);
                        delete playerList[id]
                    }
                    else{
                        count ++;
                    }
                }
            }
            if(count === 0) stopAFKScan();
        }, 100);
    }
}

function stopAFKScan(){
    system.clearRun(intervalId);
    intervalId = undefined;
}