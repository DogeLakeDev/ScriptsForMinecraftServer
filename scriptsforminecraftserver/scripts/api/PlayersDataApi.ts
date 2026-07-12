import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
import type { PlayerData } from "../types";

const PATH_PLAYERS = "/api/sfmc/players";

export async function getPlayers(filter?: {
  search?: string;
  name?: string;
  id?: string;
  activeChannel?: string;
}): Promise<PlayerData[] | null> {
  const qs = toQueryString({
    search: filter?.search,
    name: filter?.name,
    id: filter?.id,
    activeChannel: filter?.activeChannel,
  });
  const path = `${PATH_PLAYERS}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    return JSON.parse(body).players;
  } catch {
    return null;
  }
}

export async function savePlayers(players: PlayerData[]): Promise<boolean> {
  return HttpDB.post(PATH_PLAYERS, { players });
}

export async function updatePlayer(playerId: string, modify: Record<string, unknown>): Promise<boolean> {
  return HttpDB.patch(`${PATH_PLAYERS}/${encodeURIComponent(playerId)}`, modify);
}
