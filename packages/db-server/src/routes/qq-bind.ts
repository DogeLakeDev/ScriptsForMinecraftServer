/**
 * routes/qq-bind.ts — QQ↔MC 身份绑定（平台 HTTP）
 *
 *   POST /api/sfmc/qq/bind/request  — QQ 侧申请短码
 *   POST /api/sfmc/qq/bind/confirm  — 游戏侧确认
 *   POST /api/sfmc/qq/bind/unbind   — 解绑
 *   GET  /api/sfmc/qq/bind/me       — 查询
 */

import { SQL } from "sql-template-strings";
import { BIND_CODE_TTL_MS, generateBindCode } from "../domain/bind-providers.js";
import { loadQqAccountProfile, saveQqAccountProfile } from "../domain/qq-account-profile.js";
import { confirmQqBind, hasQqPendingCode } from "../domain/qq-bind.js";
import type { QueryFn } from "../lib/sqlite.js";

const CODE_TTL_MS = BIND_CODE_TTL_MS;

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 短码是否已被任一绑定渠道占用；缺省只查 QQ 待确认表（与原行为一致） */
  isCodeTaken?: (code: string) => boolean;
}

function createQqBindRoutes({ query, body, json, isCodeTaken = (code) => hasQqPendingCode(query, code) }: Deps) {
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
    if (!path.startsWith("/api/sfmc/qq/bind")) return false;

    if (path === "/api/sfmc/qq/bind/me" && method === "GET") {
      const openid = String(params.get("openid") ?? "").trim();
      const xuid = String(params.get("xuid") ?? "").trim();
      if (!openid && !xuid) {
        json(res, { success: false, error: "openid_or_xuid_required" }, 400);
        return true;
      }
      const rows = openid
        ? (query(SQL`SELECT * FROM sfmc_qq_bindings WHERE qq_user_openid = ${openid} LIMIT 1`) as Array<
            Record<string, unknown>
          >)
        : (query(SQL`SELECT * FROM sfmc_qq_bindings WHERE player_xuid = ${xuid} LIMIT 1`) as Array<
            Record<string, unknown>
          >);
      const row = rows[0] ?? null;
      const playerId = row ? String(row.player_xuid ?? "") : "";
      const playerName = row ? String(row.player_name ?? "") : "";
      json(res, {
        success: true,
        bound: !!row,
        binding: row
          ? {
              qq_user_openid: row.qq_user_openid,
              player_xuid: row.player_xuid,
              player_name: row.player_name,
              qq_backend: row.qq_backend,
              bound_at: row.bound_at,
            }
          : null,
        ...(row ? { profile: loadQqAccountProfile(query, playerId, playerName) } : {}),
      });
      return true;
    }

    if (path === "/api/sfmc/qq/bind/profile" && method === "POST") {
      const data = await body(req);
      const playerId = String(data.xuid ?? data.player_xuid ?? "").trim();
      const playerName = String(data.name ?? data.player_name ?? "").trim();
      if (!playerId) {
        json(res, { success: false, error: "xuid_required" }, 400);
        return true;
      }
      const optionalNumber = (value: unknown): number | null => {
        if (value == null || value === "") return null;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
      };
      saveQqAccountProfile(query, {
        playerId,
        playerName,
        balance: optionalNumber(data.balance),
        todaySeconds: optionalNumber(data.today_seconds),
        monthSeconds: optionalNumber(data.month_seconds),
        totalSeconds: optionalNumber(data.total_seconds),
      });
      json(res, { success: true });
      return true;
    }

    if (path === "/api/sfmc/qq/bind/request" && method === "POST") {
      const data = await body(req);
      const openid = String(data.openid ?? data.qq_user_openid ?? "").trim();
      const backend = String(data.qq_backend ?? "official").trim() || "official";
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      // 已绑定则拒绝再申请（须先解绑）
      const existing = query(
        SQL`SELECT player_name FROM sfmc_qq_bindings WHERE qq_user_openid = ${openid} LIMIT 1`
      ) as Array<{ player_name: string }>;
      if (existing[0]) {
        json(
          res,
          {
            success: false,
            error: "already_bound",
            player_name: existing[0].player_name,
          },
          409
        );
        return true;
      }

      const now = Date.now();
      query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE qq_user_openid = ${openid} OR expires_at < ${now}`);

      // 查重范围由入口注入（QQ + 微信待确认表），保证统一确认入口按短码能唯一定位渠道
      const code = generateBindCode(isCodeTaken);
      if (!code) {
        json(res, { success: false, error: "code_gen_failed" }, 500);
        return true;
      }

      const expiresAt = now + CODE_TTL_MS;
      query(
        SQL`INSERT INTO sfmc_qq_bind_pending (code, qq_user_openid, qq_backend, created_at, expires_at)
            VALUES (${code}, ${openid}, ${backend}, ${now}, ${expiresAt})`
      );
      json(res, { success: true, code, expires_at: expiresAt, ttl_ms: CODE_TTL_MS });
      return true;
    }

    if (path === "/api/sfmc/qq/bind/confirm" && method === "POST") {
      const data = await body(req);
      const code = String(data.code ?? "").trim();
      const xuid = String(data.xuid ?? data.player_xuid ?? "").trim();
      const name = String(data.name ?? data.player_name ?? "").trim();
      if (!code || !xuid) {
        json(res, { success: false, error: "code_and_xuid_required" }, 400);
        return true;
      }

      // 确认逻辑与统一入口 /api/sfmc/bind/confirm 共用 domain/qq-bind.ts（DRY），响应结构保持不变
      const result = confirmQqBind(query, { code, xuid, name, now: Date.now() });
      if (result.ok) json(res, { success: true, binding: result.binding });
      else json(res, { success: false, error: result.error, ...(result.hint ? { hint: result.hint } : {}) }, result.status);
      return true;
    }

    if (path === "/api/sfmc/qq/bind/unbind" && method === "POST") {
      const data = await body(req);
      const openid = String(data.openid ?? data.qq_user_openid ?? "").trim();
      const xuid = String(data.xuid ?? data.player_xuid ?? "").trim();
      if (!openid && !xuid) {
        json(res, { success: false, error: "openid_or_xuid_required" }, 400);
        return true;
      }
      let removed = 0;
      if (openid) {
        const before = query(
          SQL`SELECT qq_user_openid FROM sfmc_qq_bindings WHERE qq_user_openid = ${openid}`
        ) as unknown[];
        query(SQL`DELETE FROM sfmc_qq_bindings WHERE qq_user_openid = ${openid}`);
        query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE qq_user_openid = ${openid}`);
        removed += before.length;
      }
      if (xuid) {
        const before = query(
          SQL`SELECT qq_user_openid FROM sfmc_qq_bindings WHERE player_xuid = ${xuid}`
        ) as unknown[];
        query(SQL`DELETE FROM sfmc_qq_bindings WHERE player_xuid = ${xuid}`);
        removed += before.length;
      }
      json(res, { success: true, unbound: removed > 0, removed });
      return true;
    }

    json(res, { success: false, error: "not_found" }, 404);
    return true;
  };
}

export { createQqBindRoutes, CODE_TTL_MS };
