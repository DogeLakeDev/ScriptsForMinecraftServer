/**
 * @sfmc-bds/module-afk — v2 入口
 *
 * 与 land v2 同型:ModuleRegistry.register + SDK config.drawer。
 * 零 db 表、零 cross-module service — 纯 SAPI 进程内的位置扫描 + 标签。
 * 配置走 configs/afk.json(通过 SDK config.get<AfkConfig>("afk"))。
 */

import { Player, system, world } from "@minecraft/server";
import { Command, debug, Permission, Msg } from "@sfmc-bds/sdk/sapi/runtime";
import { config } from "@sfmc-bds/sdk/sapi/config";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";

const MODULE_ID = "feature-afk";

interface AfkConfig {
  afk_time: number;          // 秒,无操作多久进入 AFK
  step_time: number;         // 秒,位置扫描间隔
}

interface AfkState {
  lastLocation?: { x: number; y: number; z: number };
  step?: number;
}

const playerList = new Map<string, { x: number; y: number; z: number }>();
const afkScanCache = new Map<string, AfkState>();

let scanRunId: number | undefined;
let intervalId: number | undefined;

function locationMoved(
  last: { x: number; y: number; z: number } | undefined,
  now: { x: number; y: number; z: number }
): boolean {
  if (!last) return true;
  return (
    Math.abs(last.x - now.x) >= 1 ||
    Math.abs(last.y - now.y) >= 1 ||
    Math.abs(last.z - now.z) >= 1
  );
}

function reset(player: Player): void {
  afkScanCache.delete(player.id);
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}

function setAFK(player: Player): void {
  if (player.hasTag("NOAFK")) return;
  player.removeTag("NOAFK");
  startAFKScan();
  playerList.set(player.id, player.location);
  // eslint-disable-next-line @sfmc-bds/no-player-send-message -- 全服广播 AFK 状态
  world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
  Msg.tips("已进入 AFK 状态", player);
  afkScanCache.set(player.id, { step: 0 });
  player.addTag("AFK");
}

function startScan(cfg: AfkConfig): void {
  if (scanRunId !== undefined) return;
  scanRunId = system.runInterval(() => {
    for (const player of world.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
      const cache = afkScanCache.get(player.id) ?? {};
      const nowLoc = player.location;
      if (cache.lastLocation) {
        if (!locationMoved(cache.lastLocation, nowLoc)) {
          const next = (cache.step ?? 0) + 1;
          if (next * cfg.step_time >= cfg.afk_time) {
            setAFK(player);
          } else {
            afkScanCache.set(player.id, { lastLocation: cache.lastLocation, step: next });
          }
        } else {
          afkScanCache.set(player.id, { lastLocation: nowLoc, step: 0 });
        }
      } else {
        afkScanCache.set(player.id, { lastLocation: nowLoc, step: 0 });
      }
    }
  }, cfg.step_time * 20);
}

function startAFKScan(): void {
  if (intervalId !== undefined) return;
  intervalId = system.runInterval(() => {
    let count = 0;
    for (const [id, lastLoc] of playerList) {
      const player = world.getEntity(id) as Player | undefined;
      if (!player) {
        playerList.delete(id);
        continue;
      }
      if (locationMoved(lastLoc, player.location)) {
        // eslint-disable-next-line @sfmc-bds/no-player-send-message -- 全服广播 AFK 状态
        world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
        player.removeTag("AFK");
        afkScanCache.set(player.id, { lastLocation: player.location, step: 0 });
        playerList.delete(id);
      } else {
        count++;
      }
    }
    if (count === 0) stopAFKScan();
  }, 100);
}

function stopAFKScan(): void {
  if (intervalId === undefined) return;
  try {
    system.clearRun(intervalId);
  } catch {
    /* ignore */
  }
  intervalId = undefined;
}

function stopAll(): void {
  debug.i("AFK", "stop");
  if (scanRunId !== undefined) {
    try {
      system.clearRun(scanRunId);
    } catch {
      /* ignore */
    }
    scanRunId = undefined;
  }
  stopAFKScan();
  playerList.clear();
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("afk.use", Permission.Member);
      Permission.register("afk.clear.other", Permission.OP);
    },
    async init() {
      const cfg = await config.get<AfkConfig>("afk");
      const safe: AfkConfig = cfg ?? { afk_time: 120, step_time: 15 };
      if (!cfg) {
        debug.e("AFK", "configs/afk.json missing — using built-in defaults {afk_time:120, step_time:15}");
      }

      config.onChange((key, value) => {
        debug.i("AFK", `config.<${key}> changed: ${JSON.stringify(value)}`);
      });

      world.afterEvents.playerSpawn.subscribe((event) => {
        if (event.initialSpawn) reset(event.player);
      });

      debug.i("AFK", "init");
      startScan(safe);
      for (const player of world.getAllPlayers()) reset(player);
    },
    registerCommands() {
      Command.register("afk", "afk.use", (pl) => {
        if (pl) setAFK(pl);
      }, "进入 AFK 状态", "afk");
      Command.register("noafk", "afk.clear.other", (pl) => {
        if (pl) pl.addTag("NOAFK");
      }, "令玩家不会进入 AFK 状态", "afk");
    },
    cleanup() {
      stopAll();
    },
  },
});
