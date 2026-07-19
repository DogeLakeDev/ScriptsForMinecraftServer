/**
 * scoreboard.ts — 计分板 共享数据模型
 *
 * 注: ScoreboardIdentityType 是 @minecraft/server 枚举,db-server 不依赖 SAPI 包,
 * 这里使用底层 number 表示。前端 sapi 可在使用处类型收窄到枚举。
 */
/** 0 = invalid, 1 = player, 2 = entity, 3 = fake */
export type ScoreboardIdentityTypeNumber = 0 | 1 | 2 | 3 | number;
export interface Participant {
    id: number;
    type: ScoreboardIdentityTypeNumber;
    name: string;
    score: number;
}
export interface ScoreboardEntry {
    id: string;
    displayName: string;
    participants?: Participant[];
}
