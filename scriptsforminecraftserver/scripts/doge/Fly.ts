/* ---------------------------------------- *\
 *  Name        :  区域飞行                   *
 *  Description :  芜湖                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player, system, world, GameMode, Entity } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools"

/**
 * 玩家加入事件
 */
export function playerJoinEvent(player: Player) {
  system.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== undefined) {
      enableFly(player);
      player.sendMessage(`[Doge] 当前处于飞行区, 已打开飞行模式。`);
      player.setDynamicProperty("dogefly", areaName);
    }
    else {
      disableFly(player);
      player.sendMessage(`[Doge] 当前不处于飞行区, 已关闭飞行模式。`);
      player.setDynamicProperty("dogefly", undefined);
    }
  }, 60);
}

system.runInterval(() => {
  for (let player of world.getPlayers({ "gameMode": GameMode.Survival })) {
    let nowArea = player.getDynamicProperty("dogefly") as string | undefined;
    let areaName = inFlyArea(player);
    if (nowArea === undefined) {
      // 不能飞
      // 若玩家在区域内，则设为飞行
      if (areaName !== undefined) {
        enableFly(player);
        player.sendMessage(`[Doge] 进入飞行区 ${areaName}, 已打开飞行模式。`);
        player.setDynamicProperty("dogefly", areaName);
      }
    }
    else {
      // 能飞
      // 若玩家在区域外，则取消飞行
      if (areaName === undefined) {
        disableFly(player);
        player.sendMessage(`[Doge] 离开飞行区 ${nowArea}, 已关闭飞行模式。`);
        player.setDynamicProperty("dogefly", undefined);
      }
    }
  }
}, 400);

/**
 * 实体是否在飞行区域内
 */
function inFlyArea(entity: Entity): string | undefined {
  for (let area of Config.flyArea) {
    if (entity.dimension.id === area.dimension) {
      if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
        return area.name;
      }
    }
  }
  return undefined;
}

function enableFly(player: Player) {
  player.runCommand("gamerule sendcommandfeedback false");
  player.runCommand("ability @s mayfly true");
  player.runCommand("gamerule sendcommandfeedback true");
}

function disableFly(player: Player) {
  let res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { "includeLiquidBlocks": true, "includePassableBlocks": false });
  if (res !== undefined) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }

  player.runCommand("gamerule sendcommandfeedback false");
  player.runCommand("ability @s mayfly false");
  player.runCommand("gamemode adventure");
  player.runCommand("gamemode survival");
  player.runCommand("gamerule sendcommandfeedback true");
}
