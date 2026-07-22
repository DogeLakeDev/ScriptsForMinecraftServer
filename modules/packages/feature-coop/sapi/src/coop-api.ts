/**
 * @sfmc/module-feature-coop — coop-api.ts
 *
 * 将 v1 HttpDB wrapper 改为 v2 db.tx + db.query 直接读写 platform bootstrap 表
 * (sfmc_coops / sfmc_coop_members / sfmc_coop_invites / sfmc_coop_accounts /
 *  sfmc_coop_bank_log / sfmc_coop_shop_items / sfmc_coop_shop_groups /
 *  sfmc_coop_audit_logs)。
 *
 * 所有调用都通过 v2 manifest 声明的 db:read|write:<表> 权限。
 */

import { db } from "@sfmc/sdk/sapi/db";

export interface CoopRow {
  cid: string;
  name: string;
  owner_player_id: string;
  owner_player_name_snapshot: string;
  created_at: number;
  updated_at: number;
}

export interface CoopMemberRow {
  cid: string;
  player_id: string;
  player_name_snapshot: string;
  role: string;
  joined_at: number;
}

export interface CoopAccountRow {
  cid: string;
  balance: number;
  version: number;
  updated_at: number;
}

export interface CoopShopItemRow {
  id: string;
  cid: string;
  name: string;
  item_type: string;
  item_aux: number;
  money: number;
  sv: number;
  num: number;
  type: number;
  groups: string;
  is_true: number;
  created_at: number;
  updated_at: number;
}

export interface CoopShopGroupRow {
  groupid: string;
  displayname: string;
  type_function: string;
}

export interface CoopBankLogRow {
  id: string;
  cid: string;
  actor_id: string;
  actor_name: string;
  amount: number;
  mode: string;
  note: string;
  created_at: number;
}

// ── Coops ──

export async function getAllCoops(): Promise<CoopRow[]> {
  return await db.query<CoopRow>("sfmc_coops", {});
}

export async function getCoop(cid: string): Promise<CoopRow | null> {
  const row = await db.get<CoopRow>("sfmc_coops", cid);
  return row ?? null;
}

export async function findPlayerCoop(playerId: string): Promise<string | null> {
  const rows = await db.query<{ cid: string }>("sfmc_coop_members", {
    where: { eq: ["player_id", playerId] },
    limit: 1,
  });
  return rows[0]?.cid ?? null;
}

export async function createCoop(
  name: string,
  cid: string,
  actorId: string,
  actorName: string
): Promise<{ ok: boolean; coop?: CoopRow; error?: string }> {
  const now = Date.now();
  try {
    await db.tx(async (tx) => {
      await tx.insert("sfmc_coops", {
        cid,
        name,
        owner_player_id: actorId,
        owner_player_name_snapshot: actorName,
        created_at: now,
        updated_at: now,
      });
      await tx.insert("sfmc_coop_members", {
        cid,
        player_id: actorId,
        player_name_snapshot: actorName,
        role: "owner",
        joined_at: now,
      });
      await tx.insert("sfmc_coop_accounts", {
        cid,
        balance: 0,
        version: 0,
        updated_at: now,
      });
      await tx.insert("sfmc_coop_audit_logs", {
        id: `create_${cid}_${now}`,
        cid,
        actor_id: actorId,
        actor_name_snapshot: actorName,
        action: "create_coop",
        data: JSON.stringify({ name }),
        created_at: now,
      });
    });
    const coop = await getCoop(cid);
    return { ok: true, coop: coop ?? undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateCoop(cid: string, patch: Partial<CoopRow>): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.update("sfmc_coops", cid, { ...patch, updated_at: Date.now() });
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCoop(cid: string, actorId: string): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.delete("sfmc_coops", cid, { hard: true });
      await tx.audit("sfmc_coops", cid, "delete_coop", { actorId });
    });
    return true;
  } catch {
    return false;
  }
}

// ── Members ──

export async function getMembers(cid: string): Promise<CoopMemberRow[]> {
  return await db.query<CoopMemberRow>("sfmc_coop_members", { where: { eq: ["cid", cid] } });
}

export async function joinCoop(cid: string, playerId: string, playerName: string): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.insert("sfmc_coop_members", {
        cid,
        player_id: playerId,
        player_name_snapshot: playerName,
        role: "member",
        joined_at: Date.now(),
      });
      await tx.audit("sfmc_coops", cid, "join", { playerId });
    });
    return true;
  } catch {
    return false;
  }
}

export async function leaveCoop(cid: string, playerId: string): Promise<boolean> {
  try {
    const rows = await db.query<{ cid: string; player_id: string }>("sfmc_coop_members", {
      where: { and: [{ eq: ["cid", cid] }, { eq: ["player_id", playerId] }] },
      limit: 1,
    });
    if (rows.length === 0) return false;
    await db.tx(async (tx) => {
      await tx.delete("sfmc_coop_members", `${rows[0]!.cid}|${rows[0]!.player_id}`);
      await tx.audit("sfmc_coops", cid, "leave", { playerId });
    });
    return true;
  } catch {
    return false;
  }
}

export async function updateMemberRole(
  cid: string,
  actorId: string,
  playerId: string,
  role: "admin" | "member"
): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.update("sfmc_coop_members", `${cid}|${playerId}`, {
        role,
      });
      await tx.audit("sfmc_coops", cid, "role_change", { actorId, targetId: playerId, role });
    });
    return true;
  } catch {
    return false;
  }
}

// ── Shop Items ──

export async function getShopItems(cid: string, type?: number): Promise<CoopShopItemRow[]> {
  if (type !== undefined) {
    return await db.query<CoopShopItemRow>("sfmc_coop_shop_items", {
      where: { and: [{ eq: ["cid", cid] }, { eq: ["type", type] }] },
    });
  }
  return await db.query<CoopShopItemRow>("sfmc_coop_shop_items", { where: { eq: ["cid", cid] } });
}

export async function saveShopItem(item: Partial<CoopShopItemRow>): Promise<boolean> {
  const now = Date.now();
  try {
    await db.tx(async (tx) => {
      const existing = await db.query<{ id: string }>("sfmc_coop_shop_items", {
        where: { and: [{ eq: ["cid", item.cid ?? ""] }, { eq: ["id", item.id ?? ""] }] },
        limit: 1,
      });
      if (existing.length > 0) {
        await tx.update("sfmc_coop_shop_items", item.id!, { ...item, updated_at: now });
      } else {
        await tx.insert("sfmc_coop_shop_items", { ...item, updated_at: now, created_at: now } as CoopShopItemRow);
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteShopItem(cid: string, id: string): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      await tx.delete("sfmc_coop_shop_items", id);
      await tx.audit("sfmc_coops", cid, "shop_delete", { id });
    });
    return true;
  } catch {
    return false;
  }
}

// ── Shop Groups ──

export async function getAllShopGroups(): Promise<CoopShopGroupRow[]> {
  return await db.query<CoopShopGroupRow>("sfmc_coop_shop_groups", {});
}

export async function saveShopGroup(group: CoopShopGroupRow): Promise<boolean> {
  try {
    await db.tx(async (tx) => {
      const existing = await tx.get("sfmc_coop_shop_groups", group.groupid);
      if (existing) {
        await tx.update("sfmc_coop_shop_groups", group.groupid, group);
      } else {
        await tx.insert("sfmc_coop_shop_groups", group);
      }
    });
    return true;
  } catch {
    return false;
  }
}

// ── Bank ──

export async function getBankAccount(cid: string): Promise<CoopAccountRow | null> {
  const row = await db.get<CoopAccountRow>("sfmc_coop_accounts", cid);
  return row ?? null;
}

export async function treasury(
  cid: string,
  actorId: string,
  actorName: string,
  mode: "deposit" | "withdraw",
  amount: number,
  note = ""
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    await db.tx(async (tx) => {
      const account = await tx.get("sfmc_coop_accounts", cid);
      const cur = (account?.balance as number) ?? 0;
      const next = mode === "deposit" ? cur + amount : cur - amount;
      if (next < 0) throw new Error("insufficient_balance");
      await tx.update("sfmc_coop_accounts", cid, {
        balance: next,
        version: ((account?.version as number) ?? 0) + 1,
        updated_at: Date.now(),
      });
      await tx.insert("sfmc_coop_bank_log", {
        id: `${cid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cid,
        actor_id: actorId,
        actor_name: actorName,
        amount,
        mode,
        note,
        created_at: Date.now(),
      });
      await tx.audit("sfmc_coops", cid, mode, { actorId, amount });
    });
    const account = await getBankAccount(cid);
    return { ok: true, balance: account?.balance ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getBankLog(cid: string): Promise<CoopBankLogRow[]> {
  return await db.query<CoopBankLogRow>("sfmc_coop_bank_log", { where: { eq: ["cid", cid] } });
}

export async function shopBuy(
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    await db.tx(async (tx) => {
      const item = await tx.get("sfmc_coop_shop_items", listingId);
      if (!item) throw new Error("listing_not_found");
      const num = (item.num as number) ?? 0;
      if (num < quantity) throw new Error("insufficient_stock");
      await tx.update("sfmc_coop_shop_items", listingId, {
        sv: ((item.sv as number) ?? 0) + quantity,
        num: num - quantity,
        updated_at: Date.now(),
      });
      await tx.audit("sfmc_coops", cid, "shop_buy", { actorId, listingId, quantity });
    });
    const account = await getBankAccount(cid);
    return { ok: true, balance: account?.balance ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function shopSell(
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    await db.tx(async (tx) => {
      const item = await tx.get("sfmc_coop_shop_items", listingId);
      if (!item) throw new Error("listing_not_found");
      const sv = (item.sv as number) ?? 0;
      const num = (item.num as number) ?? 0;
      if (num - sv < quantity) throw new Error("insufficient_capacity");
      await tx.update("sfmc_coop_shop_items", listingId, {
        sv: sv + quantity,
        updated_at: Date.now(),
      });
      await tx.audit("sfmc_coops", cid, "shop_sell", { actorId, listingId, quantity });
    });
    const account = await getBankAccount(cid);
    return { ok: true, balance: account?.balance ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
