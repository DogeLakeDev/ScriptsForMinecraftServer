/* ---------------------------------------- *\
 *  土地 — API 导出
\* ---------------------------------------- */
import { Database } from "./LandDatabase";
/**
 * 土地 API 静态类
 * 后续对接 CoopCore 时调用这些方法
 */
export class LandAPI {
    /** 获取玩家拥有的所有土地 ID */
    static getPlayerLands(plid) {
        return Database.getByOwner(plid);
    }
    /** 获取土地范围 */
    static getLandRange(landId) {
        const land = Database.getById(landId);
        if (!land)
            return null;
        return { posA: land.posA, posB: land.posB, dimid: land.dimid };
    }
    /** 获取土地拥有者 plid */
    static getLandOwner(landId) {
        const land = Database.getById(landId);
        return land?.ownerplid ?? null;
    }
    /** 获取土地名称（昵称） */
    static getLandName(landId) {
        const land = Database.getById(landId);
        return land?.nickname || landId;
    }
    /** 获取土地描述 */
    static getLandDescribe(landId) {
        const land = Database.getById(landId);
        return land?.nickname || "";
    }
    /** 添加信任（将玩家添加为管理者） */
    static addTrust(landId, plid) {
        const land = Database.getById(landId);
        if (!land)
            return false;
        if (land.managers.includes(plid))
            return false;
        land.managers.push(plid);
        Database.update(land);
        return true;
    }
    /** 移除信任 */
    static removeTrust(landId, plid) {
        const land = Database.getById(landId);
        if (!land)
            return false;
        const idx = land.managers.indexOf(plid);
        if (idx === -1)
            return false;
        land.managers.splice(idx, 1);
        Database.update(land);
        return true;
    }
    /** 传送玩家到土地（后续实现） */
    static teleport(plid, landId) {
        // TODO: 传送功能后续实现
        return false;
    }
    /** 更新土地设置 */
    static updateSetting(landId, key, value) {
        const land = Database.getById(landId);
        if (!land)
            return false;
        if (key in land.permissions) {
            land.permissions[key] = value;
            Database.update(land);
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=LandAPI.js.map