/**
 * domain/player-lands.ts — 领地只读查询（玩家「我的领地」与地图页）
 *
 * 使用场景：
 *   - 玩家页：按 openid 绑定的 xuid 列出名下与作为成员的领地（续费时间、欠费金额，不计算常规续费价格）；
 *   - 地图页：列出全部领地的区块与子区域几何，供小程序画布绘制（替代原先 bluemap 推送的快照，保证实时）。
 * 表不存在（领地模块未安装）时返回空列表。
 */
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

/** 玩家视角的一块领地摘要 */
export interface PlayerLandSummary {
  id: string;
  name: string;
  /** active / delinquent / frozen */
  status: string;
  level: number;
  /** 已占领区块数 */
  chunks: number;
  /** 下次续费时间（毫秒时间戳）；0 表示未知 */
  nextUpkeepAt: number;
  /** 当前欠费金额；正常时为 0 */
  upkeepDue: number;
  ownerName: string;
  /** owner 或成员关系名（admin / member / trusted / …） */
  relation: string;
}

/** 地图用子区域（水平投影，坐标含两端方块） */
export interface MapLandAreaView {
  id: string;
  name: string;
  dimensionId: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** 地图用领地（与 mp-gateway MapLand 同形，不含领主玩家 id） */
export interface MapLandView {
  id: string;
  name: string;
  ownerName: string;
  status: string;
  level: number;
  claims: Array<{ dimensionId: string; chunks: Array<[number, number]> }>;
  areas: MapLandAreaView[];
}

type LandRow = {
  id?: string;
  name?: string;
  owner_id?: string;
  owner_name?: string;
  status?: string;
  level?: number;
  next_upkeep_at?: number;
  upkeep_due?: number;
};

type ClaimRow = { land_id?: string; dimension_id?: string; chunk_x?: number; chunk_z?: number };
type AreaRow = {
  id?: string;
  land_id?: string;
  name?: string;
  dimension_id?: string;
  min_x?: number;
  min_z?: number;
  max_x?: number;
  max_z?: number;
};
type MemberRow = { land_id?: string; relation?: string };

function safeRows<T>(query: QueryFn, sql: ReturnType<typeof SQL>): T[] | null {
  try {
    const rows = query(sql);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return null;
  }
}

/** 统计每块领地的区块数 */
function chunkCounts(query: QueryFn): Map<string, number> {
  const rows = safeRows<{ land_id?: string; n?: number }>(
    query,
    SQL`SELECT land_id, COUNT(*) AS n FROM land2_claim GROUP BY land_id`
  );
  const map = new Map<string, number>();
  if (!rows) return map;
  for (const row of rows) map.set(String(row.land_id ?? ""), Number(row.n) || 0);
  return map;
}

/**
 * 列出某玩家拥有或作为成员的领地。
 * 使用场景：GET /api/sfmc/wechat/lands。自己是领主时 relation 为 owner；否则取成员表里的 relation。
 */
export function listPlayerLands(query: QueryFn, playerId: string): PlayerLandSummary[] {
  const id = playerId.trim();
  if (!id) return [];
  const owned = safeRows<LandRow>(
    query,
    SQL`SELECT id, name, owner_id, owner_name, status, level, next_upkeep_at, upkeep_due
        FROM land2_land WHERE owner_id = ${id}`
  );
  const membered = safeRows<LandRow & { relation?: string }>(
    query,
    SQL`SELECT l.id, l.name, l.owner_id, l.owner_name, l.status, l.level, l.next_upkeep_at, l.upkeep_due, m.relation
        FROM land2_land l
        INNER JOIN land2_member m ON m.land_id = l.id
        WHERE m.player_id = ${id}`
  );
  if (owned == null && membered == null) return [];
  const counts = chunkCounts(query);
  const byId = new Map<string, PlayerLandSummary>();
  for (const row of owned ?? []) {
    const landId = String(row.id ?? "");
    if (!landId) continue;
    byId.set(landId, {
      id: landId,
      name: String(row.name ?? ""),
      status: String(row.status ?? "active"),
      level: Number(row.level) || 0,
      chunks: counts.get(landId) ?? 0,
      nextUpkeepAt: Number(row.next_upkeep_at) || 0,
      upkeepDue: Number(row.upkeep_due) || 0,
      ownerName: String(row.owner_name ?? ""),
      relation: "owner",
    });
  }
  for (const row of membered ?? []) {
    const landId = String(row.id ?? "");
    if (!landId || byId.has(landId)) continue;
    byId.set(landId, {
      id: landId,
      name: String(row.name ?? ""),
      status: String(row.status ?? "active"),
      level: Number(row.level) || 0,
      chunks: counts.get(landId) ?? 0,
      nextUpkeepAt: Number(row.next_upkeep_at) || 0,
      upkeepDue: Number(row.upkeep_due) || 0,
      ownerName: String(row.owner_name ?? ""),
      relation: String(row.relation ?? "member"),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

/**
 * 列出全部领地的地图几何。
 * 使用场景：GET /api/sfmc/lands（小程序地图页 /map/lands 的数据源）。
 */
export function listMapLands(query: QueryFn): MapLandView[] {
  const lands = safeRows<LandRow>(
    query,
    SQL`SELECT id, name, owner_name, status, level FROM land2_land`
  );
  if (lands == null) return [];
  const claims = safeRows<ClaimRow>(
    query,
    SQL`SELECT land_id, dimension_id, chunk_x, chunk_z FROM land2_claim`
  ) ?? [];
  const areas = safeRows<AreaRow>(
    query,
    SQL`SELECT id, land_id, name, dimension_id, min_x, min_z, max_x, max_z FROM land2_area`
  ) ?? [];

  const claimsByLand = new Map<string, ClaimRow[]>();
  for (const row of claims) {
    const landId = String(row.land_id ?? "");
    if (!landId) continue;
    const list = claimsByLand.get(landId) ?? [];
    list.push(row);
    claimsByLand.set(landId, list);
  }
  const areasByLand = new Map<string, AreaRow[]>();
  for (const row of areas) {
    const landId = String(row.land_id ?? "");
    if (!landId) continue;
    const list = areasByLand.get(landId) ?? [];
    list.push(row);
    areasByLand.set(landId, list);
  }

  return lands.map((land) => {
    const landId = String(land.id ?? "");
    const claimRows = claimsByLand.get(landId) ?? [];
    const byDim = new Map<string, Array<[number, number]>>();
    for (const claim of claimRows) {
      const dim = String(claim.dimension_id ?? "");
      const list = byDim.get(dim) ?? [];
      list.push([Number(claim.chunk_x) || 0, Number(claim.chunk_z) || 0]);
      byDim.set(dim, list);
    }
    return {
      id: landId,
      name: String(land.name ?? ""),
      ownerName: String(land.owner_name ?? ""),
      status: String(land.status ?? ""),
      level: Number(land.level) || 0,
      claims: [...byDim.entries()].map(([dimensionId, chunks]) => ({ dimensionId, chunks })),
      areas: (areasByLand.get(landId) ?? []).map((area) => ({
        id: String(area.id ?? ""),
        name: String(area.name ?? ""),
        dimensionId: String(area.dimension_id ?? ""),
        minX: Math.floor(Number(area.min_x) || 0),
        minZ: Math.floor(Number(area.min_z) || 0),
        maxX: Math.floor(Number(area.max_x) || 0),
        maxZ: Math.floor(Number(area.max_z) || 0),
      })),
    };
  });
}

/** 读取玩家在某块领地的成员关系（测试 / 详情扩展用） */
export function memberRelation(query: QueryFn, landId: string, playerId: string): string | null {
  const rows = safeRows<MemberRow>(
    query,
    SQL`SELECT relation FROM land2_member WHERE land_id = ${landId} AND player_id = ${playerId} LIMIT 1`
  );
  if (!rows?.length) return null;
  return String(rows[0]!.relation ?? "member");
}
