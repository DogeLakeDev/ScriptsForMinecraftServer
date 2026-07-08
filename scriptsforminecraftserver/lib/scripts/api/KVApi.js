import { HttpDB } from "../libs/HttpDB";
export async function getAllKV() {
    const body = await HttpDB.get("/api/kv");
    if (!body)
        return null;
    try {
        return JSON.parse(body).kv;
    }
    catch {
        return null;
    }
}
export async function getKV(key) {
    const body = await HttpDB.get(`/api/kv/${encodeURIComponent(key)}`);
    if (!body)
        return null;
    try {
        return JSON.parse(body).value;
    }
    catch {
        return null;
    }
}
export async function setKV(key, value) {
    return HttpDB.post("/api/kv/save", { key, value });
}
export async function deleteKV(key) {
    return HttpDB.del(`/api/kv/${encodeURIComponent(key)}`);
}
//# sourceMappingURL=KVApi.js.map