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
export async function createCoop(coop: CoopData): Promise<boolean> {
  return HttpDB.post(PATH, { coop });
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {Partial<CoopData>} data
 * @return {*}  {Promise<boolean>}
 */
export async function updateCoop(cid: string, data: Partial<CoopData>): Promise<boolean> {
  return HttpDB.patch(`${PATH}/${encodeURIComponent(cid)}`, data);
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @return {*}  {Promise<boolean>}
 */
export async function deleteCoop(cid: string): Promise<boolean> {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}`);
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
export async function addMember(cid: string, player_name: string, is_op?: boolean): Promise<boolean> {
  return HttpDB.post(`${PATH}/${encodeURIComponent(cid)}/members`, { player_name, is_op });
}

/**
 *
 *
 * @export
 * @param {string} cid
 * @param {string} player_name
 * @return {*}  {Promise<boolean>}
 */
export async function removeMember(cid: string, player_name: string): Promise<boolean> {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(player_name)}`);
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
export async function findPlayerCoop(playerName: string): Promise<string | null> {
  const all = await getAllCoops();
  for (const c of all) {
    const members = await getMembers(c.cid);
    if (members.some((m) => m.player_name === playerName)) return c.cid;
  }
  return null;
}
