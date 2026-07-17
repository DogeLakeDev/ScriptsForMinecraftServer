/**
 * routes/coops.ts — 合作社路由（薄层）
 *
 * 所有 BEGIN IMMEDIATE / COMMIT / ROLLBACK 及裸 SQL 都已下沉到 domain/coops.ts。
 * 本文件只负责请求解析 → 调用领域函数 → 序列化响应。
 */

import type { DatabaseSync } from "node:sqlite";

import type { QueryFn } from "../lib/sqlite.js";
import { json } from "./_shared.js";
import { SQL } from "sql-template-strings";

import {
  acceptCoopInviteTx,
  addCoopMember,
  coopCanAct,
  coopShopBuyTx,
  coopShopSellTx,
  coopSnapshot,
  coopTreasuryTx,
  createCoopInvite,
  createCoopTx,
  deleteShopMemberByName,
  dissolveCoopTx,
  findCoopByCid,
  findCoopByOwner,
  hasActiveCoopMembership,
  leaveCoop,
  listAuditLogs,
  listBankLog,
  listCoopMembers,
  listCoops,
  listShopItems,
  listPendingInvitesForInvitee,
  listShopGroups,
  roleOf,
  setCoopMemberRole,
  updateCoopMeta,
  upsertBankLog,
  upsertShopGroup,
  upsertShopItem,
  TABLE_COOP,
  TABLE_COOP_ACCOUNT,
  TABLE_INVITES,
  TABLE_MEMBERS,
  TABLE_SHOP_ITEMS,
} from "../domain/coops.js";

interface CoopDeps {
  query: QueryFn;
  db: DatabaseSync;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  ensureEconomyAccount: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number } | undefined;
  /** 兼容 index.ts 旧装配 —— 路由层已不再直接使用 */
  economyResult?: (account: unknown) => { balance: number; version: number } | null;
}

const ISO_KEY_REGEX = /^[A-Za-z0-9_.:-]{1,128}$/;

function txFailure(
  res: import("http").ServerResponse,
  result: { ok: false; error: string; status: number; extra?: Record<string, unknown> }
): void {
  const payload: Record<string, unknown> = { ok: false, error: result.error };
  if (result.extra) Object.assign(payload, result.extra);
  json(res, payload, result.status);
}

function createCoopsRoutes(deps: CoopDeps) {
  const { query, db, body: readBody, json: writeJson } = deps;
  const ensureEconomyAccount = deps.ensureEconomyAccount;

  return async function handle({
    path,
    method,
    params,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    // ─── POST /api/sfmc/coops/create ─────────────────────────────
    if (path === "/api/sfmc/coops/create" && method === "POST") {
      const data = await readBody(req);
      const result = createCoopTx(query, db, data, ensureEconomyAccount);
      if (!result.ok) {
        txFailure(res, result);
        return true;
      }
      // 返回最新合作社视图
      const snap = coopSnapshot(query, result.data.cid);
      writeJson(res, {
        ok: true,
        coop: snap.coop,
        transactionId: result.data.transactionId,
        balance: result.data.balance,
      });
      return true;
    }

    // ─── GET /api/sfmc/coops/by-player/:playerId ─────────────────
    if (path.startsWith("/api/sfmc/coops/by-player/") && method === "GET") {
      const playerId = decodeURIComponent(path.slice("/api/sfmc/coops/by-player/".length));
      const coop = findCoopByOwner(query, playerId);
      writeJson(res, { coop: coop ?? null });
      return true;
    }

    // ─── 主要路由: /api/sfmc/coops/:cid/... ─────────────────────
    if (path.startsWith("/api/sfmc/coops/") &&
        !path.includes("/shop_items") && !path.includes("/shop_groups")) {
      const parts = path.slice("/api/sfmc/coops/".length).split("/");
      const cid = decodeURIComponent(parts[0] ?? "");
      const sub = parts[1];
      const subId = parts[2];

      // GET  /api/sfmc/coops/:cid              snapshot
      if (!sub && method === "GET") {
        if (!cid) return notFound(res, writeJson);
        writeJson(res, { ok: true, coop: coopSnapshot(query, cid) });
        return true;
      }
      // GET  /api/sfmc/coops/:cid/members
      if (sub === "members" && method === "GET") {
        writeJson(res, { ok: true, members: listCoopMembers(query, cid) });
        return true;
      }
      // GET  /api/sfmc/coops/:cid/invites?playerId=...
      if (sub === "invites" && method === "GET") {
        const inviteeId = String(params.get("playerId") ?? "");
        writeJson(res, {
          ok: true,
          invites: listPendingInvitesForInvitee(query, cid, inviteeId),
        });
        return true;
      }
      // POST /api/sfmc/coops/:cid/invites
      if (sub === "invites" && !subId && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        const inviteeId = String(data.playerId ?? "");
        const role = String(data.role ?? "member");
        if (!coopCanAct(query, cid, actorId, "manage_members") || !inviteeId || !["admin", "member"].includes(role)) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        if (hasActiveCoopMembership(query, inviteeId)) {
          writeJson(res, { ok: false, error: "already_member" }, 409);
          return true;
        }
        const now = Date.now();
        const { inviteId } = createCoopInvite(
          query,
          cid,
          actorId,
          inviteeId,
          String(data.playerName ?? ""),
          role as "admin" | "member",
          now + 7 * 86400000,
          now
        );
        const rows = (query)(SQL`SELECT * FROM ${TABLE_INVITES} WHERE id = ${inviteId}`);
        const rowList = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
        writeJson(res, { ok: true, invite: rowList[0] ?? { id: inviteId } });
        return true;
      }

      // POST /api/sfmc/coops/:cid/invites/:inviteId/accept
      if (sub === "invites" && subId === "accept" && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        const result = acceptCoopInviteTx(
          query,
          db,
          cid,
          String(data.inviteId ?? ""),
          actorId,
          String(data.playerName ?? "")
        );
        if (!result.ok) {
          txFailure(res, result);
          return true;
        }
        writeJson(res, { ok: true, coop: result.data.snapshot });
        return true;
      }

      // GET  /api/sfmc/coops/:cid/audit
      if (sub === "audit" && method === "GET") {
        const actorId = String(params.get("actorId") ?? "");
        const coop = findCoopByCid(query, cid);
        const isOwner = coop && actorId && String(coop.owner_player_id) === actorId;
        if (actorId && !isOwner && !coopCanAct(query, cid, actorId, "audit")) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        writeJson(res, { ok: true, logs: listAuditLogs(query, cid) });
        return true;
      }

      // POST /api/sfmc/coops/:cid/members/join
      if (sub === "members" && subId === "join" && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        if (!actorId || actorId !== String(data.playerId ?? "")) {
          writeJson(res, { ok: false, error: "invalid_actor" }, 400);
          return true;
        }
        if (hasActiveCoopMembership(query, actorId)) {
          writeJson(res, { ok: false, error: "already_member" }, 409);
          return true;
        }
        addCoopMember(query, cid, actorId, String(data.playerName ?? ""), "member");
        writeJson(res, { ok: true, coop: coopSnapshot(query, cid) });
        return true;
      }

      // POST /api/sfmc/coops/:cid/members/leave
      if (sub === "members" && subId === "leave" && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        const role = roleOf(query, cid, actorId);
        if (!role || role === "owner") {
          writeJson(res, { ok: false, error: role === "owner" ? "owner_cannot_leave" : "not_member" }, 409);
          return true;
        }
        leaveCoop(query, cid, actorId);
        writeJson(res, { ok: true });
        return true;
      }

      // POST /api/sfmc/coops/:cid/members
      if (sub === "members" && !subId && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        const targetId = String(data.playerId ?? "");
        if (!coopCanAct(query, cid, actorId, "manage_members")) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        if (!targetId) {
          writeJson(res, { ok: false, error: "invalid_target" }, 400);
          return true;
        }
        if (hasActiveCoopMembership(query, targetId)) {
          writeJson(res, { ok: false, error: "already_member" }, 409);
          return true;
        }
        addCoopMember(query, cid, targetId, String(data.playerName ?? ""), "member");
        writeJson(res, { ok: true, coop: coopSnapshot(query, cid) });
        return true;
      }

      // PUT  /api/sfmc/coops/:cid/members/:playerId
      if (sub === "members" && subId && method === "PUT") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        if (!coopCanAct(query, cid, actorId, "manage_members") || !["admin", "member"].includes(String(data.role ?? ""))) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        setCoopMemberRole(query, cid, decodeURIComponent(subId), String(data.role));
        writeJson(res, { ok: true, coop: coopSnapshot(query, cid) });
        return true;
      }

      // POST /api/sfmc/coops/:cid/treasury/{deposit|withdraw}
      if (sub === "treasury" && (subId === "deposit" || subId === "withdraw") && method === "POST") {
        const data = await readBody(req);
        const actorId = String(data.actorId ?? "");
        if (!coopCanAct(query, cid, actorId, subId ?? "")) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        const amount = Number(data.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          writeJson(res, { ok: false, error: "invalid_transaction" }, 400);
          return true;
        }
        const result = coopTreasuryTx(
          query,
          db,
          cid,
          subId,
          actorId,
          String(data.actorName ?? ""),
          amount,
          ensureEconomyAccount,
          String(data.note ?? "")
        );
        if (!result.ok) {
          txFailure(res, result);
          return true;
        }
        writeJson(res, {
          ok: true,
          transactionId: result.data.transactionId,
          playerBalance: result.data.playerBalance,
          coopBalance: result.data.coopBalance,
        });
        return true;
      }

      // PUT  /api/sfmc/coops/:cid              更新 name/notice
      if (!sub && method === "PUT") {
        const data = await readBody(req);
        if (!coopCanAct(query, cid, String(data.actorId ?? ""), "manage_notice")) {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        updateCoopMeta(query, cid, {
          ...(data.name !== undefined ? { name: String(data.name) } : {}),
          ...(data.notice !== undefined ? { notice: String(data.notice) } : {}),
        });
        writeJson(res, { ok: true, coop: coopSnapshot(query, cid) });
        return true;
      }

      // DELETE /api/sfmc/coops/:cid            解散
      if (!sub && method === "DELETE") {
        const data = await readBody(req);
        if (roleOf(query, cid, String(data.actorId ?? "")) !== "owner") {
          writeJson(res, { ok: false, error: "forbidden" }, 403);
          return true;
        }
        const coop = findCoopByCid(query, cid);
        if (!coop) {
          writeJson(res, { ok: false, error: "not_found" }, 404);
          return true;
        }
        const account = (query)(SQL`SELECT balance FROM ${TABLE_COOP_ACCOUNT} WHERE cid = ${cid}`) as Array<{ balance: number }>;
        const stockRows = (query)(SQL`SELECT SUM(num) AS total FROM ${TABLE_SHOP_ITEMS} WHERE cid = ${cid} AND type = 1`) as Array<{ total: number | null }>;
        const balance = Number(account[0]?.balance ?? 0);
        const stock = Number(stockRows[0]?.total ?? 0) || 0;
        if (balance !== 0 || stock !== 0) {
          writeJson(res, { ok: false, error: "assets_not_empty" }, 409);
          return true;
        }
        const result = dissolveCoopTx(query, db, cid, String(data.actorId), {
          coop,
          account: account[0] ?? null,
          stock,
        });
        if (!result.ok) {
          txFailure(res, result);
          return true;
        }
        writeJson(res, { ok: true, transactionId: result.data.transactionId });
        return true;
      }
      return notFound(res, writeJson);
    }

    // ─── GET/POST /api/sfmc/coops ───────────────────────────────
    if (path === "/api/sfmc/coops") {
      if (method === "GET") {
        writeJson(res, { coops: listCoops(query) });
        return true;
      }
      if (method === "POST") {
        writeJson(res, { ok: false, error: "legacy_route_disabled" }, 410);
        return true;
      }
      writeJson(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    // ─── /api/sfmc/coops/:cid (legacy) ──────────────────────────
    if (path.startsWith("/api/sfmc/coops/")) {
      const parts = path.slice("/api/sfmc/coops/".length).split("/");
      const cid = parts[0] ?? "";
      const sub = parts[1];
      const subId = parts[2];
      if (!cid) {
        writeJson(res, { success: false, error: "invalid" }, 400);
        return true;
      }
      // GET  /api/sfmc/coops/:cid  (legacy with members + shop_items)
      if (!sub && method === "GET") {
        const rows = (query)(SQL`SELECT * FROM ${TABLE_COOP} WHERE cid = ${cid}`) as Array<Record<string, unknown>>;
        if (rows.length === 0) {
          writeJson(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        const coop = rows[0];
        (coop as Record<string, unknown>).members = (query)(SQL`SELECT * FROM ${TABLE_MEMBERS} WHERE cid = ${cid}`);
        (coop as Record<string, unknown>).shop_items = (query)(SQL`SELECT * FROM ${TABLE_SHOP_ITEMS} WHERE cid = ${cid}`);
        writeJson(res, { coop });
        return true;
      }
      if (!sub && (method === "PUT" || method === "DELETE")) {
        writeJson(res, { ok: false, error: "legacy_route_disabled" }, 410);
        return true;
      }
      // members (legacy form, by player_name)
      if (sub === "members") {
        if (method === "GET") {
          writeJson(res, { members: listCoopMembers(query, cid) });
          return true;
        }
        if (method === "POST") {
          const data = await readBody(req);
          const player_name = String(data.player_name ?? "");
          const is_op = !!data.is_op;
          if (!player_name) {
            writeJson(res, { success: false, error: "player_name required" }, 400);
            return true;
          }
          (query)(SQL`INSERT OR REPLACE INTO ${TABLE_MEMBERS} (cid, player_name, is_op, joined_at) VALUES (${cid}, ${player_name}, ${is_op ? 1 : 0}, ${Date.now()})`);
          writeJson(res, { success: true });
          return true;
        }
        if (method === "DELETE" && subId) {
          deleteShopMemberByName(query, cid, decodeURIComponent(subId));
          writeJson(res, { success: true });
          return true;
        }
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      // shop_items (legacy form)
      if (sub === "shop_items") {
        if (method === "GET") {
          const typeStr = params.get("type") || "";
          const type = typeStr ? parseInt(typeStr, 10) : undefined;
          writeJson(res, { items: listShopItems(query, cid, type) });
          return true;
        }
        if (method === "POST") {
          const item = await readBody(req);
          if (!item.id) {
            writeJson(res, { success: false, error: "id required" }, 400);
            return true;
          }
          upsertShopItem(query, { ...item, cid });
          writeJson(res, { success: true });
          return true;
        }
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      // shop/{buy|sell}
      if (sub === "shop") {
        if (subId === "buy" && method === "POST") {
          const data = await readBody(req);
          const actorId = String(data.actorId ?? "").trim();
          const actorName = String(data.actorName ?? "").trim();
          const listingId = String(data.listingId ?? "").trim();
          const quantity = parseInt(String(data.quantity ?? ""), 10) || 0;
          const idempotencyKey = data.idempotencyKey ? String(data.idempotencyKey).trim() : "";
          if (!actorId || !listingId || quantity <= 0) {
            writeJson(res, { ok: false, error: "invalid_params" }, 400);
            return true;
          }
          if (idempotencyKey && !ISO_KEY_REGEX.test(idempotencyKey)) {
            writeJson(res, { ok: false, error: "invalid_idempotency_key" }, 400);
            return true;
          }
          if (!roleOf(query, cid, actorId)) {
            writeJson(res, { ok: false, error: "not_member" }, 403);
            return true;
          }
          const result = coopShopBuyTx(
            query,
            db,
            cid,
            actorId,
            actorName,
            listingId,
            quantity,
            idempotencyKey,
            ensureEconomyAccount
          );
          if (!result.ok) {
            txFailure(res, result);
            return true;
          }
          writeJson(res, { ok: true, ...result.data });
          return true;
        }
        if (subId === "sell" && method === "POST") {
          const data = await readBody(req);
          const actorId = String(data.actorId ?? "").trim();
          const actorName = String(data.actorName ?? "").trim();
          const listingId = String(data.listingId ?? "").trim();
          const quantity = parseInt(String(data.quantity ?? ""), 10) || 0;
          const idempotencyKey = data.idempotencyKey ? String(data.idempotencyKey).trim() : "";
          if (!actorId || !listingId || quantity <= 0) {
            writeJson(res, { ok: false, error: "invalid_params" }, 400);
            return true;
          }
          if (idempotencyKey && !ISO_KEY_REGEX.test(idempotencyKey)) {
            writeJson(res, { ok: false, error: "invalid_idempotency_key" }, 400);
            return true;
          }
          if (!roleOf(query, cid, actorId)) {
            writeJson(res, { ok: false, error: "not_member" }, 403);
            return true;
          }
          const result = coopShopSellTx(
            query,
            db,
            cid,
            actorId,
            actorName,
            listingId,
            quantity,
            idempotencyKey,
            ensureEconomyAccount
          );
          if (!result.ok) {
            txFailure(res, result);
            return true;
          }
          writeJson(res, { ok: true, ...result.data });
          return true;
        }
        writeJson(res, { ok: false, error: "not_found" }, 404);
        return true;
      }
      // bank_log
      if (sub === "bank_log") {
        if (method === "GET") {
          writeJson(res, { log: listBankLog(query, cid) });
          return true;
        }
        if (method === "POST") {
          const data = await readBody(req);
          const player_name = String(data.player_name ?? "");
          const type = String(data.type ?? "");
          const amount = data.amount;
          if (!player_name || !amount) {
            writeJson(res, { success: false, error: "invalid" }, 400);
            return true;
          }
          upsertBankLog(query, cid, player_name, type, Number(amount), String(data.note ?? ""));
          writeJson(res, { success: true });
          return true;
        }
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      writeJson(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    // ─── GET/POST /api/sfmc/coop_shop_groups ────────────────────
    if (path === "/api/sfmc/coop_shop_groups") {
      if (method === "GET") {
        writeJson(res, { groups: listShopGroups(query) });
        return true;
      }
      if (method === "POST") {
        const data = await readBody(req);
        const group = data.group as Record<string, unknown> | undefined;
        if (!group?.groupid) {
          writeJson(res, { success: false, error: "groupid required" }, 400);
          return true;
        }
        upsertShopGroup(query, group);
        writeJson(res, { success: true });
        return true;
      }
      writeJson(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    return false;
  };
}

function notFound(res: import("http").ServerResponse, writeJson: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void): boolean {
  writeJson(res, { success: false, error: "not_found" }, 404);
  return true;
}

export { createCoopsRoutes };
