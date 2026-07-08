import { world } from "@minecraft/server";
import { getShanghaiTime } from "../libs/Tools";
import { saveWorldData } from "../api/WorldDataApi";

export interface WorldData {
  allowCheats: boolean;
  gameRules: string;
  seed: string;
  defaultSpawnLocation: string;
  difficulty: string;

  day: number;
  tickingAreasCount: number;
  absoluteTime: number; // tick (day*24000+daytime)
  structuresFromAddon: string;
  structuresFromWorld: string;
  dynamicPropertyTotalByteCount: number;
  // Gets the total byte count of dynamic properties. This could potentially be used for your own analytics to ensure you're not storing gigantic sets of dynamic properties.
  MoonPhase: number; // 月相 🔎冷知识：在最亮的月相阶段，猫有 50% 的几率生成黑猫;)

  updatedAt: string;
}

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

export async function getWorldData() {
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

export async function syncWorldData() {
  const data = await getWorldData();
  saveWorldData(data);
}
