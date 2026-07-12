import { Player } from "@minecraft/server";
import { getPlayers } from "../api";
import { formatTimestamp } from "../libs/Tools";
import type { PlayerData } from "../types";

export async function getPlayerData(player: Player): Promise<PlayerData> {
  const data: PlayerData = {
    id: player.id,
    name: player.name,
    clientSystemInfoLocal: player.clientSystemInfo?.locale,
    clientSystemInfoMaxRenderDistance: player.clientSystemInfo?.maxRenderDistance,
    clientSystemInfoMemoryTierLevel: String(player.clientSystemInfo?.memoryTier ?? ""),
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

export async function isPlayerExists(playerId: string): Promise<boolean> {
  return (await getPlayers({ id: playerId })) !== null;
}
