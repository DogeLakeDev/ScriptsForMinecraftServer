/**
 * HttpDB — SAPI 端数据库 HTTP 客户端
 *
 * 通过 @minecraft/server-net 的 HTTP 客户端连接本地 Node.js SQLite 服务。
 *
 * manifest.json 需添加：
 *   { "module_name": "@minecraft/server-net", "version": "1.0.0-beta" }
 */
import { http, HttpRequest } from "@minecraft/server-net";
import { Config } from "../data/Config";
const BASE_URL = `http://${Config.dbHost}:${Config.dbPort}`;
const TIMEOUT = 3; // HTTP 请求超时（秒）
export class HttpDB {
    static isAvailable() {
        return this.available;
    }
    static checkHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield http.get(`${BASE_URL}/api/health`);
                this.available = res.status === 200;
                if (this.available) {
                    console.info(`[HttpDB] 数据库服务连接成功 (${BASE_URL}/api/health)`);
                }
                else {
                    console.error(`[HttpDB] 数据库服务返回异常状态 ${res.status}`);
                }
            }
            catch (err) {
                this.available = false;
                console.error(`[HttpDB] 连接失败 (${BASE_URL}): ${err}`);
            }
            return this.available;
        });
    }
    // ---- 通用 HTTP 方法 ----
    static get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield http.get(`${BASE_URL}${path}`);
                return res.status === 200 ? res.body : null;
            }
            catch (_a) {
                this.available = false;
                return null;
            }
        });
    }
    static post(path, bodyData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const req = new HttpRequest(`${BASE_URL}${path}`);
                req.timeout = TIMEOUT;
                req.method = "Post"; // POST
                req.body = JSON.stringify(bodyData);
                req.addHeader("Content-Type", "application/json");
                const res = yield http.request(req);
                if (res.status !== 200) {
                    console.warn(`[HttpDB] POST ${path} 返回 ${res.status}: ${res.body}`);
                }
                return res.status === 200;
            }
            catch (err) {
                this.available = false;
                console.warn(`[HttpDB] POST ${path} 失败: ${err}`);
                return false;
            }
        });
    }
    static del(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const req = new HttpRequest(`${BASE_URL}${path}`);
                req.timeout = TIMEOUT;
                req.method = "Delete"; // DELETE
                const res = yield http.request(req);
                return res.status === 200;
            }
            catch (_a) {
                return false;
            }
        });
    }
    // ---- 消息历史 ----
    static saveMessage(channelId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/messages/save", { channelId, message });
        });
    }
    static loadHistory(channelId, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield this.get(`/api/messages/${encodeURIComponent(channelId)}?cutoff=${cutoff}`);
            if (!body)
                return null;
            try {
                return JSON.parse(body).messages;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static deleteChannelMessages(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.del(`/api/messages/${encodeURIComponent(channelId)}`);
        });
    }
    static cleanupExpired(channels) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/messages/cleanup", { channels });
        });
    }
    // ---- 红包 ----
    static saveRedPacket(redpacket) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/redpackets/save", { redpacket });
        });
    }
    static updateRedPacket(redpacket) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/redpackets/update", { redpacket });
        });
    }
    static getRedPackets() {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield this.get("/api/redpackets");
            if (!body)
                return null;
            try {
                return JSON.parse(body).redpackets;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static getRedPacket(packetId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const body = yield this.get(`/api/redpackets/${encodeURIComponent(packetId)}`);
            if (!body)
                return null;
            try {
                return (_a = JSON.parse(body).redpacket) !== null && _a !== void 0 ? _a : null;
            }
            catch (_b) {
                return null;
            }
        });
    }
    static cleanupExpiredRedPackets() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/cleanup-expired-rp", {});
        });
    }
    // ---- 计分板同步 ----
    static syncScoreboards(entries) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/sfmc/scoreboards/sync", { entries });
        });
    }
    static loadScoreboards(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = new URLSearchParams();
            if (filter === null || filter === void 0 ? void 0 : filter.objective)
                params.set('objective', filter.objective);
            if (filter === null || filter === void 0 ? void 0 : filter.name)
                params.set('name', filter.name);
            if (filter === null || filter === void 0 ? void 0 : filter.id)
                params.set('id', filter.id);
            const qs = params.toString();
            const body = yield this.get(`/api/sfmc/scoreboards${qs ? '?' + qs : ''}`);
            if (!body)
                return null;
            try {
                return JSON.parse(body).entries;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static getScoreboardObjectives() {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield this.get("/api/sfmc/scoreboards/objectives");
            if (!body)
                return null;
            try {
                return JSON.parse(body).objectives;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static clearScoreboards() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.del("/api/sfmc/scoreboards");
        });
    }
    // ---- 行为日志 ----
    static batchActivities(entries) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/sfmc/activities/batch", { entries });
        });
    }
    static queryActivities(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = new URLSearchParams();
            if (filter === null || filter === void 0 ? void 0 : filter.id)
                params.set('id', filter.id);
            if (filter === null || filter === void 0 ? void 0 : filter.event)
                params.set('event', filter.event);
            if (filter === null || filter === void 0 ? void 0 : filter.from)
                params.set('from', String(filter.from));
            if (filter === null || filter === void 0 ? void 0 : filter.to)
                params.set('to', String(filter.to));
            if (filter === null || filter === void 0 ? void 0 : filter.name)
                params.set('name', filter.name);
            if (filter === null || filter === void 0 ? void 0 : filter.limit)
                params.set('limit', String(filter.limit));
            if (filter === null || filter === void 0 ? void 0 : filter.offset)
                params.set('offset', String(filter.offset));
            const qs = params.toString();
            const body = yield this.get(`/api/sfmc/activities${qs ? '?' + qs : ''}`);
            if (!body)
                return null;
            try {
                return JSON.parse(body).entries;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static getActivityStats(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = new URLSearchParams();
            if (filter === null || filter === void 0 ? void 0 : filter.id)
                params.set('id', filter.id);
            if (filter === null || filter === void 0 ? void 0 : filter.from)
                params.set('from', String(filter.from));
            if (filter === null || filter === void 0 ? void 0 : filter.to)
                params.set('to', String(filter.to));
            const qs = params.toString();
            const body = yield this.get(`/api/sfmc/activities/stats${qs ? '?' + qs : ''}`);
            if (!body)
                return null;
            try {
                return JSON.parse(body);
            }
            catch (_a) {
                return null;
            }
        });
    }
    static cleanupActivities() {
        return __awaiter(this, arguments, void 0, function* (keepDays = 30, keepAdmin = true) {
            return this.post("/api/sfmc/activities/cleanup", { keepDays, keepAdmin });
        });
    }
    // ---- 通用 KV 存储 ----
    /** 获取全部 KV 键值对（启动加载用） */
    static getAllKV() {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield this.get("/api/kv");
            if (!body)
                return null;
            try {
                return JSON.parse(body).kv;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static getKV(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield this.get(`/api/kv/${encodeURIComponent(key)}`);
            if (!body)
                return null;
            try {
                return JSON.parse(body).value;
            }
            catch (_a) {
                return null;
            }
        });
    }
    static setKV(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post("/api/kv/save", { key, value });
        });
    }
    static deleteKV(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.del(`/api/kv/${encodeURIComponent(key)}`);
        });
    }
}
HttpDB.available = true;
//# sourceMappingURL=HttpDB.js.map