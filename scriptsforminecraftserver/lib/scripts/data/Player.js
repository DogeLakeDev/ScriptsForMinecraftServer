import { getPlayers } from "../api/PlayersDataApi";
import { formatTimestamp } from "../libs/Tools";
export async function getPlayerData(player) {
    const data = {
        id: player.id,
        name: player.name,
        clientSystemInfoLocal: player.clientSystemInfo?.locale,
        clientSystemInfoMaxRenderDistance: player.clientSystemInfo?.maxRenderDistance,
        clientSystemInfoMemoryTierLevel: player.clientSystemInfo?.memoryTier,
        clientSystemInfoPlatformType: player.clientSystemInfo?.platformType,
        graphicsMode: player.graphicsMode,
        dynamicPropertyTotalByteCount: player.getDynamicPropertyTotalByteCount(),
        ping: player.getPing(),
        level: player.level,
        spawnPoint: JSON.stringify(player.getSpawnPoint()),
        tags: player.getTags().toString(),
        totalXp: player.getTotalXp(),
        updatedAt: formatTimestamp(Date.now()),
    };
    return data;
}
export async function isPlayerExists(playerId) {
    return (await getPlayers({ id: playerId })) !== null;
}
//# sourceMappingURL=Player.js.map