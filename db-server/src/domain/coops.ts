/**
 * domain/coops.ts — 合作社业务核心
 *
 * 所有事务 (BEGIN IMMEDIATE / COMMIT / ROLLBACK) 与 SQL 都搬到这里,
 * 让 routes/coops.ts 只剩请求解析 + 路由 dispatch。
 *
 * 事务描述 (Tx*):
 *   - createCoopTx           创建合作社(扣 1000 加入owner)
 *   - acceptCoopInviteTx     接受合作社邀请(写入 members)
 *   - coopTreasuryTx         公共金库存取(deposit / withdraw,带经济账)
 *   - dissolveCoopTx         解散合作社(置 status=dissolved,清成员,写审计)
 *   - coopShopBuyTx          合作社商店买入(扣玩家、增库存 sv、写 tx log)
 *   - coopShopSellTx         合作社商店卖出(增玩家、减库存 sv、写 tx log)
 *
 *   其中 coopShopBuyTx / coopShopSellTx 走 sfmc_economy_idempotency 实现幂等回放。
 *
 * 领域辅助 (查询 / 元数据写入,不走事务):
 *   - findCoopByCid / findCoopByOwner / listCoops / listCoopMembers  读取
 *   - roleOf / coopCanAct / hasActiveCoopMembership / hasActiveCoop   权限 / 校验
 *   - coopAccountByCid / coopSnapshot                                  账户 / 快照
 *   - listPendingInvitesForInvitee / listActiveInvitesForInvitee        邀请读取
 *   - listAuditLogs / listBankLog / listShopItems / listShopGroups     日志 / 商店
 *   - createCoopInvite / revokeCoopInvite / declineCoopInvite            邀请写入
 *   - updateCoopMeta / addCoopMember / setCoopMemberRole               成员 / 元数据
 *   - leaveCoop / removeCoopMember / deleteShopMemberByName             成员移除
 *   - upsertShopItem / upsertShopGroup / upsertBankLog                  商店 / 账目写入
 *   - expirePendingInvitesForInvitee                                    邀请过期清理
 *
 * SQL 全部走 sql-template-strings 的 SQL`` 模板。
 * 事务由 withTransaction 包裹(见 domain/transaction.ts)。
 */

import type { DatabaseSync } from "node:sqlite";
import { SQL } from "sql-template-strings";

import type { AnyQuery } from "./economy.js";
import type { TxResult } from "./transaction.js";
import { withTransaction } from "./transaction.js";

const TABLE_COOP = "sfmc_coops";
const TABLE_MEMBERS = "sfmc_coop_members";
const TABLE_COOP_ACCOUNT = "sfmc_coop_accounts";
const TABLE_INVITES = "sfmc_coop_invites";
const TABLE_AUDIT = "sfmc_coop_audit_logs";
const TABLE_SHOP_ITEMS = "sfmc_coop_shop_items";
const TABLE_SHOP_GROUPS = "sfmc_coop_shop_groups";
const TABLE_BANK_LOG = "sfmc_coop_bank_log";
const TABLE_ACCOUNTS = "sfmc_economy_accounts";
const TABLE_TX = "sfmc_economy_transactions";
const TABLE_IDEMPOTENCY = "sfmc_economy_idempotency";

export {
  TABLE_BANK_LOG,
  TABLE_COOP,
  TABLE_COOP_ACCOUNT,
  TABLE_INVITES,
  TABLE_MEMBERS,
  TABLE_SHOP_GROUPS,
  TABLE_SHOP_ITEMS,
};

function newTxId(now: number): string {
  return `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function nowMs(): number {
  return Date.now();
}

/** 与 routes 层约定一致的 ensureEconomyAccount 适配器 */
export type EnsureEconomyAccountFn = (
  playerId: string,
  playerName: string
) => { balance: number; player_id: string; version: number } | undefined;

// ──────────────────────────────────────────────────────────────────
// 简单查询 / 元数据写入（不涉及事务）
// ──────────────────────────────────────────────────────────────────

export function findCoopByCid(query: AnyQuery, cid: string): Record<string, unknown> | null {
  const rows = query(SQL`SELECT * FROM ${TABLE_COOP} WHERE cid = ${cid}`) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function findCoopByOwner(query: AnyQuery, playerId: string): Record<string, unknown> | null {
  const rows = query(
    SQL`SELECT c.* FROM ${TABLE_COOP} c
        JOIN ${TABLE_MEMBERS} m ON m.cid = c.cid
        WHERE m.player_id = ${playerId} AND m.status = 'active'
          AND c.status = 'active'
        LIMIT 1`
  ) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function listCoops(query: AnyQuery): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_COOP} ORDER BY updated_at DESC`);
  return Array.isArray(rows) ? rows : [];
}

export function listCoopMembers(query: AnyQuery, cid: string): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_MEMBERS} WHERE cid = ${cid} ORDER BY joined_at ASC`);
  return Array.isArray(rows) ? rows : [];
}

export function roleOf(query: AnyQuery, cid: string, playerId: string, now: number = nowMs()): string | null {
  const rows = query(
    SQL`SELECT role FROM ${TABLE_MEMBERS}
        WHERE cid = ${cid} AND player_id = ${playerId}
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > ${now})
        LIMIT 1`
  ) as Array<{ role: string }>;
  return rows[0]?.role ?? null;
}

/** 角色 → capability 检查（owner/admin/member 各自允许的能力） */
export function coopCanAct(
  query: AnyQuery,
  cid: string,
  actorId: string,
  capability: string,
  now: number = nowMs()
): boolean {
  const role = roleOf(query, cid, actorId, now);
  if (role === "owner") return true;
  if (role === "admin" && ["manage_notice", "manage_members", "manage_shop", "audit"].includes(capability)) {
    return true;
  }
  if (role === "member" && ["view", "deposit", "withdraw"].includes(capability)) {
    return true;
  }
  return false;
}

export function hasActiveCoopMembership(query: AnyQuery, playerId: string): boolean {
  const rows = query(SQL`SELECT 1 FROM ${TABLE_MEMBERS} WHERE player_id = ${playerId} AND status = 'active' LIMIT 1`);
  return Array.isArray(rows) && rows.length > 0;
}

export function hasActiveCoop(query: AnyQuery, cid: string): boolean {
  const rows = query(SQL`SELECT 1 FROM ${TABLE_COOP} WHERE cid = ${cid} LIMIT 1`) as Array<unknown>;
  return rows.length > 0;
}

export function coopAccountByCid(query: AnyQuery, cid: string): Record<string, unknown> | null {
  const rows = query(SQL`SELECT * FROM ${TABLE_COOP_ACCOUNT} WHERE cid = ${cid}`) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function coopSnapshot(
  query: AnyQuery,
  cid: string
): {
  coop: Record<string, unknown> | null;
  account: Record<string, unknown> | null;
  members: unknown[];
} {
  const coop = findCoopByCid(query, cid);
  return {
    coop,
    account: coop ? coopAccountByCid(query, cid) : null,
    members: listCoopMembers(query, cid),
  };
}

export function listPendingInvitesForInvitee(
  query: AnyQuery,
  cid: string,
  inviteeId: string,
  now: number = nowMs()
): unknown[] {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_INVITES}
        WHERE cid = ${cid} AND invitee_id = ${inviteeId}
          AND status = 'pending' AND expires_at > ${now}
        ORDER BY created_at DESC`
  );
  return Array.isArray(rows) ? rows : [];
}

export function listAuditLogs(query: AnyQuery, cid: string): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_AUDIT} WHERE cid = ${cid} ORDER BY created_at DESC LIMIT 200`);
  return Array.isArray(rows) ? rows : [];
}

export function listShopItems(query: AnyQuery, cid: string, type?: number): unknown[] {
  if (type === undefined) {
    const rows = query(SQL`SELECT * FROM ${TABLE_SHOP_ITEMS} WHERE cid = ${cid}`);
    return Array.isArray(rows) ? rows : [];
  }
  const rows = query(SQL`SELECT * FROM ${TABLE_SHOP_ITEMS} WHERE cid = ${cid} AND type = ${type}`);
  return Array.isArray(rows) ? rows : [];
}

export function listShopGroups(query: AnyQuery): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_SHOP_GROUPS}`);
  return Array.isArray(rows) ? rows : [];
}

export function listBankLog(query: AnyQuery, cid: string, limit = 100): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_BANK_LOG} WHERE cid = ${cid} ORDER BY created_at DESC LIMIT ${limit}`);
  return Array.isArray(rows) ? rows : [];
}

export function upsertShopItem(query: AnyQuery, item: Record<string, unknown>): void {
  const now = nowMs();
  query(
    SQL`INSERT INTO ${TABLE_SHOP_ITEMS}
        (id, cid, name, item_type, item_aux, item_nbt, type, groups, des,
         num, sv, money, is_true, created_at, updated_at)
        VALUES (${String(item.id)}, ${String(item.cid)}, ${String(item.name ?? "")},
                ${String(item.item_type ?? "")}, ${Number(item.item_aux ?? 0)},
                ${String(item.item_nbt ?? "")}, ${Number(item.type ?? 0)},
                ${String(item.groups ?? "[]")}, ${String(item.des ?? "")},
                ${Number(item.num ?? 0)}, ${Number(item.sv ?? 0)},
                ${Number(item.money ?? 0)}, ${item.is_true === false ? 0 : 1},
                ${Number(item.created_at ?? now)}, ${now})
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          item_type = excluded.item_type,
          item_aux = excluded.item_aux,
          item_nbt = excluded.item_nbt,
          type = excluded.type,
          groups = excluded.groups,
          des = excluded.des,
          num = excluded.num,
          sv = excluded.sv,
          money = excluded.money,
          is_true = excluded.is_true,
          updated_at = excluded.updated_at`
  );
}

export function upsertShopGroup(query: AnyQuery, group: Record<string, unknown>): void {
  query(
    SQL`INSERT INTO ${TABLE_SHOP_GROUPS}
        (groupid, displayname, displaydescribe, icon, type_function)
        VALUES (${String(group.groupid)}, ${String(group.displayname ?? "")},
                ${String(group.displaydescribe ?? "")}, ${String(group.icon ?? "")},
                ${String(group.type_function ?? "")})
        ON CONFLICT(groupid) DO UPDATE SET
          displayname = excluded.displayname,
          displaydescribe = excluded.displaydescribe,
          icon = excluded.icon,
          type_function = excluded.type_function`
  );
}

export function upsertBankLog(
  query: AnyQuery,
  cid: string,
  playerName: string,
  type: string,
  amount: number | string,
  note: string,
  now: number = nowMs()
): void {
  query(
    SQL`INSERT INTO ${TABLE_BANK_LOG}
        (cid, player_name, type, amount, note, created_at)
        VALUES (${cid}, ${playerName}, ${type}, ${amount}, ${note || ""}, ${now})`
  );
}

export function expirePendingInvitesForInvitee(query: AnyQuery, inviteeId: string, now: number = nowMs()): void {
  query(
    SQL`UPDATE ${TABLE_INVITES}
        SET status = 'expired'
        WHERE invitee_id = ${inviteeId} AND status = 'pending' AND expires_at <= ${now}`
  );
}

export function listActiveInvitesForInvitee(query: AnyQuery, inviteeId: string, now: number = nowMs()): unknown[] {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_INVITES}
        WHERE invitee_id = ${inviteeId} AND status = 'pending' AND expires_at > ${now}
        ORDER BY created_at ASC`
  );
  return Array.isArray(rows) ? rows : [];
}

export function deleteShopMemberByName(query: AnyQuery, cid: string, playerName: string): void {
  query(SQL`DELETE FROM ${TABLE_MEMBERS} WHERE cid = ${cid} AND player_name = ${playerName}`);
}

// ──────────────────────────────────────────────────────────────────
// 领域事务
// ──────────────────────────────────────────────────────────────────

/** 创建合作社（扣 1000 创建费） */
export function createCoopTx(
  query: AnyQuery,
  db: DatabaseSync,
  data: Record<string, unknown>,
  ensureEconomyAccount: EnsureEconomyAccountFn
): TxResult<{ cid: string; transactionId: string; balance: number }> {
  const cid = String(data.cid ?? "").trim();
  const name = String(data.name ?? "").trim();
  const actorId = String(data.actorId ?? "");
  if (!actorId || !/^[A-Za-z0-9_-]{3,32}$/.test(cid) || !name || name.length > 64) {
    return { ok: false, error: "invalid_input", status: 400 };
  }

  return withTransaction(db, () => {
    if (findCoopByCid(query, cid)) {
      return { ok: false, error: "coop_id_exists", status: 409 };
    }
    if (hasActiveCoopMembership(query, actorId)) {
      return { ok: false, error: "already_member", status: 409 };
    }
    const account = ensureEconomyAccount(actorId, String(data.actorName ?? ""));
    if (!account || account.balance < 1000) {
      return {
        ok: false,
        error: "insufficient_funds",
        status: 409,
        extra: { balance: account?.balance ?? 0 },
      };
    }
    const now = nowMs();
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance - 1000, version = version + 1, updated_at = ${now}
          WHERE player_id = ${actorId} AND balance >= 1000`
    );
    query(
      SQL`INSERT INTO ${TABLE_COOP}
          (cid, name, owner_player_id, owner_name_snapshot, notice, created_at, updated_at)
          VALUES (${cid}, ${name}, ${actorId}, ${String(data.actorName ?? "")},
                  ${"社长很懒，没有写公告～"}, ${now}, ${now})`
    );
    query(
      SQL`INSERT INTO ${TABLE_MEMBERS}
          (cid, player_id, player_name_snapshot, role, joined_at)
          VALUES (${cid}, ${actorId}, ${String(data.actorName ?? "")}, ${"owner"}, ${now})`
    );
    query(SQL`INSERT INTO ${TABLE_COOP_ACCOUNT} (cid, updated_at) VALUES (${cid}, ${now})`);
    const tx = newTxId(now);
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${tx}, ${"coop.create"}, ${actorId}, ${actorId}, ${null},
                  1000, ${account.balance}, ${account.balance - 1000},
                  ${"coop"}, ${cid}, ${"创建合作社"}, ${now})`
    );
    query(
      SQL`INSERT INTO ${TABLE_AUDIT}
          (cid, actor_id, action, after_state, transaction_id, created_at)
          VALUES (${cid}, ${actorId}, ${"coop.create"}, ${JSON.stringify({ name })},
                  ${tx}, ${now})`
    );
    return {
      ok: true,
      data: {
        cid,
        transactionId: tx,
        balance: account.balance - 1000,
      },
    };
  });
}

/** 创建一个邀请 */
export function createCoopInvite(
  query: AnyQuery,
  cid: string,
  actorId: string,
  inviteeId: string,
  inviteeName: string,
  role: "admin" | "member",
  expiresAt: number,
  now: number = nowMs()
): { inviteId: string } {
  const inviteId = `I${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  query(
    SQL`UPDATE ${TABLE_INVITES}
        SET status = 'revoked'
        WHERE cid = ${cid} AND invitee_id = ${inviteeId} AND status = 'pending'`
  );
  query(
    SQL`INSERT INTO ${TABLE_INVITES}
        (id, cid, inviter_id, invitee_id, invitee_name_snapshot, role, status, expires_at, created_at)
        VALUES (${inviteId}, ${cid}, ${actorId}, ${inviteeId}, ${inviteeName},
                ${role}, ${"pending"}, ${expiresAt}, ${now})`
  );
  return { inviteId };
}

/** 接受合作社邀请（事务） */
export function acceptCoopInviteTx(
  query: AnyQuery,
  db: DatabaseSync,
  cid: string,
  inviteId: string,
  actorId: string,
  playerName: string
): TxResult<{ snapshot: ReturnType<typeof coopSnapshot> }> {
  return withTransaction(db, () => {
    const inviteRow = query(
      SQL`SELECT * FROM ${TABLE_INVITES}
          WHERE id = ${inviteId} AND cid = ${cid} AND invitee_id = ${actorId}
            AND status = 'pending' AND expires_at > ${nowMs()}`
    ) as Array<Record<string, unknown>>;
    const invite = inviteRow[0];
    if (!invite) return { ok: false, error: "invite_not_found", status: 404 };
    if (hasActiveCoopMembership(query, actorId)) {
      return { ok: false, error: "already_member", status: 409 };
    }
    query(
      SQL`INSERT INTO ${TABLE_MEMBERS}
          (cid, player_id, player_name_snapshot, role, joined_at)
          VALUES (${cid}, ${actorId}, ${String(playerName || invite.invitee_name_snapshot)},
                  ${String(invite.role)}, ${nowMs()})`
    );
    query(SQL`UPDATE ${TABLE_INVITES} SET status = 'accepted' WHERE id = ${inviteId}`);
    return {
      ok: true,
      data: { snapshot: coopSnapshot(query, cid) },
    };
  });
}

/** 公共金库存取（事务） */
export function coopTreasuryTx(
  query: AnyQuery,
  db: DatabaseSync,
  cid: string,
  mode: "deposit" | "withdraw",
  actorId: string,
  actorName: string,
  amount: number,
  ensureEconomyAccount: EnsureEconomyAccountFn,
  note: string = ""
): TxResult<{
  transactionId: string;
  playerBalance: number;
  coopBalance: number;
}> {
  return withTransaction(db, () => {
    const coopAccount = coopAccountByCid(query, cid);
    if (!coopAccount) return { ok: false, error: "coop_account_not_found", status: 404 };
    const player = ensureEconomyAccount(actorId, actorName);
    if (!player) return { ok: false, error: "ensure_account_failed", status: 500 };
    const coopBalance = Number(coopAccount.balance ?? 0);
    if (mode === "deposit" && player.balance < amount) {
      return {
        ok: false,
        error: "insufficient_funds",
        status: 409,
        extra: { balance: player.balance },
      };
    }
    if (mode === "withdraw" && coopBalance < amount) {
      return {
        ok: false,
        error: "insufficient_coop_funds",
        status: 409,
        extra: { coopBalance },
      };
    }
    const now = nowMs();
    const delta = mode === "deposit" ? amount : -amount;
    const tx = newTxId(now);
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance - ${delta}, version = version + 1, updated_at = ${now}
          WHERE player_id = ${actorId}`
    );
    query(
      SQL`UPDATE ${TABLE_COOP_ACCOUNT}
          SET balance = balance + ${delta}, version = version + 1, updated_at = ${now}
          WHERE cid = ${cid}`
    );
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${tx}, ${`coop.${mode}`}, ${actorId},
                  ${mode === "deposit" ? actorId : null},
                  ${mode === "deposit" ? null : actorId},
                  ${amount}, ${player.balance}, ${player.balance - delta},
                  ${"coop"}, ${cid},
                  ${`合作社${mode === "deposit" ? "存款" : "取款"}`},
                  ${now})`
    );
    query(
      SQL`INSERT INTO ${TABLE_BANK_LOG}
          (cid, actor_id, actor_name_snapshot, type, amount, note, transaction_id, created_at)
          VALUES (${cid}, ${actorId}, ${actorName},
                  ${mode === "deposit" ? 1 : 2},
                  ${amount}, ${note}, ${tx}, ${now})`
    );
    return {
      ok: true,
      data: {
        transactionId: tx,
        playerBalance: player.balance - delta,
        coopBalance: coopBalance + delta,
      },
    };
  });
}

/** 更新合作社 metadata (name / notice)。动态 SET 子句通过 append() 拼接 */
export function updateCoopMeta(query: AnyQuery, cid: string, patch: { name?: string; notice?: string }): void {
  const stmt = SQL`UPDATE ${TABLE_COOP} SET version = version + 1, updated_at = ${nowMs()}`;
  if (patch.name !== undefined) {
    stmt.append(SQL`, name = ${patch.name}`);
  }
  if (patch.notice !== undefined) {
    stmt.append(SQL`, notice = ${patch.notice}`);
  }
  stmt.append(SQL` WHERE cid = ${cid} AND status = 'active'`);
  query(stmt);
}

/** 更新合作社成员 role 或加入 */
export function addCoopMember(query: AnyQuery, cid: string, playerId: string, playerName: string, role: string): void {
  query(
    SQL`INSERT INTO ${TABLE_MEMBERS}
        (cid, player_id, player_name_snapshot, role, joined_at)
        VALUES (${cid}, ${playerId}, ${playerName}, ${role}, ${nowMs()})`
  );
}

export function setCoopMemberRole(query: AnyQuery, cid: string, playerId: string, role: string): void {
  query(
    SQL`UPDATE ${TABLE_MEMBERS}
        SET role = ${role}, version = version + 1
        WHERE cid = ${cid} AND player_id = ${playerId} AND role <> 'owner'`
  );
}

export function leaveCoop(query: AnyQuery, cid: string, playerId: string): void {
  query(
    SQL`UPDATE ${TABLE_MEMBERS}
        SET status = 'removed', version = version + 1
        WHERE cid = ${cid} AND player_id = ${playerId}`
  );
}

/** 通过 player_id 移除合作社成员（owner 受保护，不能被剔除） */
export function removeCoopMember(query: AnyQuery, cid: string, playerId: string): void {
  query(
    SQL`UPDATE ${TABLE_MEMBERS}
        SET status = 'removed', version = version + 1
        WHERE cid = ${cid} AND player_id = ${playerId} AND role <> 'owner'`
  );
  query(
    SQL`UPDATE ${TABLE_COOP}
        SET updated_at = ${nowMs()}, version = version + 1
        WHERE cid = ${cid}`
  );
}

export function revokeCoopInvite(query: AnyQuery, cid: string, inviteId: string): void {
  query(SQL`UPDATE ${TABLE_INVITES} SET status = 'revoked' WHERE id = ${inviteId} AND cid = ${cid}`);
}

export function declineCoopInvite(query: AnyQuery, inviteId: string, inviteeId: string): void {
  query(
    SQL`UPDATE ${TABLE_INVITES}
        SET status = 'declined'
        WHERE id = ${inviteId} AND invitee_id = ${inviteeId} AND status = 'pending'`
  );
}

/** 解散合作社（事务） */
export function dissolveCoopTx(
  query: AnyQuery,
  db: DatabaseSync,
  cid: string,
  actorId: string,
  beforeState: { coop: Record<string, unknown>; account: Record<string, unknown> | null; stock: number }
): TxResult<{ transactionId: string }> {
  return withTransaction(db, () => {
    const now = nowMs();
    const tx = newTxId(now);
    query(
      SQL`UPDATE ${TABLE_COOP}
          SET status = 'dissolved', updated_at = ${now}, version = version + 1
          WHERE cid = ${cid} AND status = 'active'`
    );
    query(
      SQL`UPDATE ${TABLE_MEMBERS}
          SET status = 'removed', version = version + 1
          WHERE cid = ${cid} AND status = 'active'`
    );
    query(
      SQL`INSERT INTO ${TABLE_AUDIT}
          (cid, actor_id, action, before_state, after_state, transaction_id, created_at)
          VALUES (${cid}, ${actorId}, ${"coop.dissolve"},
                  ${JSON.stringify(beforeState)},
                  ${JSON.stringify({ status: "dissolved" })},
                  ${tx}, ${now})`
    );
    return { ok: true, data: { transactionId: tx } };
  });
}

/** 商店买入（事务 + 幂等回放） */
export function coopShopBuyTx(
  query: AnyQuery,
  db: DatabaseSync,
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number,
  idempotencyKey: string,
  ensureEconomyAccount: EnsureEconomyAccountFn
): TxResult<{
  transactionId: string;
  quantity: number;
  itemType: string;
  itemAux: number;
  itemNbt: string;
  total: number;
  balance: number;
  balanceVersion: number;
  stockRemaining: number;
  replayed?: boolean;
}> {
  return withTransaction(db, () => {
    if (idempotencyKey) {
      const prev = query(
        SQL`SELECT response_json FROM ${TABLE_IDEMPOTENCY}
            WHERE actor_id = ${actorId} AND idempotency_key = ${idempotencyKey}`
      ) as Array<{ response_json: string }>;
      if (prev[0]) {
        const replay = JSON.parse(prev[0].response_json);
        return { ok: true, data: { ...(replay as Record<string, unknown>), replayed: true } as never };
      }
    }
    const listingRows = query(
      SQL`SELECT * FROM ${TABLE_SHOP_ITEMS} WHERE id = ${listingId} AND cid = ${cid} AND type = 1`
    ) as Array<Record<string, unknown>>;
    const listing = listingRows[0];
    if (!listing) return { ok: false, error: "listing_not_found", status: 404 };
    const available = Number(listing.num ?? 0) - Number(listing.sv ?? 0);
    if (available < quantity) {
      return {
        ok: false,
        error: "insufficient_stock",
        status: 409,
        extra: { available },
      };
    }
    const total = Number(listing.money ?? 0) * quantity;
    if (total <= 0) return { ok: false, error: "invalid_price", status: 400 };
    const srcAccount = ensureEconomyAccount(actorId, actorName);
    if (!srcAccount || srcAccount.balance < total) {
      return {
        ok: false,
        error: "insufficient_funds",
        status: 409,
        extra: { balance: srcAccount?.balance ?? 0 },
      };
    }
    const now = nowMs();
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance - ${total}, version = version + 1, updated_at = ${now}
          WHERE player_id = ${actorId} AND balance >= ${total}`
    );
    query(
      SQL`UPDATE ${TABLE_COOP_ACCOUNT}
          SET balance = balance + ${total}, version = version + 1, updated_at = ${now}
          WHERE cid = ${cid}`
    );
    query(
      SQL`UPDATE ${TABLE_SHOP_ITEMS}
          SET num = num - ${quantity}, sv = sv + ${quantity}, updated_at = ${now}
          WHERE id = ${listingId} AND cid = ${cid}`
    );
    const tx = newTxId(now);
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${`${tx}-dr`}, ${"coop.shop.buy.dr"}, ${actorId}, ${actorId}, ${null},
                  ${total}, ${srcAccount.balance}, ${srcAccount.balance - total},
                  ${"coop.shop"}, ${listingId},
                  ${`购买 ${String(listing.name)}*${quantity}`}, ${now})`
    );
    query(
      SQL`INSERT INTO ${TABLE_AUDIT}
          (cid, actor_id, action, before_state, after_state, transaction_id, created_at)
          VALUES (${cid}, ${actorId}, ${"shop.buy"},
                  ${JSON.stringify({ listingId, quantity })},
                  ${JSON.stringify({
                    num: Number(listing.num ?? 0) - quantity,
                    sv: Number(listing.sv ?? 0) + quantity,
                  })},
                  ${tx}, ${now})`
    );
    const srcFinal = ensureEconomyAccount(actorId, actorName);
    const response: Record<string, unknown> = {
      transactionId: tx,
      quantity,
      itemType: String(listing.item_type ?? ""),
      itemAux: Number(listing.item_aux ?? 0),
      itemNbt: String(listing.item_nbt ?? ""),
      total,
      balance: srcFinal?.balance ?? 0,
      balanceVersion: srcFinal?.version ?? 0,
      stockRemaining: Number(listing.num ?? 0) - quantity,
    };
    if (idempotencyKey) {
      query(
        SQL`INSERT INTO ${TABLE_IDEMPOTENCY}
            (actor_id, idempotency_key, transaction_id, response_json, created_at)
            VALUES (${actorId}, ${idempotencyKey}, ${tx},
                    ${JSON.stringify(response)}, ${now})`
      );
    }
    return { ok: true, data: response as never };
  });
}

/** 商店卖出（事务 + 幂等回放） */
export function coopShopSellTx(
  query: AnyQuery,
  db: DatabaseSync,
  cid: string,
  actorId: string,
  actorName: string,
  listingId: string,
  quantity: number,
  idempotencyKey: string,
  ensureEconomyAccount: EnsureEconomyAccountFn
): TxResult<{
  transactionId: string;
  quantity: number;
  total: number;
  balance: number;
  balanceVersion: number;
  stockRemaining: number;
  replayed?: boolean;
}> {
  return withTransaction(db, () => {
    if (idempotencyKey) {
      const prev = query(
        SQL`SELECT response_json FROM ${TABLE_IDEMPOTENCY}
            WHERE actor_id = ${actorId} AND idempotency_key = ${idempotencyKey}`
      ) as Array<{ response_json: string }>;
      if (prev[0]) {
        const replay = JSON.parse(prev[0].response_json);
        return { ok: true, data: { ...(replay as Record<string, unknown>), replayed: true } as never };
      }
    }
    const listingRows = query(
      SQL`SELECT * FROM ${TABLE_SHOP_ITEMS} WHERE id = ${listingId} AND cid = ${cid} AND type = 2`
    ) as Array<Record<string, unknown>>;
    const listing = listingRows[0];
    if (!listing) return { ok: false, error: "listing_not_found", status: 404 };
    const remaining = Number(listing.num ?? 0) - Number(listing.sv ?? 0);
    if (remaining < quantity) {
      return {
        ok: false,
        error: "capacity_exceeded",
        status: 409,
        extra: { remaining },
      };
    }
    const total = Number(listing.money ?? 0) * quantity;
    const coopAcc = coopAccountByCid(query, cid);
    const coopBalance = Number(coopAcc?.balance ?? 0);
    if (!coopAcc || coopBalance < total) {
      return {
        ok: false,
        error: "insufficient_coop_funds",
        status: 409,
        extra: { coopBalance },
      };
    }
    const tgtAccount = ensureEconomyAccount(actorId, actorName);
    if (!tgtAccount) return { ok: false, error: "ensure_account_failed", status: 500 };

    const now = nowMs();
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance + ${total}, version = version + 1, updated_at = ${now}
          WHERE player_id = ${actorId}`
    );
    query(
      SQL`UPDATE ${TABLE_COOP_ACCOUNT}
          SET balance = balance - ${total}, version = version + 1, updated_at = ${now}
          WHERE cid = ${cid}`
    );
    query(
      SQL`UPDATE ${TABLE_SHOP_ITEMS}
          SET sv = sv + ${quantity}, updated_at = ${now}
          WHERE id = ${listingId} AND cid = ${cid}`
    );
    const tx = newTxId(now);
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${`${tx}-cr`}, ${"coop.shop.sell.cr"}, ${actorId}, ${null}, ${actorId},
                  ${total}, ${tgtAccount.balance}, ${tgtAccount.balance + total},
                  ${"coop.shop"}, ${listingId},
                  ${`出售 ${String(listing.name)}*${quantity}`}, ${now})`
    );
    query(
      SQL`INSERT INTO ${TABLE_AUDIT}
          (cid, actor_id, action, before_state, after_state, transaction_id, created_at)
          VALUES (${cid}, ${actorId}, ${"shop.sell"},
                  ${JSON.stringify({ listingId, quantity })},
                  ${JSON.stringify({ sv: Number(listing.sv ?? 0) + quantity })},
                  ${tx}, ${now})`
    );
    const tgtFinal = ensureEconomyAccount(actorId, actorName);
    const response: Record<string, unknown> = {
      transactionId: tx,
      quantity,
      total,
      balance: tgtFinal?.balance ?? 0,
      balanceVersion: tgtFinal?.version ?? 0,
      stockRemaining: Number(listing.num ?? 0) - (Number(listing.sv ?? 0) + quantity),
    };
    if (idempotencyKey) {
      query(
        SQL`INSERT INTO ${TABLE_IDEMPOTENCY}
            (actor_id, idempotency_key, transaction_id, response_json, created_at)
            VALUES (${actorId}, ${idempotencyKey}, ${tx},
                    ${JSON.stringify(response)}, ${now})`
      );
    }
    return { ok: true, data: response as never };
  });
}

