/**
 * routes/lands.ts — 领地路由（薄层）
 *
 * 所有 BEGIN IMMEDIATE / COMMIT / ROLLBACK 与裸 SQL 都已下沉到 domain/land.ts。
 * 本文件只负责请求解析 → 调用领域函数 → 序列化响应。
 */

import type { QueryFn } from "../lib/sqlite.js";

import {
  acceptLandInvite,
  auditLand,
  canManageLand,
  canManageMember,
  collectLandTaxTx,
  createLandInvite,
  createLandTransaction,
  declineLandInvite,
  deleteLandTx,
  expirePendingInvitesForInvitee,
  findInviteById,
  findInviteByIdAnyStatus,
  findInviteByIdForLand,
  findLandAt,
  findLandById,
  getMemberRole,
  listActiveInvitesForInvitee,
  listActiveLands,
  listActiveLandsByOwner,
  listLandAudit,
  mapLandRow,
  removeLandMember,
  revokeLandInvite,
  setLandMemberRole,
  transferLandTx,
  updateLandMeta,
  validateLandInput,
} from "../domain/land.js";

interface LandDeps {
  query: QueryFn;
  db: { exec: (sql: string) => void };
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  projectRoot: string;
  ensureEconomyAccount: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number };
}

function createLandsRoutes(deps: LandDeps) {
  const { db, body: readBody, json: writeJson, projectRoot, ensureEconomyAccount } = deps;
  const query = deps.query;

  return async function handle({
    path,
    method,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    // ─── GET/POST /api/sfmc/lands ─────────────────────────────
    if (path === "/api/sfmc/lands") {
      if (method === "GET") {
        writeJson(res, {
          lands: listActiveLands(query).map((row) => mapLandRow(query, row)),
        });
        return true;
      }
      if (method === "POST") {
        const result = createLandTransaction(query, db, await readBody(req), projectRoot, ensureEconomyAccount);
        if (!result.ok) {
          writeJson(res, result, (result.status as number) || 400);
          return true;
        }
        writeJson(res, {
          success: true,
          land: result.land,
          price: result.price,
          balance: result.balance,
          balanceVersion: result.balanceVersion,
          transactionId: result.transactionId,
          replayed: result.replayed,
        });
        return true;
      }
      writeJson(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    // ─── GET /api/sfmc/lands/validate ─────────────────────────
    if (path === "/api/sfmc/lands/validate" && method === "GET") {
      const result = validateLandInput(query, {} as Record<string, unknown>, projectRoot);
      writeJson(res, result, result.ok ? 200 : (result.status as number) || 400);
      return true;
    }

    // ─── GET /api/sfmc/lands/by-owner/:ownerId ────────────────
    if (path.startsWith("/api/sfmc/lands/by-owner/") && method === "GET") {
      const ownerId = decodeURIComponent(path.slice("/api/sfmc/lands/by-owner/".length));
      writeJson(res, {
        lands: listActiveLandsByOwner(query, ownerId).map((row) => mapLandRow(query, row)),
      });
      return true;
    }

    // ─── /api/sfmc/lands/invites/:inviteeId/... ───────────────
    if (path.startsWith("/api/sfmc/lands/invites/")) {
      const tail = path.slice("/api/sfmc/lands/invites/".length).split("/");
      const inviteeId = decodeURIComponent(tail[0] ?? "");
      const action = tail[1];
      if (action === "decline" && method === "POST") {
        const data = await readBody(req);
        const invite = findInviteByIdAnyStatus(
          query,
          String(data.inviteId ?? ""),
          inviteeId
        );
        if (!invite) {
          writeJson(res, { success: false, error: "invite_not_found" }, 404);
          return true;
        }
        declineLandInvite(query, inviteeId, String(invite.id));
        auditLand(query, String(invite.land_id), inviteeId, "invite.decline", {
          inviteId: invite.id,
        });
        writeJson(res, { success: true });
        return true;
      }
      if (!action && method === "GET") {
        expirePendingInvitesForInvitee(query, inviteeId);
        writeJson(res, { invites: listActiveInvitesForInvitee(query, inviteeId) });
        return true;
      }
      if (!action && method === "POST") {
        const data = await readBody(req);
        const invite = findInviteById(query, String(data.inviteId ?? ""), inviteeId);
        if (!invite) {
          writeJson(res, { success: false, error: "invite_not_found" }, 404);
          return true;
        }
        const land = findLandById(query, String(invite.land_id));
        if (!land || land.status !== "active") {
          writeJson(res, { success: false, error: "not_found" }, 404);
          return true;
        }
        const accepted = acceptLandInvite(query, invite, inviteeId, String(data.playerName ?? inviteeId));
        if (!accepted) {
          writeJson(res, { success: false, error: "invite_accept_failed" }, 500);
          return true;
        }
        auditLand(query, String(invite.land_id), inviteeId, "invite.accept", {
          inviteId: invite.id,
          role: invite.role,
        });
        writeJson(res, { success: true, land: mapLandRow(query, accepted) });
        return true;
      }
    }

    // ─── /api/sfmc/lands/:id/members (POST/DELETE) ────────────
    if (path.startsWith("/api/sfmc/lands/") && path.endsWith("/members")) {
      const id = decodeURIComponent(path.slice("/api/sfmc/lands/".length, -"/members".length));
      const data = await readBody(req);
      const land = findLandById(query, id);
      if (!land || land.status !== "active") {
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      if (method === "POST") {
        const actorId = String(data.actorId ?? "");
        const targetId = String(data.playerId ?? "");
        if (
          !actorId ||
          !targetId ||
          !canManageMember(query, id, actorId, String(data.role ?? "builder"))
        ) {
          writeJson(res, { success: false, error: "forbidden" }, 403);
          return true;
        }
        const role = String(data.role ?? "builder");
        if (
          !["builder", "container", "visitor", "redstone", "entity", "admin"].includes(role)
        ) {
          writeJson(res, { success: false, error: "invalid_role" }, 400);
          return true;
        }
        const actorRole = getMemberRole(query, id, actorId);
        if (role === "admin" && actorRole !== "owner") {
          writeJson(res, { success: false, error: "forbidden" }, 403);
          return true;
        }
        const expiresAt =
          Date.now() + Math.min(Math.max(Number(data.ttlMs) || 86400000, 60000), 604800000);
        const inviteId = createLandInvite(query, id, actorId, targetId, role, expiresAt);
        auditLand(query, id, actorId, "member.invite", {
          inviteId,
          playerId: targetId,
          role,
        });
        writeJson(res, { success: true, inviteId, expiresAt });
        return true;
      }
      if (method === "DELETE") {
        const actorId = String(data.actorId ?? "");
        const targetId = String(data.playerId ?? "");
        const targetRole = getMemberRole(query, id, targetId);
        if (
          !actorId ||
          !targetId ||
          !canManageMember(query, id, actorId, targetRole)
        ) {
          writeJson(res, { success: false, error: "forbidden" }, 403);
          return true;
        }
        removeLandMember(query, id, targetId);
        auditLand(query, id, actorId, "member.remove", { playerId: targetId });
        const remaining = findLandById(query, id);
        writeJson(res, { success: true, land: remaining ? mapLandRow(query, remaining) : null });
        return true;
      }
    }

    // ─── POST /api/sfmc/lands/:id/members/:playerId ───────────
    if (path.startsWith("/api/sfmc/lands/") && path.includes("/members/")) {
      const tail = path.slice("/api/sfmc/lands/".length).split("/");
      const id = decodeURIComponent(tail[0] ?? "");
      const playerId = decodeURIComponent(tail[2] ?? "");
      if (tail.length !== 3 || tail[1] !== "members" || method !== "POST") {
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      const data = await readBody(req);
      const currentRole = getMemberRole(query, id, playerId);
      if (
        !currentRole ||
        !canManageMember(query, id, String(data.actorId ?? ""), currentRole)
      ) {
        writeJson(res, { success: false, error: "forbidden" }, 403);
        return true;
      }
      const nextRole = String(data.role ?? "");
      if (
        !["builder", "container", "visitor", "redstone", "entity", "admin"].includes(nextRole)
      ) {
        writeJson(res, { success: false, error: "invalid_role" }, 400);
        return true;
      }
      const actorRole = getMemberRole(query, id, String(data.actorId ?? ""));
      if (nextRole === "admin" && actorRole !== "owner") {
        writeJson(res, { success: false, error: "forbidden" }, 403);
        return true;
      }
      setLandMemberRole(query, id, playerId, nextRole);
      auditLand(query, id, String(data.actorId), "member.role_change", {
        playerId,
        from: currentRole,
        to: nextRole,
      });
      const remaining = findLandById(query, id);
      writeJson(res, { success: true, land: remaining ? mapLandRow(query, remaining) : null });
      return true;
    }

    // ─── POST /api/sfmc/lands/:id/transfer (事务) ─────────────
    if (path.startsWith("/api/sfmc/lands/") && path.endsWith("/transfer") && method === "POST") {
      const id = decodeURIComponent(path.slice("/api/sfmc/lands/".length, -"/transfer".length));
      const data = await readBody(req);
      if (!data.actorId || !data.targetId) {
        writeJson(res, { ok: false, error: "invalid_request", message: "缺少转让参数。" }, 400);
        return true;
      }
      const result = transferLandTx(query, db, { ...data, id });
      if (!result.ok) {
        writeJson(res, result, result.status);
        return true;
      }
      writeJson(res, result.data);
      return true;
    }

    // ─── DELETE /api/sfmc/lands/:id/invites/:inviteId ─────────
    if (path.startsWith("/api/sfmc/lands/") && path.includes("/invites/")) {
      const tail = path.slice("/api/sfmc/lands/".length).split("/");
      const id = decodeURIComponent(tail[0] ?? "");
      const inviteId = decodeURIComponent(tail[2] ?? "");
      if (tail.length !== 3 || tail[1] !== "invites" || method !== "DELETE") {
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      const data = await readBody(req);
      const invite = findInviteByIdForLand(query, inviteId, id);
      if (!invite || !canManageLand(query, id, String(data.actorId ?? ""))) {
        writeJson(res, { success: false, error: "forbidden" }, 403);
        return true;
      }
      revokeLandInvite(query, id, inviteId);
      auditLand(query, id, String(data.actorId ?? ""), "invite.revoke", { inviteId });
      writeJson(res, { success: true });
      return true;
    }

    // ─── GET /api/sfmc/lands/:id/audit ────────────────────────
    if (path.startsWith("/api/sfmc/lands/") && path.endsWith("/audit") && method === "GET") {
      const id = decodeURIComponent(path.slice("/api/sfmc/lands/".length, -"/audit".length));
      writeJson(res, { logs: listLandAudit(query, id) });
      return true;
    }

    // ─── GET /api/sfmc/lands/at/:dim/:x/:y/:z ─────────────────
    if (path.startsWith("/api/sfmc/lands/at/")) {
      const parts = path.slice("/api/sfmc/lands/at/".length).split("/");
      if (parts.length !== 4) {
        writeJson(res, { success: false, error: "invalid" }, 400);
        return true;
      }
      const [dimStr, xStr, yStr, zStr] = parts;
      const dim = Number(dimStr);
      const x = Number(xStr);
      const y = Number(yStr);
      const z = Number(zStr);
      const land = findLandAt(query, dim, x, y, z);
      if (!land) {
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      writeJson(res, { land: mapLandRow(query, land) });
      return true;
    }

    // ─── POST /api/sfmc/lands/at-batch ────────────────────────
    if (path === "/api/sfmc/lands/at-batch" && method === "POST") {
      const data = await readBody(req);
      if (!Array.isArray(data.points) || data.points.length > 200) {
        writeJson(res, { success: false, error: "invalid_points" }, 400);
        return true;
      }
      const results = (data.points as Array<Record<string, unknown>>).map((point) => {
        const dim = Number(point.dimid);
        const x = Number(point.x);
        const y = Number(point.y);
        const z = Number(point.z);
        if (![dim, x, y, z].every(Number.isFinite)) return null;
        const land = findLandAt(query, dim, x, y, z);
        return land ? mapLandRow(query, land) : null;
      });
      writeJson(res, { lands: results });
      return true;
    }

    // ─── POST /api/sfmc/lands/:id/tax-collect (事务) ───────────
    if (path.startsWith("/api/sfmc/lands/") && path.endsWith("/tax-collect") && method === "POST") {
      const tid = decodeURIComponent(path.slice("/api/sfmc/lands/".length, -"/tax-collect".length));
      const data = await readBody(req);
      if (!data.actorId) {
        writeJson(res, { ok: false, error: "forbidden" }, 403);
        return true;
      }
      const result = collectLandTaxTx(
        query,
        db,
        { ...data, landId: tid },
        projectRoot,
        ensureEconomyAccount
      );
      if (!result.ok) {
        writeJson(res, result, result.status);
        return true;
      }
      writeJson(res, { ok: true, ...(result.data as Record<string, unknown>) });
      return true;
    }

    // ─── /api/sfmc/lands/:id (GET/PUT/DELETE) ─────────────────
    if (path.startsWith("/api/sfmc/lands/")) {
      const id = decodeURIComponent(path.slice("/api/sfmc/lands/".length));
      const current = findLandById(query, id);
      if (!current) {
        writeJson(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      if (method === "GET") {
        writeJson(res, { land: mapLandRow(query, current) });
        return true;
      }
      if (method === "PUT") {
        const data = await readBody(req);
        if (!canManageLand(query, id, String(data.actorId ?? ""))) {
          writeJson(res, { success: false, error: "forbidden" }, 403);
          return true;
        }
        if (
          data.expectedVersion !== undefined &&
          Number(data.expectedVersion) !== Number(current.version)
        ) {
          writeJson(res, { ok: false, error: "version_conflict", message: "土地数据已更新，请刷新后重试。" }, 409);
          return true;
        }
        const patch: { nickname?: string; permissions?: Record<string, unknown> } = {};
        if (data.nickname !== undefined) patch.nickname = String(data.nickname);
        if (data.permissions !== undefined) {
          patch.permissions = (data.permissions as Record<string, unknown>) ?? {};
        }
        const r = updateLandMeta(query, id, patch);
        if (!r.ok) {
          writeJson(res, { ok: false, error: "version_conflict", message: "土地数据已更新，请刷新后重试。" }, 409);
          return true;
        }
        auditLand(query, id, String(data.actorId ?? ""), "land.update", {
          fields: Object.keys(data),
        });
        const final = findLandById(query, id);
        writeJson(res, { success: true, land: final ? mapLandRow(query, final) : null });
        return true;
      }
      if (method === "DELETE") {
        const data = await readBody(req);
        if (!data.actorId) {
          writeJson(res, { ok: false, error: "invalid_request", message: "缺少操作者。" }, 400);
          return true;
        }
        const result = deleteLandTx(query, db, { ...data, id }, ensureEconomyAccount);
        if (!result.ok) {
          writeJson(res, result, result.status);
          return true;
        }
        writeJson(res, result.data);
        return true;
      }
      writeJson(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    return false;
  };
}

export { createLandsRoutes };
