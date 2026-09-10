import type { QueryFn } from "../lib/sqlite.js";

export interface PlayerSessionInput {
  playerName: string;
  xuid: string;
}

/** 将 BDS 日志中的权威 XUID 合并到玩家快照表。 */
export function syncPlayerSession(query: QueryFn, input: PlayerSessionInput, now = Date.now()): void {
  query(
    `INSERT INTO sfmc_players (id, name, xuid, last_online, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       xuid = excluded.xuid,
       last_online = excluded.last_online,
       updated_at = excluded.updated_at`,
    [input.xuid, input.playerName, input.xuid, now, now],
  );
}
