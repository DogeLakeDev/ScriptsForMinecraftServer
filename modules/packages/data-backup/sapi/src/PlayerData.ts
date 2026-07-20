/* ---------------------------------------- *\
 *  Name        :  PlayerData              *
 *  Description :  玩家数据的收集与保存      *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player } from "@minecraft/server";
import type { PlayerData } from "@sfmc/types";
import { getPlayers } from "./PlayersDataApi.js";
import { formatTimestamp } from "@sfmc/sdk/sapi/runtime";

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
