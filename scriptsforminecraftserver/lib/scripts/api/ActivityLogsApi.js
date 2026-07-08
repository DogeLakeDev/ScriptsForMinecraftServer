import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
export async function batchActivities(entries) {
    return HttpDB.post("/api/sfmc/activities/batch", { entries });
}
export async function queryActivities(filter) {
    const qs = toQueryString({
        id: filter?.id,
        event: filter?.event,
        from: filter?.from,
        to: filter?.to,
        name: filter?.name,
        limit: filter?.limit,
        offset: filter?.offset,
    });
    const body = await HttpDB.get(`/api/sfmc/activities${qs}`);
    if (!body)
        return null;
    try {
        return JSON.parse(body).entries;
    }
    catch {
        return null;
    }
}
export async function getActivityStats(filter) {
    const qs = toQueryString({
        id: filter?.id,
        from: filter?.from,
        to: filter?.to,
    });
    const body = await HttpDB.get(`/api/sfmc/activities/stats${qs}`);
    if (!body)
        return null;
    try {
        return JSON.parse(body);
    }
    catch {
        return null;
    }
}
export async function cleanupActivities(keepDays = 30, keepAdmin = true) {
    return HttpDB.post("/api/sfmc/activities/cleanup", { keepDays, keepAdmin });
}
//# sourceMappingURL=ActivityLogsApi.js.map