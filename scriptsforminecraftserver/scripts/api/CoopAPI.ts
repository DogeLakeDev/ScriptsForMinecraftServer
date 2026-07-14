import { HttpDB } from "../libs/HttpDB";
import type { CoopData, CoopMember, CoopShopItem, CoopBankLog, CoopShopGroup } from "../types";

const PATH = "/api/sfmc/coops";

// ── Coops ──

/**
 *
 *
 * @export
 * @return {*}  {Promise<CoopData[]>}
 */
export async function getAllCoops(): Promise<CoopData[]> {
  const body = await HttpDB.get(PATH);
  if (!body) return [];
  try {
    return JSON.parse(body).coops || [];
  } catch {
    return [];
  }
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {(Promise<CoopData | null>)}
 */
export async function getCoop(cid: string): Promise<CoopData | null> {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).coop || null;
  } catch {
    return null;
  }
}

/**
 *
 *
 * @export
 * @param {CoopData} coop
 * @return {*}  {Promise<boolean>}
 */
/**
 *
 *
 * @export
 * @param {string} cid
 * @param {Partial<CoopData>} data
 * @return {*}  {Promise<boolean>}
 */
export async function updateCoop(cid: string, data: Partial<CoopData> & { actorId: string }): Promise<boolean> {
  return HttpDB.patch(`${PATH}/${encodeURIComponent(cid)}`, data);
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {Promise<boolean>}
 */
export async function deleteCoop(cid: string, actorId: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Delete", `${PATH}/${encodeURIComponent(cid)}`, { actorId });
  return result.status === 200;
}

export async function updateCoopFee(cid: string, actorId: string, feeBps: number): Promise<boolean> {
  const result = await HttpDB.requestJSON("Patch", `${PATH}/${encodeURIComponent(cid)}/settings`, { actorId, feeBps });
  return result.status === 200;
}

export async function inviteCoopMember(cid: string, actorId: string, playerId: string, playerName: string, role: "admin" | "member" = "member"): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/invites`, { actorId, playerId, playerName, role });
  return result.status === 200;
}

export async function acceptCoopInvite(cid: string, inviteId: string, playerId: string, playerName: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/invites/accept`, { actorId: playerId, inviteId, playerName });
  return result.status === 200;
}

// ── Members ──

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {Promise<CoopMember[]>}
 */
export async function getMembers(cid: string): Promise<CoopMember[]> {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/members`);
  if (!body) return [];
  try {
    return JSON.parse(body).members || [];
  } catch {
    return [];
  }
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {string} player_name
 * @param {boolean} [is_op]
 * @return {*}  {Promise<boolean>}
 */
export async function addMember(cid: string, actorId: string, playerId: string, playerName: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members`, { actorId, playerId, playerName });
  return result.status === 200;
}

export async function joinCoop(cid: string, playerId: string, playerName: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members/join`, { actorId: playerId, playerId, playerName });
  return result.status === 200;
}

export async function leaveCoop(cid: string, playerId: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members/leave`, { actorId: playerId });
  return result.status === 200;
}

export async function updateMemberRole(cid: string, actorId: string, playerId: string, role: "admin" | "member"): Promise<boolean> {
  const result = await HttpDB.requestJSON("Patch", `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId)}`, { actorId, role });
  return result.status === 200;
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {string} player_name
 * @return {*}  {Promise<boolean>}
 */
export async function removeMember(cid: string, actorId: string, playerId: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Delete", `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId)}`, { actorId });
  return result.status === 200;
}

// ── Shop Items ──

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {number} [type]
 * @return {*}  {Promise<CoopShopItem[]>}
 */
export async function getShopItems(cid: string, type?: number): Promise<CoopShopItem[]> {
  const qs = type !== undefined ? `?type=${type}` : "";
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/shop_items${qs}`);
  if (!body) return [];
  try {
    return JSON.parse(body).items || [];
  } catch {
    return [];
  }
}

/**
 *
 *
 * @export
 * @param {CoopShopItem} item
 * @return {*}  {Promise<boolean>}
 */
export async function saveShopItem(item: CoopShopItem): Promise<boolean> {
  return HttpDB.post(`${PATH}/${encodeURIComponent(item.cid)}/shop_items`, item as unknown as Record<string, unknown>);
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {string} id
 * @return {*}  {Promise<boolean>}
 */
export async function deleteShopItem(cid: string, id: string): Promise<boolean> {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}/shop_items/${encodeURIComponent(id)}`);
}

// ── Bank Log ──

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {Promise<CoopBankLog[]>}
 */
export async function getBankLog(cid: string): Promise<CoopBankLog[]> {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/bank_log`);
  if (!body) return [];
  try {
    return JSON.parse(body).log || [];
  } catch {
    return [];
  }
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {string} player_name
 * @param {number} type
 * @param {number} amount
 * @param {string} [note]
 * @return {*}  {Promise<boolean>}
 */
export async function addBankLog(
  cid: string,
  player_name: string,
  type: number,
  amount: number,
  note?: string
): Promise<boolean> {
  return HttpDB.post(`${PATH}/${encodeURIComponent(cid)}/bank_log`, { player_name, type, amount, note });
}

// ── Shop Groups ──

/**
 *
 *
 * @export
 * @return {*}  {Promise<CoopShopGroup[]>}
 */
export async function getAllShopGroups(): Promise<CoopShopGroup[]> {
  const body = await HttpDB.get("/api/sfmc/coop_shop_groups");
  if (!body) return [];
  try {
    return JSON.parse(body).groups || [];
  } catch {
    return [];
  }
}

/**
 *
 *
 * @export
 * @param {CoopShopGroup} group
 * @return {*}  {Promise<boolean>}
 */
export async function saveShopGroup(group: CoopShopGroup): Promise<boolean> {
  return HttpDB.post("/api/sfmc/coop_shop_groups", { group });
}

/**
 *
 *
 * @export
 * @param {string} playerName
 * @return {*}  {(Promise<string | null>)}
 */
export async function findPlayerCoop(playerId: string): Promise<string | null> {
  const body = await HttpDB.get(`${PATH}/by-player/${encodeURIComponent(playerId)}`);
  if (!body) return null;
  try { return JSON.parse(body).coop?.cid || null; } catch { return null; }
}

export async function createCoop(name: string, cid: string, actorId: string, actorName: string): Promise<{ ok: boolean; coop?: CoopData; balance?: number; error?: string }> {
  const result = await HttpDB.requestJSON("Post", `${PATH}/create`, { name, cid, actorId, actorName });
  try { const parsed = JSON.parse(result.body); return { ok: result.status === 200 && parsed.ok !== false, coop: parsed.coop, balance: parsed.balance, error: parsed.error }; } catch { return { ok: false, error: "invalid_response" }; }
}

export async function treasury(cid: string, actorId: string, actorName: string, mode: "deposit" | "withdraw", amount: number, note = "") {
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/treasury/${mode}`, { actorId, actorName, amount, note });
  try { const parsed = JSON.parse(result.body); return { ok: result.status === 200 && parsed.ok !== false, ...parsed }; } catch { return { ok: false, error: "invalid_response" }; }
}
