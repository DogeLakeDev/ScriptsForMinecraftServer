/**
 * routes/qq-join.ts — 入服审批状态机 + BDS 生效队列（不写 allowlist 文件）
 *
 *   GET  /api/sfmc/qq/join/settings
 *   POST /api/sfmc/qq/join/settings
 *   POST /api/sfmc/qq/join/request
 *   POST /api/sfmc/qq/join/decide
 *   GET  /api/sfmc/qq/join/pending
 *   GET  /api/sfmc/qq/join/apply-queue
 *   POST /api/sfmc/qq/join/applied
 *   POST /api/sfmc/qq/admin/kick
 *   GET  /api/sfmc/qq/admin/action-queue
 *   POST /api/sfmc/qq/admin/action-done
 */

import { randomBytes } from "node:crypto";
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

export type JoinFeatureFlags = {
  /** 入服白名单总开关 */
  allowlistEnabled: boolean;
  /** 是否需要管理员审批 */
  requireApproval: boolean;
  /**
   * 是否将 QQ 群主/群管理员视作 SFMC 管理员。
   * 仅 configs/qq_link.json 可改，API/群聊不可写。
   */
  treatGroupAdminsAsAdmins: boolean;
};

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 当前管理员 openid 列表（来自 qq_config） */
  getAdminOpenids: () => string[];
  /** 读取入服开关（应读最新 qq_config） */
  getJoinFlags: () => JoinFeatureFlags;
  /** 写回入服开关（持久化 + 内存） */
  setJoinFlags: (partial: Partial<JoinFeatureFlags>) => JoinFeatureFlags;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function isAdmin(getAdminOpenids: () => string[], openid: string): boolean {
  const list = getAdminOpenids();
  if (!openid || list.length === 0) return false;
  return list.includes(openid);
}

/** openid 在名单内，或（开关开且 bridge 声明 as_group_admin） */
function authorizeAdmin(
  getAdminOpenids: () => string[],
  getJoinFlags: () => JoinFeatureFlags,
  openid: string,
  data: Record<string, unknown>
): boolean {
  if (isAdmin(getAdminOpenids, openid)) return true;
  const asGroup =
    data.as_group_admin === true ||
    data.as_group_admin === "true" ||
    data.is_group_admin === true ||
    data.is_group_admin === "true";
  return asGroup && getJoinFlags().treatGroupAdminsAsAdmins === true;
}

function createQqJoinRoutes({ query, body, json, getAdminOpenids, getJoinFlags, setJoinFlags }: Deps) {
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
    const isJoin = path.startsWith("/api/sfmc/qq/join");
    const isAdminPath = path.startsWith("/api/sfmc/qq/admin");
    if (!isJoin && !isAdminPath) return false;

    // ── 入服开关（文件 + 机器人可改白名单/审批；群管开关只读）──
    if (path === "/api/sfmc/qq/join/settings" && method === "GET") {
      const flags = getJoinFlags();
      json(res, {
        success: true,
        allowlist_enabled: flags.allowlistEnabled,
        require_approval: flags.requireApproval,
        treat_group_admins_as_admins: flags.treatGroupAdminsAsAdmins,
      });
      return true;
    }

    if (path === "/api/sfmc/qq/join/settings" && method === "POST") {
      const data = await body(req);
      const openid = String(data.openid ?? data.decided_by ?? "").trim();
      if (
        Object.prototype.hasOwnProperty.call(data, "treat_group_admins_as_admins") ||
        Object.prototype.hasOwnProperty.call(data, "treatGroupAdminsAsAdmins")
      ) {
        json(
          res,
          {
            success: false,
            error: "immutable_field",
            note: "treat_group_admins_as_admins 只能改 configs/qq_link.json，群聊不可改",
          },
          400
        );
        return true;
      }
      if (!authorizeAdmin(getAdminOpenids, getJoinFlags, openid, data)) {
        json(res, { success: false, error: "not_admin" }, 403);
        return true;
      }
      const partial: Partial<JoinFeatureFlags> = {};
      if (Object.prototype.hasOwnProperty.call(data, "allowlist_enabled")) {
        partial.allowlistEnabled = data.allowlist_enabled === true || data.allowlist_enabled === "true";
      }
      if (Object.prototype.hasOwnProperty.call(data, "require_approval")) {
        partial.requireApproval = data.require_approval === true || data.require_approval === "true";
      }
      if (partial.allowlistEnabled === undefined && partial.requireApproval === undefined) {
        json(res, { success: false, error: "no_settings" }, 400);
        return true;
      }
      const flags = setJoinFlags(partial);
      json(res, {
        success: true,
        allowlist_enabled: flags.allowlistEnabled,
        require_approval: flags.requireApproval,
        treat_group_admins_as_admins: flags.treatGroupAdminsAsAdmins,
      });
      return true;
    }

    // ── 入服申请 ──────────────────────────────────────────
    if (path === "/api/sfmc/qq/join/request" && method === "POST") {
      const flags = getJoinFlags();
      if (!flags.allowlistEnabled) {
        json(res, { success: false, error: "join_allowlist_disabled" }, 403);
        return true;
      }
      const data = await body(req);
      const openid = String(data.openid ?? data.applicant_openid ?? "").trim();
      const playerName = String(data.player_name ?? data.name ?? "").trim();
      const backend = String(data.qq_backend ?? "official").trim() || "official";
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      if (!playerName || playerName.length > 32) {
        json(res, { success: false, error: "player_name_required" }, 400);
        return true;
      }
      const id = newId("join");
      const now = Date.now();
      const autoApproved = !flags.requireApproval;
      const status = autoApproved ? "approved" : "pending";
      if (autoApproved) {
        query(SQL`
          INSERT INTO sfmc_qq_join_requests
            (id, applicant_openid, player_name, status, qq_backend, created_at, decided_at, decided_by)
          VALUES (${id}, ${openid}, ${playerName}, ${status}, ${backend}, ${now}, ${now}, 'auto')
        `);
      } else {
        query(SQL`
          INSERT INTO sfmc_qq_join_requests
            (id, applicant_openid, player_name, status, qq_backend, created_at)
          VALUES (${id}, ${openid}, ${playerName}, ${status}, ${backend}, ${now})
        `);
      }
      const admins = getAdminOpenids();
      json(res, {
        success: true,
        id,
        player_name: playerName,
        status,
        auto_approved: autoApproved,
        admin_notify: !autoApproved && admins.length > 0,
        note: autoApproved
          ? "已关闭审批，申请已自动通过，等待 BDS 写入白名单"
          : admins.length === 0
            ? "未配置 qq_admin_openids，无法通知管理员"
            : undefined,
      });
      return true;
    }

    if (path === "/api/sfmc/qq/join/decide" && method === "POST") {
      const data = await body(req);
      const id = String(data.id ?? data.request_id ?? "").trim();
      const decision = String(data.decision ?? "").trim().toLowerCase();
      const decidedBy = String(data.decided_by ?? data.openid ?? "").trim();
      if (!id || (decision !== "approve" && decision !== "reject")) {
        json(res, { success: false, error: "id_and_decision_required" }, 400);
        return true;
      }
      if (!authorizeAdmin(getAdminOpenids, getJoinFlags, decidedBy, data)) {
        json(res, { success: false, error: "not_admin" }, 403);
        return true;
      }
      const rows = query(SQL`SELECT * FROM sfmc_qq_join_requests WHERE id = ${id} LIMIT 1`) as Array<
        Record<string, unknown>
      >;
      const row = rows[0];
      if (!row) {
        json(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      if (String(row.status) !== "pending") {
        json(res, { success: false, error: "already_decided", status: row.status }, 409);
        return true;
      }
      const next = decision === "approve" ? "approved" : "rejected";
      const now = Date.now();
      query(SQL`
        UPDATE sfmc_qq_join_requests
        SET status = ${next}, decided_at = ${now}, decided_by = ${decidedBy}
        WHERE id = ${id}
      `);
      json(res, {
        success: true,
        id,
        status: next,
        player_name: row.player_name,
        applicant_openid: row.applicant_openid,
      });
      return true;
    }

    if (path === "/api/sfmc/qq/join/pending" && method === "GET") {
      const openid = String(params.get("openid") ?? "").trim();
      if (openid) {
        const asGroup =
          params.get("as_group_admin") === "true" || params.get("is_group_admin") === "true";
        if (!authorizeAdmin(getAdminOpenids, getJoinFlags, openid, { as_group_admin: asGroup })) {
          json(res, { success: false, error: "not_admin" }, 403);
          return true;
        }
      }
      const rows = query(
        SQL`SELECT id, applicant_openid, player_name, status, created_at
            FROM sfmc_qq_join_requests WHERE status = 'pending'
            ORDER BY created_at ASC LIMIT 50`
      ) as Array<Record<string, unknown>>;
      json(res, { success: true, pending: rows });
      return true;
    }

    if (path === "/api/sfmc/qq/join/apply-queue" && method === "GET") {
      const flags = getJoinFlags();
      if (!flags.allowlistEnabled) {
        json(res, { success: true, queue: [], note: "join_allowlist_disabled" });
        return true;
      }
      const rows = query(
        SQL`SELECT id, player_name, applicant_openid, decided_at
            FROM sfmc_qq_join_requests WHERE status = 'approved'
            ORDER BY decided_at ASC LIMIT 32`
      ) as Array<Record<string, unknown>>;
      json(res, { success: true, queue: rows });
      return true;
    }

    if (path === "/api/sfmc/qq/join/applied" && method === "POST") {
      const data = await body(req);
      const id = String(data.id ?? "").trim();
      const ok = data.ok !== false && data.error == null;
      const err = String(data.error ?? "").slice(0, 200);
      if (!id) {
        json(res, { success: false, error: "id_required" }, 400);
        return true;
      }
      const now = Date.now();
      if (ok) {
        query(SQL`
          UPDATE sfmc_qq_join_requests
          SET status = 'applied', applied_at = ${now}, apply_error = NULL
          WHERE id = ${id} AND status = 'approved'
        `);
      } else {
        query(SQL`
          UPDATE sfmc_qq_join_requests
          SET status = 'apply_failed', applied_at = ${now}, apply_error = ${err}
          WHERE id = ${id} AND status = 'approved'
        `);
      }
      json(res, { success: true });
      return true;
    }

    // ── 踢人队列 ──────────────────────────────────────────
    if (path === "/api/sfmc/qq/admin/kick" && method === "POST") {
      const data = await body(req);
      const openid = String(data.openid ?? data.requested_by ?? "").trim();
      const target = String(data.target_name ?? data.name ?? "").trim();
      const reason = String(data.reason ?? "QQ 管理员踢出").trim().slice(0, 80);
      if (!authorizeAdmin(getAdminOpenids, getJoinFlags, openid, data)) {
        json(res, { success: false, error: "not_admin" }, 403);
        return true;
      }
      if (!target) {
        json(res, { success: false, error: "target_name_required" }, 400);
        return true;
      }
      const id = newId("act");
      const now = Date.now();
      query(SQL`
        INSERT INTO sfmc_qq_admin_actions
          (id, kind, target_name, reason, requested_by, status, created_at)
        VALUES (${id}, 'kick', ${target}, ${reason}, ${openid}, 'pending', ${now})
      `);
      json(res, { success: true, id });
      return true;
    }

    if (path === "/api/sfmc/qq/admin/action-queue" && method === "GET") {
      const rows = query(
        SQL`SELECT id, kind, target_name, reason, created_at
            FROM sfmc_qq_admin_actions WHERE status = 'pending'
            ORDER BY created_at ASC LIMIT 32`
      ) as Array<Record<string, unknown>>;
      json(res, { success: true, queue: rows });
      return true;
    }

    if (path === "/api/sfmc/qq/admin/action-done" && method === "POST") {
      const data = await body(req);
      const id = String(data.id ?? "").trim();
      const ok = data.ok !== false && data.error == null;
      const err = String(data.error ?? "").slice(0, 200);
      if (!id) {
        json(res, { success: false, error: "id_required" }, 400);
        return true;
      }
      const now = Date.now();
      const status = ok ? "done" : "failed";
      query(SQL`
        UPDATE sfmc_qq_admin_actions
        SET status = ${status}, applied_at = ${now}, apply_error = ${ok ? "" : err}
        WHERE id = ${id} AND status = 'pending'
      `);
      json(res, { success: true });
      return true;
    }

    json(res, { success: false, error: "not_found" }, 404);
    return true;
  };
}

export { createQqJoinRoutes };
