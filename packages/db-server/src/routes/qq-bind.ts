/**
 * routes/qq-bind.ts — QQ↔MC 身份绑定（平台 HTTP）
 *
 *   POST /api/sfmc/qq/bind/request  — QQ 侧申请短码
 *   POST /api/sfmc/qq/bind/confirm  — 游戏侧确认
 *   POST /api/sfmc/qq/bind/unbind   — 解绑
 *   GET  /api/sfmc/qq/bind/me       — 查询
 */

import { randomInt } from "node:crypto";
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";

const CODE_TTL_MS = 5 * 60 * 1000;
const CODE_LEN = 6;

interface Deps {
  query: QueryFn;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function genCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += String(randomInt(0, 10));
  return s;
}

function createQqBindRoutes({ query, body, json }: Deps) {
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
      });
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

      let code = "";
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = genCode();
        const clash = query(
          SQL`SELECT 1 AS ok FROM sfmc_qq_bind_pending WHERE code = ${candidate} LIMIT 1`
        ) as unknown[];
        if (clash.length === 0) {
          code = candidate;
          break;
        }
      }
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

      const now = Date.now();
      const pending = query(
        SQL`SELECT * FROM sfmc_qq_bind_pending WHERE code = ${code} LIMIT 1`
      ) as Array<{
        code: string;
        qq_user_openid: string;
        qq_backend: string;
        expires_at: number;
      }>;
      const row = pending[0];
      if (!row) {
        json(res, { success: false, error: "invalid_code" }, 400);
        return true;
      }
      if (Number(row.expires_at) < now) {
        query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE code = ${code}`);
        json(res, { success: false, error: "code_expired" }, 400);
        return true;
      }

      const byOpenid = query(
        SQL`SELECT player_xuid FROM sfmc_qq_bindings WHERE qq_user_openid = ${row.qq_user_openid} LIMIT 1`
      ) as Array<{ player_xuid: string }>;
      if (byOpenid[0] && byOpenid[0].player_xuid !== xuid) {
        json(res, { success: false, error: "qq_already_bound", hint: "请先在 QQ 侧解绑" }, 409);
        return true;
      }
      const byXuid = query(
        SQL`SELECT qq_user_openid FROM sfmc_qq_bindings WHERE player_xuid = ${xuid} LIMIT 1`
      ) as Array<{ qq_user_openid: string }>;
      if (byXuid[0] && byXuid[0].qq_user_openid !== row.qq_user_openid) {
        json(res, { success: false, error: "player_already_bound", hint: "请先解绑当前 QQ" }, 409);
        return true;
      }

      query(SQL`DELETE FROM sfmc_qq_bindings WHERE qq_user_openid = ${row.qq_user_openid} OR player_xuid = ${xuid}`);
      query(
        SQL`INSERT INTO sfmc_qq_bindings (qq_user_openid, player_xuid, player_name, qq_backend, bound_at)
            VALUES (${row.qq_user_openid}, ${xuid}, ${name}, ${row.qq_backend}, ${now})`
      );
      query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE code = ${code}`);
      json(res, {
        success: true,
        binding: {
          qq_user_openid: row.qq_user_openid,
          player_xuid: xuid,
          player_name: name,
          qq_backend: row.qq_backend,
          bound_at: now,
        },
      });
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
