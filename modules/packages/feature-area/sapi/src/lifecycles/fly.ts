/**
 * lifecycles/fly.ts — 区域飞行
 *
 * 进入开启 fly 的区域自动开飞,离开则关闭并落地。
 * 区域判定走 area-service;扫描周期读 configs/area.json 的 scan_interval_ticks。
 */

import { Entity, GameMode, Player, PlayerSpawnAfterEvent, system, world } from "@minecraft/server";
import { debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { ModuleLifecycle } from "@sfmc/sdk/module-loader";
import { getScanIntervalTicks, pointInFeatureArea } from "../area-service.js";

let _scanRunId: number | undefined = undefined;
let _spawnCb: ((event: PlayerSpawnAfterEvent) => void) | undefined = undefined;

/** 实体是否在开启 fly 的区域内,命中返回区域名 */
function inFlyArea(entity: Entity): string | undefined {
  const area = pointInFeatureArea("fly", entity.dimension.id, entity.location.x, entity.location.z);
  return area ? area.name : undefined;
}

function enableFly(player: Player): void {
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly true");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch {
    console.warn("§c由于新版移除了相关指令，请在世界中开启教育模式。");
  }
}

function disableFly(player: Player): void {
  const res = player.dimension.getBlockFromRay(
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
  } catch {
    /* ignore */
  }
}

/** 玩家进服时的一次性检测 */
function playerJoinEvent(player: Player): void {
  system.runTimeout(() => {
    const areaName = inFlyArea(player);
    if (areaName !== undefined) {
      enableFly(player);
      Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
      player.setDynamicProperty("hpbe:dogefly", areaName);
    }
  }, 60);
}

function startScan(): void {
  if (_scanRunId !== undefined) return;
  _scanRunId = system.runInterval(() => {
    for (const player of world.getPlayers({ gameMode: GameMode.Survival })) {
      const nowArea = player.getDynamicProperty("hpbe:dogefly") as string | undefined;
      const areaName = inFlyArea(player);

      if (areaName !== undefined) {
        if (nowArea === undefined) {
          enableFly(player);
          Msg.info(`当前处于飞行区 ${areaName}, 已打开飞行模式。`, player);
          player.setDynamicProperty("hpbe:dogefly", areaName);
        } else if (nowArea !== areaName) {
          player.setDynamicProperty("hpbe:dogefly", areaName);
        }
      } else if (nowArea !== undefined) {
        disableFly(player);
        Msg.info(`离开飞行区 ${nowArea}, 已关闭飞行模式。`, player);
        player.setDynamicProperty("hpbe:dogefly", undefined);
      }
    }
  }, getScanIntervalTicks());
}

export const flyLifecycle: ModuleLifecycle = {
  registerPermissions() {
    Permission.register("fly.use", Permission.Any);
  },

  registerEvents() {
    if (_spawnCb) return;
    debug.i("FLY", "registerEvents");
    _spawnCb = world.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) playerJoinEvent(event.player);
    });
  },

  init() {
    startScan();
  },

  cleanup() {
    if (_scanRunId !== undefined) {
      try {
        system.clearRun(_scanRunId);
      } catch {
        /* ignore */
      }
      _scanRunId = undefined;
    }
    if (_spawnCb) {
      try {
        world.afterEvents.playerSpawn.unsubscribe(_spawnCb);
      } catch {
        /* ignore */
      }
      _spawnCb = undefined;
    }
  },
};
