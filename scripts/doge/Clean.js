// ==================== Title ====================

  /* ---------------------------------------- *\
   *  Name        :  DogeLake Cleaner         *
   *  Description :  清理垃圾 传送到最近的玩家. *
   *  Version     :  1.0.0                    *
   *  Author      :  ENIAC_Jushi              *
  \* ---------------------------------------- */

import { system, world, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import { Config } from "../data/Config";

var isCleaning = false;
/**
 * 初始化
 * /scoreboard objectives add item_amount dummy item_amount
 * /scoreboard players set target_value item_amount 100
 */
world.getDimension("overworld").runCommand(`scoreboard objectives add item_amount dummy item_amount`);
world.getDimension("overworld").runCommand(`scoreboard players set target_value item_amount ${Config.ITEMMAX}`);

// 扫描 一分钟一次
system.runInterval(()=>{
    if(!isCleaning){
        let dim = world.getDimension("overworld");
        dim.runCommand("scoreboard players set value item_amount 0");
        dim.runCommand(`execute as @e[type=item,c=${Config.ITEMMAX + 1}] run scoreboard players add value item_amount 1`);
        dim.runCommand("execute if score value item_amount > target_value item_amount run scriptevent doge:clean");
    }
}, 1200);

/**
 * 开始扫地任务
 * @param {ScriptEventCommandMessageAfterEvent} event 
 */
export function startClean(event){
    isCleaning = true;
    let dimension = world.getDimension("overworld");
    world.sendMessage( {"rawtext":[{"text":"「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 60 §fs"}]} );

    system.runTimeout(()=>{
        world.sendMessage( {"rawtext":[{"text":"「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 30 §fs"}]} );

        system.runTimeout(()=>{
            world.sendMessage({"rawtext":[{"text":"「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 10 §fs"}]});

            system.runTimeout(()=>{
                world.sendMessage({"rawtext":[{"text":"「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 5 §fs"}]});

                system.runTimeout(()=>{
                    dimension.runCommand("execute as @e[type=item] at @s run tp @p");
                    world.sendMessage({"rawtext":[{"text":"§a* 已清理掉落物 *"}]});

                    // 完成一次清理后需要等120秒才能进行下一次清理
                    system.runTimeout(()=>{
                        isCleaning =  false;
                    }, 2400);
                }, 100);
            }, 100);
        }, 400);
    }, 600);
}

