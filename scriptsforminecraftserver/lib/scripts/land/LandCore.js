/* ---------------------------------------- *\
 *  土地 — 核心逻辑
\* ---------------------------------------- */
import { Database } from "./LandDatabase";
import { Money } from "../libs/Money";
// ===== 土地核心 =====
export class LandCore {
    // ── 会话管理 ──
    /**
     * @description 获取玩家会话
     * @param plid 玩家 ID
     * @returns 玩家会话或 undefined
     */
    static getSession(plid) {
        return this.sessions.get(plid);
    }
    /**
     * @description 初始化玩家会话
     * @param plid 玩家 ID
     * @returns 是否成功初始化会话资源
     */
    static initSession(plid) {
        return this.sessions.set(plid, {}) ? true : false;
    }
    /**
     * @description 设置玩家会话中土地的第一点
     * @param plid 玩家 ID
     * @param pos 第一点坐标
     * @returns 玩家会话或 undefined
     */
    static setPos1(plid, pos) {
        let s = this.getSession(plid);
        if (s) {
            s.pos1 = pos;
            this.sessions.set(plid, s);
        }
        return s;
    }
    /**
     * @description 设置玩家会话中土地的第二点
     * @param plid 玩家 ID
     * @param pos 第二点坐标
     * @returns 玩家会话或 undefined
     */
    static setPos2(plid, pos) {
        let s = this.getSession(plid);
        if (s) {
            s.pos2 = pos;
            this.sessions.set(plid, s);
        }
        return s;
    }
    /**
     * @description 释放玩家会话
     * @param plid 玩家 ID
     * @returns 是否成功释放会话资源
     */
    static clearSession(plid) {
        return this.sessions.delete(plid);
    }
    /**
     * @description 判断玩家会话中土地是否有第一点和第二点
     * @param plid 玩家 ID
     * @returns 是否有第一点和第二点坐标
     */
    static hasBothPos(plid) {
        const s = this.sessions.get(plid);
        return !!s && !!s.pos1 && !!s.pos2;
    }
    // ── 方块信息计算 ──
    /** 标准化坐标：确保 posA 是 min 角，posB 是 max 角 */
    static normalize(posA, posB) {
        return {
            posA: {
                x: Math.min(posA.x, posB.x),
                y: Math.min(posA.y, posB.y),
                z: Math.min(posA.z, posB.z),
            },
            posB: {
                x: Math.max(posA.x, posB.x),
                y: Math.max(posA.y, posB.y),
                z: Math.max(posA.z, posB.z),
            },
        };
    }
    /** 获取立方体信息 */
    static getCubeInfo(posA, posB) {
        const n = this.normalize(posA, posB);
        const w = n.posB.x - n.posA.x + 1;
        const h = n.posB.y - n.posA.y + 1;
        const l = n.posB.z - n.posA.z + 1;
        return {
            length: l,
            width: w,
            height: h,
            square: w * l,
            volume: w * h * l,
        };
    }
    /** 计算维度名 */
    static getDimensionName(dimid) {
        var _a;
        return (_a = ["主世界", "地狱", "末地"][dimid]) !== null && _a !== void 0 ? _a : "未知";
    }
    // ── 价格计算 ──
    /** 解析公式并计算价格 */
    static calculatePrice(posA, posB) {
        const cfg = Database.getConfig();
        const info = this.getCubeInfo(posA, posB);
        const formula = cfg.priceFormula;
        // 替换变量
        let expr = formula
            .replace(/\{square\}/g, String(info.square))
            .replace(/\{height\}/g, String(info.height))
            .replace(/\{length\}/g, String(info.length))
            .replace(/\{width\}/g, String(info.width))
            .replace(/\{volume\}/g, String(info.volume));
        let price;
        try {
            price = Function(`"use strict"; return (${expr});`)();
        }
        catch (_a) {
            price = info.square * 8 + info.height * 20; // fallback
        }
        price = Math.max(0, Math.floor(price * cfg.discount)); // 计算折扣
        return price;
    }
    // ── 土地查询 ──
    /** 判断某点是否在土地范围内 */
    static isPosInLand(pos, dimid, land) {
        if (land.dimid !== dimid)
            return false;
        const n = this.normalize(land.posA, land.posB);
        return (pos.x >= n.posA.x && pos.x <= n.posB.x &&
            pos.y >= n.posA.y && pos.y <= n.posB.y &&
            pos.z >= n.posA.z && pos.z <= n.posB.z);
    }
    /** 获取某位置所在的土地 */
    static getLandByPos(pos, dimid) {
        if (!pos || dimid === undefined)
            return undefined;
        return Database.getAll().find((land) => this.isPosInLand(pos, dimid, land));
    }
    /** 获取玩家拥有的所有土地 */
    static getPlayerLands(plid) {
        const ids = Database.getByOwner(plid);
        return ids.map((id) => Database.getById(id)).filter((l) => !!l);
    }
    // ── 验证 ──
    /** 验证创建条件 */
    static validateCreation(player, posA, posB, dimid) {
        const plid = player.id;
        const cfg = Database.getConfig();
        const info = this.getCubeInfo(posA, posB);
        // 1. 是否已有两个点位
        if (!posA || !posB) {
            return { ok: false, msg: "§c请先使用 !pos1 和 !pos2 命令选择土地范围。" };
        }
        // 2. 面积范围
        if (info.square < cfg.minSquare) {
            return { ok: false, msg: `§c土地面积过小！\n最小面积为 ${cfg.minSquare} 格。` };
        }
        if (info.square > cfg.maxSquare) {
            return { ok: false, msg: `§c土地面积过大！\n最大面积为 ${cfg.maxSquare} 格。` };
        }
        // 3. 重叠检查
        const allLands = Database.getAll();
        const candidates = allLands.filter((l) => l.dimid === dimid);
        for (const land of candidates) {
            if (this.cubesOverlap(this.normalize(posA, posB), { posA: land.posA, posB: land.posB })) {
                return { ok: false, msg: "§c该区域与其他土地重叠，请重新选择土地范围。" };
            }
        }
        // 4. 土地上限
        const count = Database.getPlayerLandCount(plid);
        if (count >= cfg.maxLandsPerPlayer) {
            return { ok: false, msg: `§c您已达到持有土地上限（${cfg.maxLandsPerPlayer} 块）！` };
        }
        // 5. 余额检查
        const price = this.calculatePrice(posA, posB);
        const balance = Money.get(player);
        if (balance < price) {
            return { ok: false, msg: `§c${Money.UNIT}不足！\n需要 §e${price} §c${Money.UNIT}，而当前持有 §e${balance} §c${Money.UNIT}。` };
        }
        return { ok: true };
    }
    /** 判断两个立方体是否重叠 */
    static cubesOverlap(a, b) {
        return (a.posA.x <= b.posB.x && a.posB.x >= b.posA.x &&
            a.posA.y <= b.posB.y && a.posB.y >= b.posA.y &&
            a.posA.z <= b.posB.z && a.posB.z >= b.posA.z);
    }
    // ── 创建/删除 ──
    /** 创建土地（已通过验证后调用） */
    static createLand(player, posA, posB, dimid) {
        const plid = player.id;
        const n = this.normalize(posA, posB);
        const price = this.calculatePrice(n.posA, n.posB);
        const balance = Money.get(player);
        const land = Database.createLandData(plid, player.name, dimid, n.posA, n.posB);
        Database.add(land);
        Money.set(player, balance - price);
        this.clearSession(plid);
        return land;
    }
    /** 删除土地（拥有者/管理员） */
    static deleteLand(landId, player) {
        const land = Database.getById(landId);
        if (!land)
            return false;
        if (land.ownerplid !== player.id && !land.managers.includes(player.id)) {
            return false;
        }
        const cfg = Database.getConfig();
        const price = this.calculatePrice(land.posA, land.posB);
        const refund = Math.floor(price * cfg.refundRate);
        Database.delete(landId);
        Money.add(player, refund);
        return true;
    }
    /** 检查玩家是否为土地的管理者 */
    static isManager(land, plid) {
        return land.managers.includes(plid);
    }
    /** 检查玩家是否为土地的拥有者 */
    static isOwner(land, plid) {
        return land.ownerplid === plid;
    }
    /** 检查玩家是否对该土地有完全管理权（拥有者或全局管理员） */
    static isOwnerOrManager(land, plid) {
        return this.isOwner(land, plid) || this.isManager(land, plid);
    }
    // ── 格式化显示 ──
    /** 格式化土地信息文本 */
    static formatLandInfo(posA, posB, dimid) {
        const n = this.normalize(posA, posB);
        const info = this.getCubeInfo(n.posA, n.posB);
        const price = this.calculatePrice(n.posA, n.posB);
        return [
            `[*] 土地信息：`,
            `  - §l维度: §r${this.getDimensionName(dimid)}`,
            `  - §l起点: §r(${n.posA.x}, ${n.posA.y}, ${n.posA.z})`,
            `  - §l终点: §r(${n.posB.x}, ${n.posB.y}, ${n.posB.z})`,
            `  - §l面积: §r${info.square} 格`,
            `  - §l体积: §r${info.volume} 格`,
            `  - §l价格: §r${price} ${Money.UNIT}`,
        ].join("\n");
    }
}
/** 玩家会话：plid → { pos1, pos2 } */
LandCore.sessions = new Map();
//# sourceMappingURL=LandCore.js.map