/* ---------------------------------------- *\
 *  Name        :  区域飞行                   *
 *  Description :  芜湖                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Entity, GameMode, Player, system, world } from "@minecraft/server";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { ConfigManager } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";
import * as Tool from "@sfmc/sdk/sapi/runtime";

export function registerPermissions(): void {
  Permission.register("fly.use", Permission.Any);
}

export function registerEvents(): void {
  debug.i("FLY", "registerEvents");
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) playerJoinEvent(event.player);
  });
}

export function init(): void {}

/**
 * 玩家加入事件
 */
export function playerJoinEvent(player: Player): void {
  system.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== undefined) {
      enableFly(player);
      Tool.Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
      player.setDynamicProperty("hpbe:dogefly", areaName);
    }
  }, 60);
}

let scanRunId: number | undefined;

function startScan() {
  if (scanRunId !== undefined) return;
  scanRunId = system.runInterval(() => {
    for (let player of world.getPlayers({ gameMode: GameMode.Survival })) {
      let nowArea = player.getDynamicProperty("hpbe:dogefly") as string | undefined;
      let areaName = inFlyArea(player);

      if (areaName !== undefined) {
        if (nowArea === undefined) {
          enableFly(player);
          Tool.Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
          player.setDynamicProperty("hpbe:dogefly", areaName);
        } else if (nowArea !== areaName) {
          player.setDynamicProperty("hpbe:dogefly", areaName);
        }
      } else {
        if (nowArea !== undefined) {
          disableFly(player);
          Tool.Msg.info(`离开飞行区 ${nowArea}, 已关闭飞行模式。`, player);
          player.setDynamicProperty("hpbe:dogefly", undefined);
        }
      }
    }
  }, 40);
}

export function stop(): void {
  if (scanRunId !== undefined) {
    try {
      system.clearRun(scanRunId);
    } catch {}
    scanRunId = undefined;
  }
}

export function boot(): void {
  if (scanRunId === undefined) startScan();
}

/**
 * 实体是否在飞行区域内
 */
function inFlyArea(entity: Entity): string | undefined {
  for (let area of ConfigManager.getAreas("fly")) {
    if (entity.dimension.id === area.dimension) {
      if (
        Tool.pointInArea_2D(
          entity.location.x,
          entity.location.z,
          area.start[0],
          area.start[1],
          area.end[0],
          area.end[1]
        )
      ) {
        return area.name;
      }
    }
  }
  return undefined;
}

function enableFly(player: Player) {
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly true");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {
    console.warn("§c由于新版移除了相关指令，请在世界中开启教育模式。");
  }
}

function disableFly(player: Player) {
  let res = player.dimension.getBlockFromRay(
    player.location,
    { x: 0, y: -1, z: 0 },
    { includeLiquidBlocks: true, includePassableBlocks: false }
  );
  if (res !== undefined) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }

  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly false");
    player.runCommand("gamemode adventure");
    player.runCommand("gamemode survival");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {}
}