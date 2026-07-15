import { world } from "@minecraft/server";
import { saveWorldData } from "../api";
import { debug } from "../libs/DebugLog";
import { getShanghaiTime } from "../libs/Tools";
import type { WorldData } from "../types";

/** GameRules 属性是原型 getter，JSON.stringify 会输出空对象。手动枚举。 */
function serializeGameRules(): string {
  const g = world.gameRules;
  const rules: Record<string, boolean> = {};
  const props = [
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
  for (const key of props) {
    try {
      (rules as any)[key] = (g as any)[key];
    } catch {
      /* 不存在的规则跳过 */
    }
  }
  return JSON.stringify(rules);
}

export async function getWorldData(): Promise<WorldData> {
  debug.i("DATA", "getWorldData");
  const data: WorldData = {
    allowCheats: world.allowCheats,
    gameRules: serializeGameRules(),
    seed: world.seed,
    defaultSpawnLocation: JSON.stringify(world.getDefaultSpawnLocation()),
    difficulty: world.getDifficulty(),

    day: world.getDay(),
    tickingAreasCount: world.tickingAreaManager.chunkCount,
    absoluteTime: world.getAbsoluteTime(),
    structuresFromAddon: world.structureManager.getPackStructureIds().toString(),
    structuresFromWorld: world.structureManager.getWorldStructureIds().toString(),
    MoonPhase: world.getMoonPhase(),
    dynamicPropertyTotalByteCount: world.getDynamicPropertyTotalByteCount(),

    updatedAt: getShanghaiTime().date + getShanghaiTime().time,
  };
  return data;
}

export async function syncWorldData(): Promise<void> {
  debug.i("DATA", "syncWorldData");
  const data = await getWorldData();
  await saveWorldData(data);
}
