/* ---------------------------------------- *\
 *  Name        :  AFK                      *
 *  Description :  AFK                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Command } from "../libs/Command.js";
import { ConfigManager } from "../libs/ConfigManager.js";
import { debug } from "../libs/DebugLog.js";
import { Permission } from "../libs/Permission.js";

// 内存缓存：玩家 ID → (键 → 值)
const afkCache = new Map<string, Map<string, any>>();

function cacheGet<T>(player: Player, key: string, fallback: T): T {
  const pc = afkCache.get(player.id);
  if (!pc || !pc.has(key)) return fallback;
  return pc.get(key) as T;
}

function cacheSet(player: Player, key: string, value: any) {
  let pc = afkCache.get(player.id);
  if (!pc) {
    pc = new Map();
    afkCache.set(player.id, pc);
  }
  pc.set(key, value);
}

function cacheDelete(player: Player, key: string) {
  const pc = afkCache.get(player.id);
  if (pc) pc.delete(key);
}

/**
 * 清除相关属性和标签
 */
export function reset(player: Player): void {
  debug.i("AFK", `reset: player=${player.name}`);
  cacheDelete(player, "afk:last_location");
  cacheDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
/**
 * 即刻进入AFK状态
 */
export function setAFK(player: Player): void {
  debug.i("AFK", `setAFK: player=${player.name}`);
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
  cacheSet(player, "afk:step", 0);
  player.addTag("AFK");
}

function locationMoved(
  lastLocation: { x: number; y: number; z: number },
  nowLocation: { x: number; y: number; z: number }
) {
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
var scanRunId: number | undefined;
var scanActive = false;

function startScan() {
  if (scanActive || scanRunId !== undefined) return;
  scanActive = true;
  scanRunId = system.runInterval(() => {
    for (let player of world.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
      let lastLoaction = cacheGet<{ x: number; y: number; z: number } | undefined>(
        player,
        "afk:last_location",
        undefined
      );
      let nowLocation = player.location;

      if (lastLoaction !== undefined) {
        let nowStep = cacheGet<number | undefined>(player, "afk:step", undefined);
        if (!locationMoved(lastLoaction, nowLocation)) {
          if (nowStep === undefined) {
            nowStep = 1;
          } else {
            nowStep++;
          }

          if (nowStep * STEP_TIME >= ConfigManager.getSetting("afk_time", 120)) {
            setAFK(player);
          } else {
            cacheSet(player, "afk:step", nowStep);
          }
        } else {
          cacheSet(player, "afk:step", 0);
        }
      }
      cacheSet(player, "afk:last_location", nowLocation);
    }
  }, STEP_TIME * 20);
}

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
        delete playerList[id];
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
          player.removeTag("AFK");
          cacheSet(player as Player, "afk:last_location", player.location);
          cacheSet(player as Player, "afk:step", 0);
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
  if (intervalId !== undefined) {
    try {
      system.clearRun(intervalId);
    } catch {}
    intervalId = undefined;
  }
}

export function stop(): void {
  debug.i("AFK", "stop");
  if (scanRunId !== undefined) {
    try {
      system.clearRun(scanRunId);
    } catch {}
    scanRunId = undefined;
  }
  scanActive = false;
  stopAFKScan();
  playerList = {};
}

export function registerPermissions(): void {
  Permission.register("afk.use", Permission.Member);
  Permission.register("afk.clear.other", Permission.OP);
}

export function registerEvents(): void {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) reset(event.player);
  });
}

export function init(): void {
  debug.i("AFK", "init");
  console.log(`Initializing AFK...`);
  if (!scanActive) startScan();
  for (let player of world.getAllPlayers()) {
    reset(player);
  }
  console.log(`AFK initialized successfully.`);
}

export function registerCommand(): void {
  debug.i("AFK", "registerCommand");
  Command.register("afk", "afk.use", setAFK as (player: Player | undefined) => any, "进入AFK状态", "afk");
  Command.register(
    "noafk",
    "afk.clear.other",
    (pl: Player | undefined) => {
      if (pl) pl.addTag("NOAFK");
    },
    "令玩家不会进入AFK状态",
    "afk"
  );
}
