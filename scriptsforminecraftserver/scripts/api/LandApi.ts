import { HttpDB } from "../libs/HttpDB";
import { LandData, LandPos } from "../land/LandDatabase";

const PATH = "/api/sfmc/lands";

function parseLand(body: string | null): LandData | null {
  if (!body) return null;
  try {
    return JSON.parse(body).land || null;
  } catch {
    return null;
  }
}

export interface CreateLandRequest {
  ownerId: string;
  ownerName: string;
  dimid: number;
  posA: LandPos;
  posB: LandPos;
}

export interface LandValidation {
  ok: boolean;
  error?: string;
  price?: number;
}

export async function getAllLands(): Promise<LandData[]> {
  const body = await HttpDB.get(PATH);
  if (!body) return [];
  try { return JSON.parse(body).lands || []; } catch { return []; }
}

export async function getLand(id: string): Promise<LandData | null> {
  return parseLand(await HttpDB.get(`${PATH}/${encodeURIComponent(id)}`));
}

export async function getLandsByOwner(ownerId: string): Promise<LandData[]> {
  const body = await HttpDB.get(`${PATH}/by-owner/${encodeURIComponent(ownerId)}`);
  if (!body) return [];
  try { return JSON.parse(body).lands || []; } catch { return []; }
}

export async function getLandAt(dimid: number, pos: LandPos): Promise<LandData | null> {
  return parseLand(await HttpDB.get(`${PATH}/at/${dimid}/${pos.x}/${pos.y}/${pos.z}`));
}

export async function validateLand(request: CreateLandRequest): Promise<LandValidation> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/validate`, request as unknown as Record<string, unknown>);
  if (result.status === 0) return { ok: false, error: "数据库服务不可用。" };
  try { return JSON.parse(result.body); } catch { return { ok: false, error: "数据库响应无效。" }; }
}

export async function createLand(request: CreateLandRequest): Promise<{ land: LandData | null; error?: string; price?: number }> {
  const result = await HttpDB.requestJSON("Post", PATH, request as unknown as Record<string, unknown>);
  if (result.status !== 200) {
    try { const parsed = JSON.parse(result.body); return { land: null, error: parsed.error, price: parsed.price }; } catch { return { land: null, error: "土地创建失败。" }; }
  }
  try { const parsed = JSON.parse(result.body); return { land: parsed.land || null, price: parsed.price }; } catch { return { land: null, error: "数据库响应无效。" }; }
}

export async function updateLand(id: string, data: Partial<LandData>): Promise<LandData | null> {
  const result = await HttpDB.requestJSON("Patch", `${PATH}/${encodeURIComponent(id)}`, data as Record<string, unknown>);
  return result.status === 200 ? parseLand(result.body) : null;
}

export async function deleteLand(id: string, actorId: string): Promise<{ ok: boolean; refund?: number }> {
  const result = await HttpDB.requestJSON("Delete", `${PATH}/${encodeURIComponent(id)}`, { actorId });
  if (result.status !== 200) return { ok: false };
  try { return { ok: true, refund: JSON.parse(result.body).refund || 0 }; } catch { return { ok: true }; }
}
