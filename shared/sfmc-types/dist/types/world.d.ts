/**
 * world.ts — 世界 共享数据模型
 */
export interface WorldData {
    allowCheats: boolean;
    gameRules: string;
    seed: string;
    defaultSpawnLocation: string;
    difficulty: string;
    day: number;
    tickingAreasCount: number;
    absoluteTime: number;
    structuresFromAddon: string;
    structuresFromWorld: string;
    dynamicPropertyTotalByteCount: number;
    moonPhase: number;
    updatedAt: string;
}
