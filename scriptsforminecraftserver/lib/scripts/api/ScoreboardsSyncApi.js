import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
export async function backupScoreboards(entries) {
    return HttpDB.post("/api/sfmc/scoreboards", { entries });
}
export async function loadScoreboards(filter) {
    const qs = toQueryString({
        objective: filter?.objective,
        name: filter?.name,
        id: filter?.id,
    });
    const body = await HttpDB.get(`/api/sfmc/scoreboards${qs}`);
    if (!body)
        return null;
    try {
        return JSON.parse(body).entries;
    }
    catch {
        return null;
    }
}
export async function getScoreboardObjectives() {
    const body = await HttpDB.get("/api/sfmc/scoreboards/objectives");
    if (!body)
        return null;
    try {
        return JSON.parse(body).objectives;
    }
    catch {
        return null;
    }
}
export async function clearScoreboards() {
    return HttpDB.del("/api/sfmc/scoreboards");
}
//# sourceMappingURL=ScoreboardsSyncApi.js.map