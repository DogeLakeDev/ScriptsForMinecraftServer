import { HttpRequestMethod } from "@minecraft/server-net";
import type { CoopBankLog, CoopData, CoopMember, CoopShopGroup, CoopShopItem } from "@sfmc/types";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

const PATH = "/api/sfmc/coops";

// ── Coops ──

/**
 *
 *
 * @export
 * @return {*}  {Promise<CoopData[]>}
 */
export async function getAllCoops(): Promise<CoopData[]> {
  debug.i("API", "getAllCoops");
  const body = await HttpDB.get(PATH);
  if (!body) return [];
  try {
    const coops = JSON.parse(body).coops || [];
    debug.i("API", `getAllCoops: ${coops.length} coops`);
    return coops;
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
  debug.i("API", `getCoop: cid=${cid}`);
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
  debug.i("API", `updateCoop: cid=${cid}`);
  return HttpDB.put(`${PATH}/${encodeURIComponent(cid)}`, data);
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {Promise<boolean>}
 */
export async function deleteCoop(cid: string, actorId: string): Promise<boolean> {
  debug.i("API", `deleteCoop: cid=${cid} actorId=${actorId}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.DELETE, `${PATH}/${encodeURIComponent(cid)}`, { actorId });
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
  debug.i("API", `getMembers: cid=${cid}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/members`);
  if (!body) return [];
  try {
    return JSON.parse(body).members || [];
  } catch {
    return [];
  }
}

export async function joinCoop(cid: string, playerId: string, playerName: string): Promise<boolean> {
  debug.i("API", `joinCoop: cid=${cid} player=${playerName}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(cid)}/members/join`, {
    actorId: playerId,
    playerId,
    playerName,
  });
  return result.status === 200;
}

export async function leaveCoop(cid: string, playerId: string): Promise<boolean> {
  debug.i("API", `leaveCoop: cid=${cid} playerId=${playerId}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(cid)}/members/leave`, {
    actorId: playerId,
  });
  return result.status === 200;
}

export async function updateMemberRole(
  cid: string,
  actorId: string,
  playerId: string,
  role: "admin" | "member"
): Promise<boolean> {
  debug.i("API", `updateMemberRole: cid=${cid} playerId=${playerId} role=${role}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.PUT,
    `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId)}`,
    { actorId, role }
  );
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
  debug.i("API", `removeMember: cid=${cid} playerId=${playerId}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.DELETE,
    `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId)}`,
    { actorId }
  );
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
  debug.i("API", `getShopItems: cid=${cid} type=${type}`);
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
  debug.i("API", `saveShopItem: cid=${item.cid} id=${item.id} name=${item.name}`);
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
  debug.i("API", `deleteShopItem: cid=${cid} id=${id}`);
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
  debug.i("API", `getBankLog: cid=${cid}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/bank_log`);
  if (!body) return [];
  try {
    return JSON.parse(body).log || [];
  } catch {
    return [];
  }
}

// ── Shop Groups ──

/**
 *
 *
 * @export
 * @return {*}  {Promise<CoopShopGroup[]>}
 */
export async function getAllShopGroups(): Promise<CoopShopGroup[]> {
  debug.i("API", "getAllShopGroups");
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
  debug.i("API", `saveShopGroup: groupid=${group.groupid} displayname=${group.displayname}`);
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
  debug.i("API", `findPlayerCoop: playerId=${playerId}`);
  const body = await HttpDB.get(`${PATH}/by-player/${encodeURIComponent(playerId)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).coop?.cid || null;
  } catch {
    return null;
  }
}

export async function createCoop(
  name: string,
  cid: string,
  actorId: string,
  actorName: string
): Promise<{ ok: boolean; coop?: CoopData; balance?: number; error?: string }> {
  debug.i("API", `createCoop: name=${name} cid=${cid} actor=${actorName}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/create`, { name, cid, actorId, actorName });
  try {
    const parsed = JSON.parse(result.body);
    return {
      ok: result.status === 200 && parsed.ok !== false,
      coop: parsed.coop,
      balance: parsed.balance,
      error: parsed.error,
    };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}

export async function treasury(
  cid: string,
  actorId: string,
  actorName: string,
  mode: "deposit" | "withdraw",
  amount: number,
  note = ""
) {
  debug.i("API", `treasury: cid=${cid} actor=${actorName} mode=${mode} amount=${amount}`);
  const result = await HttpDB.requestJSON(
    HttpRequestMethod.POST,
    `${PATH}/${encodeURIComponent(cid)}/treasury/${mode}`,
    {
      actorId,
      actorName,
      amount,
      note,
    }
  );
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}

export async function coopShopBuy(
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number,
  idempotencyKey?: string
) {
  debug.i("API", `coopShopBuy: cid=${cid} actor=${actorName} listingId=${listingId} qty=${quantity}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(cid)}/shop/buy`, {
    actorId,
    actorName,
    listingId,
    quantity,
    idempotencyKey,
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}

export async function coopShopSell(
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number,
  idempotencyKey?: string
) {
  debug.i("API", `coopShopSell: cid=${cid} actor=${actorName} listingId=${listingId} qty=${quantity}`);
  const result = await HttpDB.requestJSON(HttpRequestMethod.POST, `${PATH}/${encodeURIComponent(cid)}/shop/sell`, {
    actorId,
    actorName,
    listingId,
    quantity,
    idempotencyKey,
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}