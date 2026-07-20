/* ---------------------------------------- *\
 *  土地 — 核心逻辑
\* ---------------------------------------- */

import { Player } from "@minecraft/server";
import type { DeleteLandResult } from "@sfmc/sdk/contracts";
import { LandApi } from "@sfmc/module-land-gui";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { Database, LandData, LandPos } from "./LandDatabase.js";

// ===== 类型定义 =====

export interface CubeInfo {
  length: number;
  width: number;
  height: number;
  square: number;
  volume: number;
}

export interface PlayerSession {
  pos1?: LandPos;
  pos2?: LandPos;
  dimensionId?: number;
  updatedAt: number;
}

export interface ValidationResult {
  ok: boolean;
  msg?: string;
}

// ===== 土地核心 =====

export class LandCore {
  /** 玩家会话：plid → { pos1, pos2 } */
  private static sessions = new Map<string, PlayerSession>();

  // ── 会话管理 ──
  /**
   * @description 获取玩家会话
   * @param plid 玩家 ID
   * @returns 玩家会话或 undefined
   */
  static getSession(plid: string): PlayerSession | undefined {
    debug.i("LAND", `getSession: plid=${plid}`);
    return this.sessions.get(plid);
  }

  /**
   * @description 初始化玩家会话
   * @param plid 玩家 ID
   * @returns 是否成功初始化会话资源
   */
  static initSession(plid: string): boolean {
    debug.i("LAND", `initSession: plid=${plid}`);
    this.sessions.set(plid, { updatedAt: Date.now() });
    return true;
  }

  /**
   * @description 设置玩家会话中土地的第一点
   * @param plid 玩家 ID
   * @param pos 第一点坐标
   * @returns 玩家会话或 undefined
   */
  static setPos1(plid: string, pos: LandPos): PlayerSession | undefined {
    debug.i("LAND", `setPos1: plid=${plid} pos=(${pos.x},${pos.y},${pos.z})`);
    let s = this.getSession(plid);
    if (s) {
      s.pos1 = pos;
      s.updatedAt = Date.now();
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
  static setPos2(plid: string, pos: LandPos): PlayerSession | undefined {
    debug.i("LAND", `setPos2: plid=${plid} pos=(${pos.x},${pos.y},${pos.z})`);
    let s = this.getSession(plid);
    if (s) {
      s.pos2 = pos;
      s.updatedAt = Date.now();
      this.sessions.set(plid, s);
    }
    return s;
  }

  /**
   * @description 释放玩家会话
   * @param plid 玩家 ID
   * @returns 是否成功释放会话资源
   */
  static clearSession(plid: string): boolean {
    const result = this.sessions.delete(plid);
    debug.i("LAND", `clearSession: plid=${plid} result=${result}`);
    return result;
  }

  /**
   * @description 判断玩家会话中土地是否有第一点和第二点
   * @param plid 玩家 ID
   * @returns 是否有第一点和第二点坐标
   */
  static hasBothPos(plid: string): boolean {
    const s = this.sessions.get(plid);
    return !!s && !!s.pos1 && !!s.pos2;
  }

  static setDimension(plid: string, dimensionId: number): PlayerSession | undefined {
    debug.i("LAND", `setDimension: plid=${plid} dimid=${dimensionId}`);
    const session = this.getSession(plid);
    if (!session) return undefined;
    session.dimensionId = dimensionId;
    session.updatedAt = Date.now();
    return session;
  }

  static clearExpiredSessions(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    let count = 0;
    for (const [id, session] of this.sessions)
      if (now - session.updatedAt > maxAgeMs) {
        this.sessions.delete(id);
        count++;
      }
    if (count > 0) debug.i("LAND", `clearExpiredSessions: cleared ${count} sessions`);
  }

  // ── 方块信息计算 ──

  /** 标准化坐标：确保 posA 是 min 角，posB 是 max 角 */
  static normalize(posA: LandPos, posB: LandPos): { posA: LandPos; posB: LandPos } {
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
  static getCubeInfo(posA: LandPos, posB: LandPos): CubeInfo {
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
  static getDimensionName(dimid: number): string {
    return ["主世界", "地狱", "末地"][dimid] ?? "未知";
  }

  // ── 价格计算 ──

  /** 解析公式并计算价格 */
  static calculatePrice(posA: LandPos, posB: LandPos): number {
    const cfg = Database.getConfig();
    const info = this.getCubeInfo(posA, posB);
    // The server is authoritative for the final price. This local value is only a UI preview.
    return Math.max(0, Math.floor((info.square * 8 + info.height * 20) * cfg.discount));
  }

  // ── 土地查询 ──

  /** 判断某点是否在土地范围内 */
  static isPosInLand(pos: LandPos, dimid: number, land: LandData): boolean {
    if (land.dimid !== dimid) return false;
    const n = this.normalize(land.posA, land.posB);
    return (
      pos.x >= n.posA.x &&
      pos.x <= n.posB.x &&
      pos.y >= n.posA.y &&
      pos.y <= n.posB.y &&
      pos.z >= n.posA.z &&
      pos.z <= n.posB.z
    );
  }

  /** 获取某位置所在的土地 */
  static getLandByPos(pos: LandPos, dimid: number): LandData | undefined {
    if (!pos || dimid === undefined) return undefined;
    debug.i("LAND", `getLandByPos: pos=(${pos.x},${pos.y},${pos.z}) dimid=${dimid}`);
    return Database.getAt(pos, dimid);
  }

  /** 获取玩家拥有的所有土地 */
  static getPlayerLands(plid: string): LandData[] {
    const ids = Database.getByOwner(plid);
    debug.i("LAND", `getPlayerLands: plid=${plid} count=${ids.length}`);
    return ids.map((id) => Database.getById(id)).filter((l): l is LandData => !!l);
  }

  // ── 验证 ──

  /** 验证创建条件 */
  static async validateCreation(
    player: Player,
    posA: LandPos,
    posB: LandPos,
    dimid: number
  ): Promise<ValidationResult> {
    debug.i(
      "LAND",
      `validateCreation: player=${player.name} posA=(${posA.x},${posA.y},${posA.z}) posB=(${posB.x},${posB.y},${posB.z}) dimid=${dimid}`
    );
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

    const remote = await LandApi.validateLand({ ownerId: plid, ownerName: player.name, dimid, posA, posB });
    if (!remote.ok) {
      const messages: Record<string, string> = {
        overlap: "§c该区域与其他土地重叠，请重新选择土地范围。",
        land_limit: `§c您已达到持有土地上限（${cfg.maxLandsPerPlayer} 块）！`,
        area_out_of_range: "§c土地面积不符合限制。",
      };
      return { ok: false, msg: messages[remote.error || ""] || `§c${remote.error || "土地验证失败"}` };
    }

    // 余额检查
    const price = this.calculatePrice(posA, posB);
    const balance = await Money.load(player);
    if (balance < price) {
      return {
        ok: false,
        msg: `§c${Money.UNIT}不足！\n需要 §e${price} §c${Money.UNIT}，而当前持有 §e${balance} §c${Money.UNIT}。`,
      };
    }

    return { ok: true };
  }

  /** 判断两个立方体是否重叠 */
  static cubesOverlap(a: { posA: LandPos; posB: LandPos }, b: { posA: LandPos; posB: LandPos }): boolean {
    return (
      a.posA.x <= b.posB.x &&
      a.posB.x >= b.posA.x &&
      a.posA.y <= b.posB.y &&
      a.posB.y >= b.posA.y &&
      a.posA.z <= b.posB.z &&
      a.posB.z >= b.posA.z
    );
  }

  // ── 创建/删除 ──

  /** 创建土地（已通过验证后调用） */
  static async createLand(player: Player, posA: LandPos, posB: LandPos, dimid: number): Promise<LandData | null> {
    debug.i(
      "LAND",
      `createLand: player=${player.name} posA=(${posA.x},${posA.y},${posA.z}) posB=(${posB.x},${posB.y},${posB.z}) dimid=${dimid}`
    );
    const plid = player.id;
    const n = this.normalize(posA, posB);
    const price = this.calculatePrice(n.posA, n.posB);
    const requestId = `land-create:${plid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const result = await LandApi.createLand({
      ownerId: plid,
      ownerName: player.name,
      dimid,
      posA: n.posA,
      posB: n.posB,
      requestId,
    });
    if (!result.land) throw new Error(result.message || formatCreateError(result.error));
    const land = result.land;
    Database.add(land);
    if (result.balance !== undefined) Money.setCached(player, result.balance, result.balanceVersion || 0);
    else await Money.load(player);
    this.clearSession(plid);
    debug.i("LAND", `createLand success: landId=${land.id} price=${price}`);
    return land;
  }

  /** 删除土地（拥有者/管理员） */
  static async deleteLand(landId: string, player: Player, requestId?: string): Promise<DeleteLandResult> {
    debug.i("LAND", `deleteLand: landId=${landId} player=${player.name}`);
    const land = Database.getById(landId);
    if (!land) return { ok: false, error: "not_found", message: "土地不存在或缓存已更新。" };
    if (land.ownerplid !== player.id) {
      return { ok: false, error: "forbidden", message: "只有土地所有者可以删除土地。" };
    }
    return Database.delete(landId, player.id, land.version, requestId);
  }

  /** 检查玩家是否为土地的管理者 */
  static isManager(land: LandData, plid: string): boolean {
    const result = land.managers.includes(plid);
    debug.i("LAND", `isManager: landId=${land.id} plid=${plid} result=${result}`);
    return result;
  }

  /** 检查玩家是否为土地的拥有者 */
  static isOwner(land: LandData, plid: string): boolean {
    const result = land.ownerplid === plid;
    debug.i("LAND", `isOwner: landId=${land.id} plid=${plid} result=${result}`);
    return result;
  }

  /** 检查玩家是否对该土地有完全管理权（拥有者或全局管理员） */
  static isOwnerOrManager(land: LandData, plid: string): boolean {
    const result = this.isOwner(land, plid) || this.isManager(land, plid);
    debug.i("LAND", `isOwnerOrManager: landId=${land.id} plid=${plid} result=${result}`);
    return result;
  }

  // ── 格式化显示 ──

  /** 格式化土地信息文本 */
  static formatLandInfo(posA: LandPos, posB: LandPos, dimid: number): string {
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

function formatCreateError(error?: string): string {
  const messages: Record<string, string> = {
    insufficient_funds: "节操不足，无法购买这块土地。",
    land_limit: "你已达到土地数量上限。",
    overlap: "该区域与其他土地重叠。",
    area_out_of_range: "土地面积不符合限制。",
    unauthorized: "数据库服务拒绝了本次操作。",
  };
  return messages[error || ""] || `土地创建失败：${error || "数据库服务无响应"}`;
}
