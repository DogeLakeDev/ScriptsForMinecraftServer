/**
 * domain/qq-bind.ts — QQ 绑定的确认逻辑与绑定提供方实现
 *
 * 使用场景：原 routes/qq-bind.ts 的 confirm 逻辑抽到这里，
 * 旧路由 POST /api/sfmc/qq/bind/confirm 与统一入口 POST /api/sfmc/bind/confirm 共用（DRY），行为与原实现一致。
 */

import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";
import type { BindConfirmInput, BindConfirmResult, BindProvider } from "./bind-providers.js";

/** QQ 待确认表中是否存在该短码 */
export function hasQqPendingCode(query: QueryFn, code: string): boolean {
  return (query(SQL`SELECT 1 AS ok FROM sfmc_qq_bind_pending WHERE code = ${code} LIMIT 1`) as unknown[]).length > 0;
}

/**
 * 用短码确认 QQ 绑定（原 routes/qq-bind.ts confirm 分支的逻辑，未改变判断顺序与错误码）。
 * 绑定记录就是自有白名单：写入后游戏侧允许移动并恢复成员/操作员权限。
 */
export function confirmQqBind(query: QueryFn, { code, xuid, name, now }: BindConfirmInput): BindConfirmResult {
  const pending = query(SQL`SELECT * FROM sfmc_qq_bind_pending WHERE code = ${code} LIMIT 1`) as Array<{
    code: string;
    qq_user_openid: string;
    qq_backend: string;
    expires_at: number;
  }>;
  const row = pending[0];
  if (!row) return { ok: false, status: 400, error: "invalid_code" };
  if (Number(row.expires_at) < now) {
    query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE code = ${code}`);
    return { ok: false, status: 400, error: "code_expired" };
  }

  const byOpenid = query(
    SQL`SELECT player_xuid FROM sfmc_qq_bindings WHERE qq_user_openid = ${row.qq_user_openid} LIMIT 1`
  ) as Array<{ player_xuid: string }>;
  if (byOpenid[0] && byOpenid[0].player_xuid !== xuid) {
    return { ok: false, status: 409, error: "qq_already_bound", hint: "请先在 QQ 侧解绑" };
  }
  const byXuid = query(
    SQL`SELECT qq_user_openid FROM sfmc_qq_bindings WHERE player_xuid = ${xuid} LIMIT 1`
  ) as Array<{ qq_user_openid: string }>;
  if (byXuid[0] && byXuid[0].qq_user_openid !== row.qq_user_openid) {
    return { ok: false, status: 409, error: "player_already_bound", hint: "请先解绑当前 QQ" };
  }

  query(SQL`DELETE FROM sfmc_qq_bindings WHERE qq_user_openid = ${row.qq_user_openid} OR player_xuid = ${xuid}`);
  query(
    SQL`INSERT INTO sfmc_qq_bindings (qq_user_openid, player_xuid, player_name, qq_backend, bound_at)
        VALUES (${row.qq_user_openid}, ${xuid}, ${name}, ${row.qq_backend}, ${now})`
  );
  query(SQL`DELETE FROM sfmc_qq_bind_pending WHERE code = ${code}`);
  return {
    ok: true,
    binding: {
      qq_user_openid: row.qq_user_openid,
      player_xuid: xuid,
      player_name: name,
      qq_backend: row.qq_backend,
      bound_at: now,
    },
  };
}

/**
 * QQ 绑定提供方。
 * 使用场景：index.ts 注册到统一确认入口与跨渠道短码查重。
 */
export function createQqBindProvider(query: QueryFn): BindProvider {
  return {
    id: "qq",
    hasPendingCode: (code) => hasQqPendingCode(query, code),
    confirm: (input) => confirmQqBind(query, input),
  };
}
