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
  use_door?: boolean;
  use_button?: boolean;
  use_redstone?: boolean;
  interact_entity?: boolean;
  pickup_item?: boolean;
}

export type LandRole = "owner" | "admin" | "builder" | "container" | "visitor" | "redstone" | "entity";

export const ROLE_PERMISSIONS: Record<LandRole, string[]> = {
  owner: ["place", "break", "container", "door", "button", "redstone", "attack_entity", "interact_entity", "pickup_item", "manage_members", "manage_permissions", "rename", "transfer", "delete"],
  admin: ["place", "break", "container", "door", "button", "redstone", "attack_entity", "interact_entity", "pickup_item", "manage_members", "manage_permissions", "rename"],
  builder: ["place", "break"], container: ["container"], visitor: [], redstone: ["redstone", "button", "door"], entity: ["attack_entity", "interact_entity"],
};

export interface LandData {
  /** 土地唯一 ID（自动生成） */
  id: string;
  /** 拥有者 id */
  ownerplid: string;
  /** 拥有者玩家名（快照） */
  ownerName: string;
  /** 管理者 id 列表（拥有者自动在内，存于此方便查） */
  managers: string[];
  members?: Array<{ player_id: string; player_name_snapshot?: string; role: LandRole; expires_at?: number | null }>;
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
  version?: number;
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
  private static _loading: Promise<void> | null = null;
  private static _chunkIndex = new Map<string, Set<string>>();

  // ── 内部工具 ──

  private static memoryStore = new Map<string, any>();

  private static readJSON<T>(key: string, fallback: T): T {
    if (this.memoryStore.has(key)) return this.memoryStore.get(key) as T;
    this.memoryStore.set(key, fallback);
    return fallback;
  }

  private static writeJSON(key: string, value: any) {
    this.memoryStore.set(key, value);
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
    this.rebuildChunkIndex();
  }

  private static chunkKey(dimid: number, x: number, z: number): string {
    return `${dimid}:${Math.floor(x / 16)}:${Math.floor(z / 16)}`;
  }

  private static rebuildChunkIndex() {
    this._chunkIndex.clear();
    if (!this._registry) return;
    for (const land of this._registry.values()) {
      const minX = Math.floor(Math.min(land.posA.x, land.posB.x) / 16);
      const maxX = Math.floor(Math.max(land.posA.x, land.posB.x) / 16);
      const minZ = Math.floor(Math.min(land.posA.z, land.posB.z) / 16);
      const maxZ = Math.floor(Math.max(land.posA.z, land.posB.z) / 16);
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        const key = `${land.dimid}:${x}:${z}`;
        if (!this._chunkIndex.has(key)) this._chunkIndex.set(key, new Set());
        this._chunkIndex.get(key)!.add(land.id);
      }
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

  static getAt(pos: LandPos, dimid: number): LandData | undefined {
    this.ensureLoaded();
    const candidates = this._chunkIndex.get(this.chunkKey(dimid, pos.x, pos.z));
    if (!candidates) return undefined;
    for (const id of candidates) {
      const land = this._registry!.get(id);
      if (!land) continue;
      const minX = Math.min(land.posA.x, land.posB.x), maxX = Math.max(land.posA.x, land.posB.x);
      const minY = Math.min(land.posA.y, land.posB.y), maxY = Math.max(land.posA.y, land.posB.y);
      const minZ = Math.min(land.posA.z, land.posB.z), maxZ = Math.max(land.posA.z, land.posB.z);
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY && pos.z >= minZ && pos.z <= maxZ) return land;
    }
    return undefined;
  }

  static async loadFromServer(): Promise<void> {
    if (this._loading) return this._loading;
    this._loading = import("../api/LandApi").then(async ({ getAllLands }) => {
      const lands = await getAllLands();
      this._registry = new Map(lands.map((land) => [land.id, land]));
      this.rebuildOwnerIndex();
    }).finally(() => { this._loading = null; });
    return this._loading;
  }

  static async refresh(): Promise<void> {
    this._registry = null;
    this._ownerIndex = null;
    await this.loadFromServer();
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
    this.rebuildChunkIndex();
    this.flush();
  }

  /** 更新土地 */
  static async update(land: LandData, actorId = land.ownerplid): Promise<boolean> {
    const { updateLand } = await import("../api/LandApi");
    const updated = await updateLand(land.id, { nickname: land.nickname, permissions: land.permissions, managers: land.managers, actorId });
    if (!updated) return false;
    this.ensureLoaded();
    const current = this._registry!.get(updated.id);
    if (current && (updated.version || 0) < (current.version || 0)) return true;
    this._registry!.set(updated.id, updated);
    this.rebuildOwnerIndex();
    return true;
  }

  /** 删除土地 */
  static async delete(landId: string, actorId: string): Promise<number | false> {
    const { deleteLand } = await import("../api/LandApi");
    const result = await deleteLand(landId, actorId);
    if (!result.ok) return false;
    this.ensureLoaded();
    const land = this._registry!.get(landId);
    if (!land) return false;
    this._registry!.delete(landId);
    // 更新 owner 索引
    const list = this._ownerIndex!.get(land.ownerplid) || [];
    const idx = list.indexOf(landId);
    if (idx !== -1) list.splice(idx, 1);
    this._ownerIndex!.set(land.ownerplid, list);
    this.rebuildChunkIndex();
    return result.refund ?? 0;
  }

  /** 获取玩家的土地数量 */
  static getPlayerLandCount(plid: string): number {
    return this.getByOwner(plid).length;
  }

  // ── 辅助工具 ──

  /** 创建新的土地数据对象（不含 id 和创建时间） */
  static createLandData(ownerplid: string, ownerName: string, dimid: number, posA: LandPos, posB: LandPos): LandData {
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
