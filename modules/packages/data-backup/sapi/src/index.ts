/**
 * @sfmc/module-data-backup — v2 入口
 *
 * core 模块(驻留主仓)。替代 v1 PlayerData / PlayersDataApi / WorldData / WorldDataApi 四件,
 * 统一在 ModuleRegistry.register 的 lifecycle 里订阅 playerSpawn / world.afterEvents,
 * 定时收集玩家数据与世界 gameRules 写回 sfmc_players / sfmc_world。
 *
 * upsert 模式 = 事务外先 db.query,事务内 update 或 insert(SDK 暂不提供 upsert op)。
 */

import { Player, system, world } from "@minecraft/server";
import { db } from "@sfmc/sdk/sapi/db";
import { debug, getShanghaiTime } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "core-data-backup";

const FLUSH_INTERVAL_TICKS = 600;

const GAME_RULE_KEYS = [
  "commandBlockOutput",
  "doDayLightCycle",
  "doEntityDrops",
  "doFireTick",
  "doImmediateRespawn",
  "doInsomnia",
  "doLimitedCrafting",
  "doMobLoot",
  "doMobSpawning",
  "doTileDrops",
  "doWeatherCycle",
  "drowningDamage",
  "fallDamage",
  "fireDamage",
  "freezeDamage",
  "functionCommandLimit",
  "keepInventory",
  "maxCommandChainLength",
  "mobGriefing",
  "naturalRegeneration",
  "randomTickSpeed",
  "sendCommandFeedback",
  "showBorderEffect",
  "showCoordinates",
  "showDeathMessage",
  "showRecipeMessages",
  "showTags",
  "spawnRadius",
  "tntExplodes",
] as const;

function serializeGameRules(): string {
  const g = world.gameRules as unknown as Record<string, boolean>;
  const rules: Record<string, boolean> = {};
  for (const key of GAME_RULE_KEYS) {
    try {
      if (typeof g[key] === "boolean") rules[key] = g[key];
    } catch {
      /* 不存在的规则跳过 */
    }
  }
  return JSON.stringify(rules);
}

function snapshotPlayer(player: Player): Record<string, unknown> {
  const info = player.clientSystemInfo;
  return {
    id: player.id,
    name: player.name,
    permission: 0,
    client_system_info_local: info?.locale ?? "",
    client_system_info_maxRenderDistance: info?.maxRenderDistance ?? 0,
    client_system_info_memoryTier_level: String(info?.memoryTier ?? ""),
    client_system_info_PlatformType: info?.platformType ?? "",
    graphicsMode: player.graphicsMode,
    dynamicPropertyTotalByteCount: player.getDynamicPropertyTotalByteCount(),
    ping: player.getPing(),
    spawnPoint: JSON.stringify(player.getSpawnPoint()),
    tags: player.getTags().toString(),
    level: player.level,
    totalXp: player.getTotalXp(),
    updated_at: Date.now(),
  };
}

async function upsertPlayer(row: Record<string, unknown>): Promise<void> {
  const id = String(row.id);
  const name = String(row.name);
  const existing = await db.query<{ id: string; name: string }>("sfmc_players", {
    where: {
      and: [
        { eq: ["id", id] },
        { eq: ["name", name] },
      ],
    },
    limit: 1,
  });
  await db.tx(async (tx) => {
    if (existing.length > 0) {
      await tx.update("sfmc_players", `${id}|${name}`, row);
    } else {
      await tx.insert("sfmc_players", row);
    }
  });
}

async function saveAllPlayers(): Promise<void> {
  const tasks: Array<Promise<void>> = [];
  for (const player of world.getAllPlayers()) {
    tasks.push(upsertPlayer(snapshotPlayer(player)));
  }
  await Promise.all(tasks);
}

async function saveWorld(): Promise<void> {
  const now = getShanghaiTime();
  const row = {
    id: "singleton",
    seed: String(world.seed),
    spawn_x: world.getDefaultSpawnLocation().x,
    spawn_y: world.getDefaultSpawnLocation().y,
    spawn_z: world.getDefaultSpawnLocation().z,
    game_difficulty: String(world.getDifficulty()),
    allow_cheats: world.allowCheats,
    game_rules: serializeGameRules(),
    ticking_areas_count: world.tickingAreaManager.chunkCount,
    structures_from_addon: world.structureManager.getPackStructureIds().toString(),
    structures_from_world: world.structureManager.getWorldStructureIds().toString(),
    moon_phase: world.getMoonPhase(),
    dynamic_property_total_byte_count: world.getDynamicPropertyTotalByteCount(),
    updated_at: `${now.date} ${now.time}`,
  };
  await db.tx(async (tx) => {
    const existing = await tx.get("sfmc_world", "singleton");
    if (existing) {
      await tx.update("sfmc_world", "singleton", row);
    } else {
      await tx.insert("sfmc_world", row);
    }
  });
}

let playerSpawnSub: { unsubscribe(): void } | undefined;
let flushRunId: number | undefined;

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      // core 模块,不对外暴露命令
    },
    async init() {
      playerSpawnSub = world.afterEvents.playerSpawn.subscribe((event) => {
        if (event.initialSpawn) {
          void upsertPlayer(snapshotPlayer(event.player));
        }
      });
      flushRunId = system.runInterval(() => {
        void saveAllPlayers();
        void saveWorld();
      }, FLUSH_INTERVAL_TICKS);

      world.afterEvents.worldInitialize.subscribe(() => {
        void saveWorld();
      });

      debug.i("DATA", "init");
    },
    cleanup() {
      try {
        playerSpawnSub?.unsubscribe();
      } catch {
        /* ignore */
      }
      if (flushRunId !== undefined) {
        try {
          system.clearRun(flushRunId);
        } catch {
          /* ignore */
        }
      }
      debug.i("DATA", "stop");
    },
  },
});