import { world } from "@minecraft/server";
import { getShanghaiTime } from "../libs/Tools";
import { saveWorldData } from "../api/WorldDataApi";
/** GameRules 属性是原型 getter，JSON.stringify 会输出空对象。手动枚举。 */
function serializeGameRules() {
    const g = world.gameRules;
    const rules = {};
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
    ];
    for (const key of props) {
        try {
            rules[key] = g[key];
        }
        catch {
            /* 不存在的规则跳过 */
        }
    }
    return JSON.stringify(rules);
}
export async function getWorldData() {
    const data = {
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
//# sourceMappingURL=World.js.map