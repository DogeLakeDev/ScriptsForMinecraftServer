/**
 * player.ts — 玩家 共享数据模型
 */
export interface PlayerData {
    id: string;
    name: string;
    permission?: number;
    clientSystemInfoLocal?: string;
    clientSystemInfoMaxRenderDistance?: number;
    clientSystemInfoMemoryTierLevel?: string;
    clientSystemInfoPlatformType?: string;
    graphicsMode?: string;
    dynamicPropertyTotalByteCount?: number;
    ping?: number;
    level?: number;
    spawnPoint?: string;
    tags?: string;
    totalXp?: number;
    afkStep?: number;
    afkLastLocation?: {
        x: number;
        y: number;
        z: number;
    };
    onlineSession?: number;
    onlineToday?: number;
    onlineMonth?: number;
    onlineTotal?: number;
    onlineLastDate?: number;
    onlineLastMonth?: number;
    activeChannel?: string;
    updatedAt: string;
}
