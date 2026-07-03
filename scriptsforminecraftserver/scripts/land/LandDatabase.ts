/* ---------------------------------------- *\
 *  土地插件 — 数据存储层
 *  使用 Storage 缓存 + HttpDB 持久化
\* ---------------------------------------- */

import { Vector3 } from "@minecraft/server";
import { Storage } from "../libs/Storage";

// ===== 类型定义 =====

export interface LandPos {
  x: number;
  y: number;
  z: number;
}

export interface LandPermissions {
  /** 允许访客放置方块 */
  allow_place: boolean;
  /** 允许访客破坏方块 */
  allow_destroy: boolean;
  /** 允许访客攻击实体 */
  attack_entity: boolean;
  /** 允许访客打开容器 */
  open_container: boolean;
}

export interface LandData {
  /** 土地唯一 ID（自动生成） */
  id: string;
  /** 拥有者 id */
  ownerplid: string;
  /** 拥有者玩家名（快照） */
  ownerName: string;
  /** 管理者 id 列表（拥有者自动在内，存于此方便查） */
  managers: string[];
  /** 维度 ID（0=主世界 1=地狱 2=末地） */
  dimid: number;
  /** 起点坐标 */
  posA: LandPos;
  /** 终点坐标 */
  posB: LandPos;
  /** 访客权限 */
  permissions: LandPermissions;
  /** 土地昵称 */
  nickname: string;
  /** 创建时间戳 */
  createdAt: number;
}

export interface LandConfig {
  /** 3D 价格计算公式 */
  priceFormula: string;
  /** 每玩家最大土地数 */
  maxLandsPerPlayer: number;
  /** 最小面积 */
  minSquare: number;
  /** 最大面积 */
  maxSquare: number;
  /** 折扣率 (0~1) */
  discount: number;
  /** 删除退款率 (0~1) */
  refundRate: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: LandConfig = {
  priceFormula: "{square}*8+{height}*20",
  maxLandsPerPlayer: 5,
  minSquare: 4,
  maxSquare: 50000,
  discount: 1,
  refundRate: 0.7,
};

/** 默认访客权限（全部关闭） */
const DEFAULT_PERMISSIONS: LandPermissions = {
  allow_place: false,
  allow_destroy: false,
  attack_entity: false,
  open_container: false,
};

// ===== 数据库类 =====

export class Database {
  private static KEY_CONFIG = "land:config";
  private static KEY_REGISTRY = "land:registry";

  /** 运行时缓存 */
  private static _config: LandConfig | null = null;
  private static _registry: Map<string, LandData> | null = null; // landId → LandData
  private static _ownerIndex: Map<string, string[]> | null = null; // plid → landId[]

  // ── 内部工具 ──

  private static readJSON<T>(key: string, fallback: T): T {
    return Storage.get<T>(key, fallback);
  }

  private static writeJSON(key: string, value: any) {
    Storage.set(key, value);
  }

  /** 重建 owner 索引 */
  private static rebuildOwnerIndex() {
    this._ownerIndex = new Map();
    if (!this._registry) return;
    for (const [, land] of this._registry) {
      const list = this._ownerIndex.get(land.ownerplid) || [];
      list.push(land.id);
      this._ownerIndex.set(land.ownerplid, list);
    }
  }

  // ── 配置 ──

  static getConfig(): LandConfig {
    if (this._config) return this._config;
    this._config = this.readJSON<LandConfig>(this.KEY_CONFIG, { ...DEFAULT_CONFIG });
    return this._config;
  }

  static saveConfig(cfg: LandConfig) {
    this._config = cfg;
    this.writeJSON(this.KEY_CONFIG, cfg);
  }

  // ── 土地数据 ──

  /** 确保 registry 已加载 */
  private static ensureLoaded() {
    if (this._registry) return;
    const raw = this.readJSON<Record<string, LandData>>(this.KEY_REGISTRY, {});
    this._registry = new Map(Object.entries(raw));
    this.rebuildOwnerIndex();
  }

  /** 将 registry 序列化写入数据库中 */
  private static flush() {
    if (!this._registry) return;
    const obj: Record<string, LandData> = {};
    for (const [id, data] of this._registry) {
      obj[id] = data;
    }
    this.writeJSON(this.KEY_REGISTRY, obj);
  }

  /** 获取所有土地 */
  static getAll(): LandData[] {
    this.ensureLoaded();
    return Array.from(this._registry!.values());
  }

  /** 根据 ID 获取土地 */
  static getById(landId: string): LandData | undefined {
    this.ensureLoaded();
    return this._registry!.get(landId);
  }

  /** 获取玩家所有土地 ID */
  static getByOwner(plid: string): string[] {
    this.ensureLoaded();
    return this._ownerIndex!.get(plid) || [];
  }

  /** 生成唯一土地 ID */
  static generateId(): string {
    return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  /** 添加土地 */
  static add(land: LandData) {
    this.ensureLoaded();
    this._registry!.set(land.id, land);
    // 更新 owner 索引
    const list = this._ownerIndex!.get(land.ownerplid) || [];
    list.push(land.id);
    this._ownerIndex!.set(land.ownerplid, list);
    this.flush();
  }

  /** 更新土地 */
  static update(land: LandData) {
    this.ensureLoaded();
    this._registry!.set(land.id, land);
    this.flush();
  }

  /** 删除土地 */
  static delete(landId: string) {
    this.ensureLoaded();
    const land = this._registry!.get(landId);
    if (!land) return;
    this._registry!.delete(landId);
    // 更新 owner 索引
    const list = this._ownerIndex!.get(land.ownerplid) || [];
    const idx = list.indexOf(landId);
    if (idx !== -1) list.splice(idx, 1);
    this._ownerIndex!.set(land.ownerplid, list);
    this.flush();
  }

  /** 获取玩家的土地数量 */
  static getPlayerLandCount(plid: string): number {
    return this.getByOwner(plid).length;
  }

  // ── 辅助工具 ──

  /** 创建新的土地数据对象（不含 id 和创建时间） */
  static createLandData(
    ownerplid: string,
    ownerName: string,
    dimid: number,
    posA: LandPos,
    posB: LandPos,
  ): LandData {
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
  static getDefaultPermissions(): LandPermissions {
    return { ...DEFAULT_PERMISSIONS };
  }

  /** 默认配置对象 */
  static getDefaultConfig(): LandConfig {
    return { ...DEFAULT_CONFIG };
  }
}
