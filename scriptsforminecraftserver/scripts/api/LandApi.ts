import { HttpRequestMethod } from "@minecraft/server-net";
import type {
  CreateLandRequest,
  DeleteLandResult,
  LandData,
  LandErrorCode,
  LandMemberInviteResult,
  LandMemberResult,
  LandValidation,
  TransferLandResult,
} from "@sfmc/types";
import { debug } from "../libs/DebugLog.js";
import { HttpDB } from "../libs/HttpDB.js";

const PATH = "/api/sfmc/lands";

// 类型别名 → 取自 db-server（@sfmc/types/land.js），此处不再重复定义。

function parseLand(body: string | null): LandData | null {
  if (!body) return null;
  try {
    return JSON.parse(body).land || null;
  } catch {
    return null;
  }
}

export async function getAllLands(): Promise<LandData[] | null> {
  debug.i("API", "getAllLands");
  const body = await HttpDB.get(PATH);
  if (!body) return null;
  try {
    const lands = JSON.parse(body).lands;
    const count = Array.isArray(lands) ? lands.length : 0;
    debug.i("API", `getAllLands: ${count} lands`);
    return Array.isArray(lands) ? lands : null;
  } catch {
    return null;
  }
}

export async function validateLand(request: CreateLandRequest): Promise<LandValidation> {
  debug.i("API", `validateLand: owner=${request.ownerId} dimid=${request.dimid}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.POST,
    `${PATH}/validate`,
    request as unknown as Record<string, unknown>
  );
  if (result.status === 0) return { ok: false, error: "数据库服务不可用。" };
  try {
    return JSON.parse(result.body);
  } catch {
    return { ok: false, error: "数据库响应无效。" };
  }
}

export async function createLand(request: CreateLandRequest): Promise<{
  land: LandData | null;
  error?: string;
  message?: string;
  price?: number;
  balance?: number;
  balanceVersion?: number;
  transactionId?: string;
}> {
  debug.i("API", `createLand: owner=${request.ownerId} dimid=${request.dimid}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, PATH, request as unknown as Record<string, unknown>);
  if (result.status !== 200) {
    try {
      const parsed = JSON.parse(result.body);
      return { land: null, error: parsed.error, message: parsed.message, price: parsed.price, balance: parsed.balance };
    } catch {
      return { land: null, error: "土地创建失败。" };
    }
  }
  try {
    const parsed = JSON.parse(result.body);
    return {
      land: parsed.land || null,
      price: parsed.price,
      balance: parsed.balance,
      balanceVersion: parsed.balanceVersion,
      transactionId: parsed.transactionId,
    };
  } catch {
    return { land: null, error: "数据库响应无效。" };
  }
}

export async function updateLand(
  id: string,
  data: Partial<LandData> & { actorId?: string; expectedVersion?: number }
): Promise<LandData | null> {
  debug.i("API", `updateLand: id=${id} actorId=${data.actorId} version=${data.expectedVersion}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.PUT,
    `${PATH}/${encodeURIComponent(id)}`,
    data as Record<string, unknown>
  );
  return result.status === 200 ? parseLand(result.body) : null;
}

export async function deleteLand(
  id: string,
  actorId: string,
  expectedVersion?: number,
  requestId?: string
): Promise<DeleteLandResult> {
  debug.i("API", `deleteLand: id=${id} actorId=${actorId} version=${expectedVersion}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.DELETE, `${PATH}/${encodeURIComponent(id)}`, {
    actorId,
    expectedVersion,
    requestId,
  });
  let parsed: any = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {}
  if (result.status !== 200)
    return {
      ok: false,
      error: parsed.error || (result.status === 0 ? "database_unavailable" : "transaction_failed"),
      message: parsed.message,
      status: result.status,
    };
  return {
    ok: true,
    refund: parsed.refund || 0,
    balance: parsed.balance,
    balanceVersion: parsed.balanceVersion,
    transactionId: parsed.transactionId,
  };
}

export interface LandMemberInviteResult {
  ok: boolean;
  inviteId?: string;
  expiresAt?: number;
  error?: LandErrorCode | string;
  message?: string;
}

export interface LandMemberResult {
  ok: boolean;
  land?: LandData | null;
  error?: LandErrorCode | string;
  message?: string;
}

export async function inviteMember(
  id: string,
  actorId: string,
  playerId: string,
  role: string
): Promise<LandMemberInviteResult> {
  debug.i("API", `inviteMember: landId=${id} playerId=${playerId} role=${role}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(id)}/members`, {
    actorId,
    playerId,
    role,
  });
  if (result.status !== 200) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(result.body || "{}");
    } catch {}
    return {
      ok: false,
      error: parsed.error || (result.status === 0 ? "database_unavailable" : "forbidden"),
      message: parsed.message,
    };
  }
  let parsed: any = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {}
  return { ok: true, inviteId: parsed.inviteId, expiresAt: parsed.expiresAt };
}

export async function removeLandMember(id: string, actorId: string, playerId: string): Promise<LandMemberResult> {
  debug.i("API", `removeLandMember: landId=${id} playerId=${playerId}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.DELETE, `${PATH}/${encodeURIComponent(id)}/members`, {
    actorId,
    playerId,
  });
  if (result.status !== 200) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(result.body || "{}");
    } catch {}
    return { ok: false, error: parsed.error || "forbidden", message: parsed.message };
  }
  return { ok: true, land: parseLand(result.body) };
}

export async function updateLandMember(
  id: string,
  actorId: string,
  playerId: string,
  role: string
): Promise<LandMemberResult> {
  debug.i("API", `updateLandMember: landId=${id} playerId=${playerId} role=${role}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.POST,
    `${PATH}/${encodeURIComponent(id)}/members/${encodeURIComponent(playerId)}`,
    { actorId, role }
  );
  if (result.status !== 200) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(result.body || "{}");
    } catch {}
    return { ok: false, error: parsed.error || "invalid_role", message: parsed.message };
  }
  return { ok: true, land: parseLand(result.body) };
}

export async function getInvites(playerId: string): Promise<any[]> {
  debug.i("API", `getInvites: playerId=${playerId}`);
  const body = await HttpDB.get(`${PATH}/invites/${encodeURIComponent(playerId)}`);
  if (!body) return [];
  try {
    return JSON.parse(body).invites || [];
  } catch {
    return [];
  }
}

export async function acceptInvite(playerId: string, inviteId: string): Promise<LandData | null> {
  debug.i("API", `acceptInvite: playerId=${playerId} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/invites/${encodeURIComponent(playerId)}`, {
    inviteId,
  });
  return result.status === 200 ? parseLand(result.body) : null;
}

export async function declineInvite(playerId: string, inviteId: string): Promise<boolean> {
  debug.i("API", `declineInvite: playerId=${playerId} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.POST,
    `${PATH}/invites/${encodeURIComponent(playerId)}/decline`,
    {
      inviteId,
    }
  );
  return result.status === 200;
}

export async function revokeInvite(id: string, actorId: string, inviteId: string): Promise<boolean> {
  debug.i("API", `revokeInvite: landId=${id} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.DELETE,
    `${PATH}/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`,
    { actorId }
  );
  return result.status === 200;
}

export async function transferLand(
  id: string,
  actorId: string,
  targetId: string,
  targetName: string,
  expectedVersion?: number,
  requestId?: string
): Promise<TransferLandResult> {
  debug.i("API", `transferLand: id=${id} from=${actorId} to=${targetName}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(id)}/transfer`, {
    actorId,
    targetId,
    targetName,
    expectedVersion,
    requestId,
  });
  let parsed: any = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {}
  if (result.status !== 200)
    return {
      ok: false,
      error: parsed.error || (result.status === 0 ? "database_unavailable" : "transaction_failed"),
      message: parsed.message,
      status: result.status,
    };
  return { ok: true, land: parsed.land || null, data: parsed.land || undefined, transactionId: parsed.transactionId };
}

export async function getLandAudit(id: string): Promise<any[]> {
  debug.i("API", `getLandAudit: id=${id}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(id)}/audit`);
  if (!body) return [];
  try {
    return JSON.parse(body).logs || [];
  } catch {
    return [];
  }
}
