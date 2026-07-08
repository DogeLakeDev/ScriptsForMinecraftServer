/* ---------------------------------------- *\
 *  土地插件 — 数据存储层
 *  使用 Storage 缓存 + HttpDB 持久化
\* ---------------------------------------- */
/** 默认配置 */
const DEFAULT_CONFIG = {
    priceFormula: "{square}*8+{height}*20",
    maxLandsPerPlayer: 5,
    minSquare: 4,
    maxSquare: 50000,
    discount: 1,
    refundRate: 0.7,
};
/** 默认访客权限（全部关闭） */
const DEFAULT_PERMISSIONS = {
    allow_place: false,
    allow_destroy: false,
    attack_entity: false,
    open_container: false,
};
// ===== 数据库类 =====
export class Database {
    static readJSON(key, fallback) {
        if (this.memoryStore.has(key))
            return this.memoryStore.get(key);
        this.memoryStore.set(key, fallback);
        return fallback;
    }
    static writeJSON(key, value) {
        this.memoryStore.set(key, value);
    }
    /** 重建 owner 索引 */
    static rebuildOwnerIndex() {
        this._ownerIndex = new Map();
        if (!this._registry)
            return;
        for (const [, land] of this._registry) {
            const list = this._ownerIndex.get(land.ownerplid) || [];
            list.push(land.id);
            this._ownerIndex.set(land.ownerplid, list);
        }
    }
    // ── 配置 ──
    static getConfig() {
        if (this._config)
            return this._config;
        this._config = this.readJSON(this.KEY_CONFIG, { ...DEFAULT_CONFIG });
        return this._config;
    }
    static saveConfig(cfg) {
        this._config = cfg;
        this.writeJSON(this.KEY_CONFIG, cfg);
    }
    // ── 土地数据 ──
    /** 确保 registry 已加载 */
    static ensureLoaded() {
        if (this._registry)
            return;
        const raw = this.readJSON(this.KEY_REGISTRY, {});
        this._registry = new Map(Object.entries(raw));
        this.rebuildOwnerIndex();
    }
    /** 将 registry 序列化写入数据库中 */
    static flush() {
        if (!this._registry)
            return;
        const obj = {};
        for (const [id, data] of this._registry) {
            obj[id] = data;
        }
        this.writeJSON(this.KEY_REGISTRY, obj);
    }
    /** 获取所有土地 */
    static getAll() {
        this.ensureLoaded();
        return Array.from(this._registry.values());
    }
    /** 根据 ID 获取土地 */
    static getById(landId) {
        this.ensureLoaded();
        return this._registry.get(landId);
    }
    /** 获取玩家所有土地 ID */
    static getByOwner(plid) {
        this.ensureLoaded();
        return this._ownerIndex.get(plid) || [];
    }
    /** 生成唯一土地 ID */
    static generateId() {
        return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    }
    /** 添加土地 */
    static add(land) {
        this.ensureLoaded();
        this._registry.set(land.id, land);
        // 更新 owner 索引
        const list = this._ownerIndex.get(land.ownerplid) || [];
        list.push(land.id);
        this._ownerIndex.set(land.ownerplid, list);
        this.flush();
    }
    /** 更新土地 */
    static update(land) {
        this.ensureLoaded();
        this._registry.set(land.id, land);
        this.flush();
    }
    /** 删除土地 */
    static delete(landId) {
        this.ensureLoaded();
        const land = this._registry.get(landId);
        if (!land)
            return;
        this._registry.delete(landId);
        // 更新 owner 索引
        const list = this._ownerIndex.get(land.ownerplid) || [];
        const idx = list.indexOf(landId);
        if (idx !== -1)
            list.splice(idx, 1);
        this._ownerIndex.set(land.ownerplid, list);
        this.flush();
    }
    /** 获取玩家的土地数量 */
    static getPlayerLandCount(plid) {
        return this.getByOwner(plid).length;
    }
    // ── 辅助工具 ──
    /** 创建新的土地数据对象（不含 id 和创建时间） */
    static createLandData(ownerplid, ownerName, dimid, posA, posB) {
        return {
            id: this.generateId(),
            ownerplid,
            ownerName,
            managers: [ownerplid],
            dimid,
            posA,
            posB,
            permissions: { ...DEFAULT_PERMISSIONS },
            nickname: "",
            createdAt: Date.now(),
        };
    }
    /** 默认权限对象 */
    static getDefaultPermissions() {
        return { ...DEFAULT_PERMISSIONS };
    }
    /** 默认配置对象 */
    static getDefaultConfig() {
        return { ...DEFAULT_CONFIG };
    }
}
Database.KEY_CONFIG = "land:config";
Database.KEY_REGISTRY = "land:registry";
/** 运行时缓存 */
Database._config = null;
Database._registry = null; // landId → LandData
Database._ownerIndex = null; // plid → landId[]
// ── 内部工具 ──
Database.memoryStore = new Map();
//# sourceMappingURL=LandDatabase.js.map