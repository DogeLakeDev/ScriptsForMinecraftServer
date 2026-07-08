import { HttpDB } from "../libs/HttpDB";
export async function saveWorldData(data) {
    return HttpDB.post("/api/sfmc/world", { data });
}
export async function getWorldData() {
    const body = await HttpDB.get("/api/sfmc/world");
    if (!body)
        return null;
    try {
        return JSON.parse(body).world;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=WorldDataApi.js.map