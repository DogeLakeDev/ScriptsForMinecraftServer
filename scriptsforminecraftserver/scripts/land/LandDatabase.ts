/* ---------------------------------------- *\
 *  LandDatabase.ts — 领地 client-side cache
 *
 *  本模块是 server 的 client-side 影子：
 *    - registry 仅在内存（重启即丢，预期行为，server 是权威）
 *    - 启动时通过 loadFromServer() 拉一次全量
 *    - 通过 refresh() 定期刷新
 *    - owner / chunk 索引仅用于本地查询，不写入 world.dynamicProperty
 *
\* ---------------------------------------- */

import type { LandConfig, LandData, LandMember, LandPermissions, LandPos, LandTaxConfig } from "@sfmc/types";
import { debug } from "../libs/DebugLog.js";
import { DEFAULT_TAX, defaultConfig, defaultPermissions, generateLandId } from "./defaults.js";
import {
  LAND_ROLES,
  ROLE_CAPABILITIES,
  ROLE_LABELS_CN,
  SERVER_VALID_ROLES,
  isValidRole,
  type LandCapability,
  type LandRole,
} from "./LandRoles.js";

// Re-export from LandRoles (single source of truth)
export { LAND_ROLES, ROLE_CAPABILITIES, ROLE_LABELS_CN, SERVER_VALID_ROLES, isValidRole };
export type { LandCapability, LandRole };

// 类型定义统一来自 db-server (通过 @sfmc/types/land)，避免重复与漂移。
// 本文件不再声明 LandPos / LandPermissions / LandMember / LandData / LandConfig / LandTaxConfig。
export type { LandConfig, LandData, LandMember, LandPermissions, LandPos, LandTaxConfig };

// ---------- chunks / 多边形索引 ----------

const CHUNK_SIZE = 16;

function chunkKey(dimid: number, x: number, z: number): string {
  return `${dimid}:${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`;
}

function landChunkSpan(land: LandData): Array<{ dimid: number; cx: number; cz: number }> {
  const minX = Math.floor(Math.min(land.posA.x, land.posB.x) / CHUNK_SIZE);
  const maxX = Math.floor(Math.max(land.posA.x, land.posB.x) / CHUNK_SIZE);
  const minZ = Math.floor(Math.min(land.posA.z, land.posB.z) / CHUNK_SIZE);
  const maxZ = Math.floor(Math.max(land.posA.z, land.posB.z) / CHUNK_SIZE);
  const out: Array<{ dimid: number; cx: number; cz: number }> = [];
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      out.push({ dimid: land.dimid, cx, cz });
    }
  }
  return out;
}

function isPosInBoundingBox(land: LandData, pos: LandPos): boolean {
  const minX = Math.min(land.posA.x, land.posB.x);
  const maxX = Math.max(land.posA.x, land.posB.x);
  const minY = Math.min(land.posA.y, land.posB.y);
  const maxY = Math.max(land.posA.y, land.posB.y);
  const minZ = Math.min(land.posA.z, land.posB.z);
  const maxZ = Math.max(land.posA.z, land.posB.z);
  return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY && pos.z >= minZ && pos.z <= maxZ;
}

// ---------- 配置 ----------

const CONFIG_REFRESH_MS = 5 * 60 * 1000;
let _configLastFetchedAt = 0;
let _configInFlight: Promise<void> | null = null;
let _serverConfig: LandConfig | null = null;
let _serverPermissions: LandPermissions | null = null;
let _serverTax: LandTaxConfig | null = null;

async function fetchServerConfig(): Promise<void> {
  try {
    const { HttpDB } = await import("../libs/HttpDB.js");
    // 服务端权威配置走 /api/sfmc/settings/land:* —— 通用 settings 接口
    // （避免新增专用 endpoint，settings 已是 admin 写入通道）
    const [cfgBody, permBody, taxBody] = await Promise.all([
      HttpDB.get("/api/sfmc/settings/land:config"),
      HttpDB.get("/api/sfmc/settings/land:permissions"),
      HttpDB.get("/api/sfmc/settings/land:tax"),
    ]);
    const parseValue = (body: string | null): any | null => {
      if (!body) return null;
      try {
        const parsed = JSON.parse(body);
        if (!parsed || parsed.value === null || parsed.value === undefined) return null;
        // 新版直接返回 JSON 对象（不再 JSON.stringify 再 parse）
        return typeof parsed.value === "string" ? JSON.parse(parsed.value) : parsed.value;
      } catch {
        return null;
      }
    };
    const cfg = parseValue(cfgBody);
    if (cfg) _serverConfig = cfg as LandConfig;
    const perm = parseValue(permBody);
    if (perm) _serverPermissions = perm as LandPermissions;
    const tax = parseValue(taxBody);
    if (tax) _serverTax = tax as LandTaxConfig;
  } catch (error) {
    debug.w("LANDDB", `fetchServerConfig failed: ${(error as Error).message}`);
  }
}

// ---------- Database 类 ----------

export class Database {
  /** 运行时缓存 */
  private static _registry: Map<string, LandData> | null = null;
  private static _ownerIndex: Map<string, string[]> | null = null;
  private static _chunkIndex: Map<string, Set<string>> = new Map();
  private static _loading: Promise<void> | null = null;
  private static _hasAuthoritativeSnapshot = false;

  // ── 重建索引 ──

  private static rebuildOwnerIndex(): void {
    const idx = new Map<string, string[]>();
    if (this._registry) {
      for (const land of this._registry.values()) {
        const list = idx.get(land.ownerplid) || [];
        list.push(land.id);
        idx.set(land.ownerplid, list);
      }
    }
    this._ownerIndex = idx;
  }

  private static rebuildChunkIndex(): void {
    this._chunkIndex.clear();
    if (!this._registry) return;
    for (const land of this._registry.values()) {
      for (const { dimid, cx, cz } of landChunkSpan(land)) {
        const key = chunkKey(dimid, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
        if (!this._chunkIndex.has(key)) this._chunkIndex.set(key, new Set());
        this._chunkIndex.get(key)!.add(land.id);
      }
    }
  }

  private static rebuildAll(): void {
    this.rebuildOwnerIndex();
    this.rebuildChunkIndex();
  }

  // ── 配置 ──

  static getConfig(): LandConfig {
    if (_serverConfig) return _serverConfig;
    return defaultConfig();
  }

  static replaceConfig(cfg: LandConfig): void {
    _serverConfig = cfg;
  }

  /** 新领地默认访客权限：优先 server 配置（land:permissions），否则本地兜底。 */
  static getDefaultPermissions(): LandPermissions {
    if (_serverPermissions) return _serverPermissions;
    return defaultPermissions();
  }

  /** 地皮税配置：优先 server 配置（land:tax），否则本地兜底。 */
  static getDefaultTax(): LandTaxConfig {
    if (_serverTax) return _serverTax;
    return DEFAULT_TAX;
  }

  /**
   * 5 min 内最多拉一次 server config；失败保留上次缓存/默认。
   * 仅在 Database.refresh() 调用时被动触发，避免无谓请求。
   */
  static async ensureConfigFresh(): Promise<void> {
    if (Date.now() - _configLastFetchedAt < CONFIG_REFRESH_MS) return;
    if (_configInFlight) return _configInFlight;
    _configInFlight = (async () => {
      await fetchServerConfig();
      _configLastFetchedAt = Date.now();
    })().finally(() => {
      _configInFlight = null;
    });
    return _configInFlight;
  }

  // ── 加载 ──

  static async loadFromServer(): Promise<void> {
    debug.i("LANDDB", "loadFromServer: loading lands from server");
    if (this._loading) return this._loading;
    this._loading = (async () => {
      const { getAllLands } = await import("../api/LandApi.js");
      const lands = await getAllLands();
      if (lands === null) {
        debug.w("LANDDB", "loadFromServer: getAllLands returned null, keeping local cache");
        if (!this._registry) this._registry = new Map();
        return;
      }
      this._hasAuthoritativeSnapshot = true;
      this._registry = new Map(lands.map((land) => [land.id, land]));
      this.rebuildAll();
      debug.i("LANDDB", `loadFromServer: loaded ${lands.length} lands`);
    })().finally(() => {
      this._loading = null;
    });
    return this._loading;
  }

  static hasAuthoritativeSnapshot(): boolean {
    return this._hasAuthoritativeSnapshot;
  }

  static async refresh(): Promise<void> {
    debug.i("LANDDB", "refresh: refreshing land cache");
    await Promise.all([this.loadFromServer(), this.ensureConfigFresh()]);
  }

  // ── 查询 ──

  static getAll(): LandData[] {
    this.ensureLoaded();
    if (!this._registry) return [];
    const all = Array.from(this._registry.values());
    debug.i("LANDDB", `getAll: ${all.length} lands`);
    return all;
  }

  static getAt(pos: LandPos, dimid: number): LandData | undefined {
    this.ensureLoaded();
    if (!this._registry) return undefined;
    const candidates = this._chunkIndex.get(chunkKey(dimid, pos.x, pos.z));
    if (!candidates) return undefined;
    for (const id of candidates) {
      const land = this._registry.get(id);
      if (!land) continue;
      if (isPosInBoundingBox(land, pos)) {
        debug.i("LANDDB", `getAt: found land ${land.id} at (${pos.x},${pos.y},${pos.z}) dimid=${dimid}`);
        return land;
      }
    }
    return undefined;
  }

  static getById(landId: string): LandData | undefined {
    this.ensureLoaded();
    if (!this._registry) return undefined;
    const land = this._registry.get(landId);
    debug.i("LANDDB", `getById: landId=${landId} ${land ? "found" : "not found"}`);
    return land;
  }

  static getByOwner(plid: string): string[] {
    this.ensureLoaded();
    if (!this._ownerIndex) return [];
    const list = this._ownerIndex.get(plid) || [];
    debug.i("LANDDB", `getByOwner: plid=${plid} count=${list.length}`);
    return list;
  }

  static getPlayerLandCount(plid: string): number {
    return this.getByOwner(plid).length;
  }

  // ── 写入（先走 server，再更新本地） ──

  static async add(land: LandData): Promise<void> {
    debug.i("LANDDB", `add: landId=${land.id} owner=${land.ownerplid} dimid=${land.dimid}`);
    this.ensureLoaded();
    if (!this._registry || !this._ownerIndex) return;
    this._registry.set(land.id, land);
    const owners = this._ownerIndex.get(land.ownerplid) || [];
    if (!owners.includes(land.id)) owners.push(land.id);
    this._ownerIndex.set(land.ownerplid, owners);
    for (const { dimid, cx, cz } of landChunkSpan(land)) {
      const key = chunkKey(dimid, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
      if (!this._chunkIndex.has(key)) this._chunkIndex.set(key, new Set());
      this._chunkIndex.get(key)!.add(land.id);
    }
  }

  static upsert(land: LandData): void {
    debug.i("LANDDB", `upsert: landId=${land.id} owner=${land.ownerplid} version=${land.version}`);
    this.ensureLoaded();
    if (!this._registry) return;
    const current = this._registry.get(land.id);
    if (current && (land.version || 0) < (current.version || 0)) {
      debug.w("LANDDB", `upsert: stale version, skipped landId=${land.id}`);
      return;
    }
    this._registry!.set(land.id, land);
    this.rebuildAll();
  }

  static async update(land: LandData, actorId = land.ownerplid): Promise<boolean> {
    debug.i("LANDDB", `update: landId=${land.id} actorId=${actorId} version=${land.version}`);
    const { updateLand } = await import("../api/LandApi.js");
    const updated = await updateLand(land.id, {
      nickname: land.nickname,
      permissions: land.permissions,
      actorId,
      expectedVersion: land.version,
    });
    if (!updated) {
      debug.e("LANDDB", `update: failed landId=${land.id}`);
      return false;
    }
    this.ensureLoaded();
    if (!this._registry) return false;
    const current = this._registry.get(updated.id);
    if (current && (updated.version || 0) < (current.version || 0)) return true;
    this._registry.set(updated.id, updated);
    this.rebuildAll();
    debug.i("LANDDB", `update: success landId=${land.id} newVersion=${updated.version}`);
    return true;
  }

  static async delete(
    landId: string,
    actorId: string,
    expectedVersion?: number,
    requestId?: string
  ): Promise<import("../api/LandApi.js").DeleteLandResult> {
    debug.i("LANDDB", `delete: landId=${landId} actorId=${actorId} version=${expectedVersion}`);
    const { deleteLand } = await import("../api/LandApi.js");
    const result = await deleteLand(landId, actorId, expectedVersion, requestId);
    if (!result.ok) {
      debug.e("LANDDB", `delete: failed landId=${landId} error=${result.error}`);
      return result;
    }
    if (result.balance !== undefined) {
      const { Money } = await import("../libs/Economy.js");
      const players = (await import("@minecraft/server")).world.getPlayers();
      const player = players.find((item) => item.id === actorId);
      if (player) {
        const version = (result as { balanceVersion?: number }).balanceVersion ?? 0;
        Money.setCached(player, result.balance, version);
      }
    }
    this.ensureLoaded();
    if (!this._registry || !this._ownerIndex) return result;
    const land = this._registry.get(landId);
    if (!land) return { ok: true, refund: result.refund, balance: result.balance };
    this._registry.delete(landId);
    const owners = this._ownerIndex.get(land.ownerplid);
    if (owners) {
      const idx = owners.indexOf(landId);
      if (idx !== -1) owners.splice(idx, 1);
    }
    this.rebuildChunkIndex();
    debug.i("LANDDB", `delete: success landId=${landId} refund=${result.refund}`);
    return result;
  }

  // ── 工厂 ──

  /** 客户端生成初始 LandData（创建后立即送 server，server 返回值替换缓存） */
  static createLandData(ownerplid: string, ownerName: string, dimid: number, posA: LandPos, posB: LandPos): LandData {
    return {
      id: generateLandId(),
      ownerplid,
      ownerName,
      managers: [ownerplid],
      dimid,
      posA,
      posB,
      permissions: Database.getDefaultPermissions(),
      nickname: "",
      createdAt: Date.now(),
    };
  }

  static getDefaultConfig(): LandConfig {
    return defaultConfig();
  }

  static generateId(): string {
    return generateLandId();
  }

  // ── 内部工具 ──

  private static ensureLoaded(): void {
    if (!this._registry) {
      if (this._loading) {
        return;
      }
      this._registry = new Map();
      this._ownerIndex = new Map();
    }
  }
}
