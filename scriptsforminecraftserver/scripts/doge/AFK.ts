/* ---------------------------------------- *\
 *  Name        :  AFK                      *
 *  Description :  AFK                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Config } from "../data/Config";
import { Permission } from "../libs/Permission";
import { Command } from "../libs/Command";
import { Storage } from "../libs/Storage";

export function init() {
  // 初始化
  for (let player of world.getAllPlayers()) {
    reset(player);
  }
}
/**
 * 清除相关属性和标签
 */
export function reset(player: Player) {
  Storage.playerDelete(player, "afk:last_location");
  Storage.playerDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
/**
 * 即刻进入AFK状态
 */
export function setAFK(player: Player) {
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
  Storage.playerSet(player, "afk:step", 0);
  player.addTag("AFK");
}

function locationMoved(lastLocation: { x: number; y: number; z: number }, nowLocation: { x: number; y: number; z: number }) {
  let deltaX = lastLocation.x - nowLocation.x;
  if (-1 < deltaX && deltaX < 1) {
    let deltaY = lastLocation.y - nowLocation.y;
    if (-1 < deltaY && deltaY < 1) {
      let deltaZ = lastLocation.z - nowLocation.z;
      if (-1 < deltaZ && deltaZ < 1) {
        return false;
      }
    }
  }
  return true;
}

// 15秒一次全体玩家的位置扫描
const STEP_TIME = 15;
system.runInterval(() => {
  for (let player of world.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
    let lastLoaction = Storage.playerGet<{ x: number; y: number; z: number } | undefined>(player, "afk:last_location", undefined);
    let nowLocation = player.location;

    if (lastLoaction !== undefined) {
      let nowStep = Storage.playerGet<number | undefined>(player, "afk:step", undefined);
      if (!locationMoved(lastLoaction, nowLocation)) {
        // 位置没有改变，步数增加
        if (nowStep === undefined) {
          nowStep = 1;
        } else {
          nowStep++;
        }

        // 判断是否满足AFK条件
        if (nowStep * STEP_TIME >= Config.AFKTime) {
          // 满足
          setAFK(player)
        } else {
          Storage.playerSet(player, "afk:step", nowStep);
        }
      } else {
        Storage.playerSet(player, "afk:step", 0);
      }
    }
    Storage.playerSet(player, "afk:last_location", nowLocation);
  }
}, STEP_TIME * 20);

// 5秒一次AFK玩家的位置扫描
var intervalId: number | undefined = undefined;
var playerList: Record<string, { x: number; y: number; z: number }> = {};
function startAFKScan() {
  if (intervalId !== undefined) {
    return;
  }
  intervalId = system.runInterval(() => {
    let count = 0;
    for (let id in playerList) {
      let player = world.getEntity(id);
      if (player === undefined) {
        delete playerList.id;
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
          player.removeTag("AFK");
          Storage.playerSet(player as Player, "afk:last_location", player.location);
          Storage.playerSet(player as Player, "afk:step", 0);
          delete playerList[id];
        } else {
          count++;
        }
      }
    }
    if (count === 0) {
      stopAFKScan();
    }
  }, 100);
}

function stopAFKScan() {
  system.clearRun(intervalId!);
  intervalId = undefined;
}

function registerCommand() {
  Permission.register('afk.use', Permission.Any);
  Permission.register('afk.clear.other', Permission.OP);
  Command.register("afk", 'afk.use', setAFK as (player: Player | undefined) => any, "进入AFK状态");
  Command.register("noafk", 'afk.clear.other', (pl: Player | undefined) => {
    if (pl) pl.addTag("NOAFK");
  }, "令玩家不会进入AFK状态");
}

registerCommand();
