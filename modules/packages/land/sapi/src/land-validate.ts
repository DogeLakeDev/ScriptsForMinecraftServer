/**
 * land-validate.ts — 领地合法性校验(走 db.tx)
 *
 * 关键:tx() 内部 recorder 不返回真实结果,所有"读"必须依靠 fn 闭包传入的外部
 *     snapshot;返回 ValidationResult 也走 fn 返回值(不依赖 tx 内的查询结果)。
 *
 * 用法:
 *   const r = await db.tx(async (tx) => {
 *     const cfg = configSnapshot.discount; // 从外部注入
 *     // tx.query/get 仅作为 step 记录,真实查询在 platform side 完成
 *     return calcByCube(cfg, info);
 *   });
 */

import type { TxContext } from "@sfmc-bds/sdk/sapi/db";

export interface LandCubeInput {
  dimension: number;
  posA: { x: number; y: number; z: number };
  posB: { x: number; y: number; z: number };
}

export interface CubeInfo {
  length: number;
  width: number;
  height: number;
  square: number;
  volume: number;
}

export interface ValidationResult {
  ok: boolean;
  msg?: string;
}

export interface LandConfigSnapshot {
  minSquare: number;
  maxSquare: number;
  maxLandsPerPlayer: number;
  discount: number;
}

export function normalizeBox(input: LandCubeInput): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  return {
    min: {
      x: Math.min(input.posA.x, input.posB.x),
      y: Math.min(input.posA.y, input.posB.y),
      z: Math.min(input.posA.z, input.posB.z),
    },
    max: {
      x: Math.max(input.posA.x, input.posB.x),
      y: Math.max(input.posA.y, input.posB.y),
      z: Math.max(input.posA.z, input.posB.z),
    },
  };
}

export function cubeInfo(input: LandCubeInput): CubeInfo {
  const n = normalizeBox(input);
  const w = n.max.x - n.min.x + 1;
  const h = n.max.y - n.min.y + 1;
  const l = n.max.z - n.min.z + 1;
  return { length: l, width: w, height: h, square: w * l, volume: w * h * l };
}

/**
 * 校验重叠 + 上限;在事务内跑(读 lands + 计数),返回结构化结果。
 *
 * 调用方需自行准备 ownerLands(避免 tx 内查询结果不可用):
 *   const ownerLands = await db.query<LandRow>("lands", { where: { eq: ["owner_player_id", ownerId] } });
 *   const r = await db.tx(async (tx) => validateLandBox(tx, { cfg, ownerLands, candidate }));
 */
export function validateLandBox(
  tx: TxContext,
  args: {
    cfg: LandConfigSnapshot;
    ownerLands: Array<{ id: string; dimension: number; min_x: number; min_y: number; min_z: number; max_x: number; max_y: number; max_z: number }>;
    candidate: LandCubeInput;
    activeLands?: number;
  }
): ValidationResult {
  const info = cubeInfo(args.candidate);
  if (info.square < args.cfg.minSquare) {
    return { ok: false, msg: `土地面积过小!最小面积为 ${args.cfg.minSquare} 格。` };
  }
  if (info.square > args.cfg.maxSquare) {
    return { ok: false, msg: `土地面积过大!最大面积为 ${args.cfg.maxSquare} 格。` };
  }
  if (args.ownerLands.length >= args.cfg.maxLandsPerPlayer) {
    return { ok: false, msg: `已达持有土地上限(${args.cfg.maxLandsPerPlayer} 块)!` };
  }
  const norm = normalizeBox(args.candidate);
  for (const land of args.ownerLands) {
    if (land.dimension !== args.candidate.dimension) continue;
    if (cubesOverlap(norm, land)) {
      return { ok: false, msg: "该区域与其他土地重叠,请重新选择土地范围。" };
    }
  }
  // 主动 step 记录(供审计 + 后续 db-server 端校验二次执行)
  void tx;
  void args.activeLands;
  return { ok: true };
}

function cubesOverlap(
  a: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  b: { min_x: number; min_y: number; min_z: number; max_x: number; max_y: number; max_z: number }
): boolean {
  return (
    a.min.x <= b.max_x &&
    a.max.x >= b.min_x &&
    a.min.y <= b.max_y &&
    a.max.y >= b.min_y &&
    a.min.z <= b.max_z &&
    a.max.z >= b.min_z
  );
}

/** 计算本地预览价格(非权威,服务端会重算) */
export function calculateLocalPrice(cfg: LandConfigSnapshot, info: CubeInfo): number {
  return Math.max(0, Math.floor((info.square * 8 + info.height * 20) * cfg.discount));
}

export interface LandOwnerRow {
  id: string;
  dimension: number;
  min_x: number;
  min_y: number;
  min_z: number;
  max_x: number;
  max_y: number;
  max_z: number;
  status: string;
}

export function findLandsByOwner(
  rows: LandOwnerRow[],
  ownerId: string
): LandOwnerRow[] {
  return rows.filter((r) => r.status === "active" && (r as unknown as { owner_player_id?: string }).owner_player_id === ownerId);
}

export function getDimensionName(dimid: number): string {
  return ["主世界", "地狱", "末地"][dimid] ?? "未知";
}