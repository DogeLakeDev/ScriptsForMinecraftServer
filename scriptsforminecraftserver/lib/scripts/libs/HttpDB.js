/**
 * HttpDB — SAPI 端数据库 HTTP 客户端
 *
 * 通过 @minecraft/server-net 的 HTTP 客户端连接本地 Node.js SQLite 服务。
 *
 * manifest.json 需添加：
 *   { "module_name": "@minecraft/server-net", "version": "1.0.0-beta" }
 */
import { http, HttpRequest } from "@minecraft/server-net";
import { system } from "@minecraft/server";
const HOST = "127.0.0.1";
const PORT = 3001;
const BASE_URL = `http://${HOST}:${PORT}`;
const TIMEOUT = 3; // HTTP 请求超时（秒）
export class HttpDB {
    static isAvailable() {
        return this.available;
    }
    static _shouldLogError() {
        const now = Date.now();
        if (now - this._lastErrorLog >= 5000) {
            this._lastErrorLog = now;
            return true;
        }
        return false;
    }
    static async checkHealth() {
        for (let i = 0; i < 5; i++) {
            try {
                const res = await http.get(`${BASE_URL}/api/health`);
                this.available = res.status === 200;
                if (this.available) {
                    console.info(`[HttpDB] 数据库服务连接成功 (${BASE_URL}/api/health)`);
                    return true;
                }
                console.error(`[HttpDB] 数据库服务返回异常状态 ${res.status}`);
            }
            catch (err) {
                this.available = false;
                if (i < 4) {
                    console.info(`[HttpDB] 连接失败，2s 后重试 (${i + 1}/5)...`);
                    await system.waitTicks(40);
                }
                else {
                    console.error(`[HttpDB] 连接失败 (${BASE_URL}): ${err}`);
                }
            }
        }
        return this.available;
    }
    static async fetchJSON(basePath, id, key) {
        const body = await HttpDB.get(`${basePath}/${encodeURIComponent(id)}`);
        if (!body)
            return null;
        try {
            const parsed = JSON.parse(body);
            return parsed[key] ?? null;
        }
        catch (e) {
            console.warn("[HttpDB] error:", e);
            return null;
        }
    }
    // ---- 通用 HTTP 方法 ----
    static async request(method, path, bodyData) {
        try {
            const req = new HttpRequest(`${BASE_URL}${path}`);
            req.timeout = TIMEOUT;
            req.method = method;
            if (bodyData) {
                req.body = JSON.stringify(bodyData);
                req.addHeader("Content-Type", "application/json");
            }
            const res = await http.request(req);
            this.available = true;
            return { status: res.status, body: res.body };
        }
        catch (err) {
            this.available = false;
            if (this._shouldLogError()) {
                console.error(`[HttpDB] ${method} ${path} 网络错误: ${err}`);
            }
            return { status: 0, body: "" };
        }
    }
    static async get(path) {
        const { status, body } = await this.request("Get", path);
        if (status !== 200) {
            console.info(`[HttpDB] GET ${path} → ${status}`);
        }
        return status === 200 ? body : null;
    }
    static async post(path, bodyData) {
        const { status, body } = await this.request("Post", path, bodyData);
        if (status !== 200) {
            console.info(`[HttpDB] POST ${path} → ${status}`);
        }
        return status === 200;
    }
    static async put(path, bodyData) {
        const { status, body } = await this.request("Put", path, bodyData);
        if (status !== 200) {
            console.info(`[HttpDB] PUT ${path} → ${status}`);
        }
        return status === 200;
    }
    static async patch(path, bodyData) {
        const { status, body } = await this.request("Patch", path, bodyData);
        if (status !== 200) {
            console.info(`[HttpDB] PATCH ${path} → ${status}`);
        }
        return status === 200;
    }
    static async del(path) {
        const { status, body } = await this.request("Delete", path);
        if (status !== 200) {
            console.info(`[HttpDB] DELETE ${path} → ${status}`);
        }
        return status === 200;
    }
    // ---- Holoprint 投影 ----
    static async uploadHoloStructure(projection, structureBase64) {
        return this.post("/api/hpbe/upload", { projection, structure: structureBase64 });
    }
    static async getHoloProjections(ownerId, visibility) {
        const qs = [];
        if (ownerId)
            qs.push(`owner_id=${encodeURIComponent(ownerId)}`);
        if (visibility)
            qs.push(`visibility=${encodeURIComponent(visibility)}`);
        const query = qs.length > 0 ? "?" + qs.join("&") : "";
        const body = await this.get(`/api/hpbe/projections${query}`);
        if (!body)
            return null;
        try {
            return JSON.parse(body).projections;
        }
        catch (e) {
            console.warn("[HttpDB] error:", e);
            return null;
        }
    }
    static async getHoloProjection(id) {
        const body = await this.get(`/api/hpbe/projections/${encodeURIComponent(id)}`);
        if (!body)
            return null;
        try {
            return JSON.parse(body).projection;
        }
        catch (e) {
            console.warn("[HttpDB] error:", e);
            return null;
        }
    }
    static async updateHoloProjection(id, settings) {
        return this.post(`/api/hpbe/projections/${encodeURIComponent(id)}`, { settings });
    }
    static async deleteHoloProjection(id) {
        return this.del(`/api/hpbe/projections/${encodeURIComponent(id)}`);
    }
    static async getHoloPackVersion() {
        const body = await this.get("/api/hpbe/pack-version");
        if (!body)
            return null;
        try {
            return JSON.parse(body).version;
        }
        catch (e) {
            console.warn("[HttpDB] error:", e);
            return null;
        }
    }
    static async getHoloMaterials(projectionId) {
        const body = await this.get(`/api/hpbe/materials/${encodeURIComponent(projectionId)}`);
        if (!body)
            return null;
        try {
            return JSON.parse(body).materials;
        }
        catch (e) {
            console.warn("[HttpDB] error:", e);
            return null;
        }
    }
}
HttpDB.available = true;
HttpDB._lastErrorLog = 0;
//# sourceMappingURL=HttpDB.js.map