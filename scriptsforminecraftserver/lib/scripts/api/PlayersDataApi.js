import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
const PATH_PLAYERS = "/api/sfmc/players";
export async function getPlayers(filter) {
    const qs = toQueryString({
        search: filter?.search,
        name: filter?.name,
        id: filter?.id,
        activeChannel: filter?.activeChannel,
    });
    const path = `${PATH_PLAYERS}${qs}`;
    const body = await HttpDB.get(path);
    if (!body)
        return null;
    try {
        return JSON.parse(body).players;
    }
    catch {
        return null;
    }
}
export async function savePlayers(players) {
    return HttpDB.post(PATH_PLAYERS, { players });
}
export async function updatePlayer(playerId, modify) {
    return HttpDB.patch(`${PATH_PLAYERS}/${encodeURIComponent(playerId)}`, modify);
}
//# sourceMappingURL=PlayersDataApi.js.map