/**
 * domain/wechat-bind.ts — 微信 openid ↔ 游戏账号绑定的数据操作
 *
 * 使用场景：
 * - routes/wechat-bind.ts（mp-gateway 代小程序玩家调用）申请短码、解绑、查询；
 * - 作为 BindProvider 注册到统一确认入口，游戏内 /c:bind 输入微信侧短码时由这里完成绑定。
 * 与 QQ 绑定完全独立（独立表），同一游戏账号可同时绑定 QQ 与微信。
 */

import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";
import { BIND_CODE_TTL_MS, generateBindCode, type BindConfirmInput, type BindConfirmResult, type BindProvider } from "./bind-providers.js";

/** 一条微信绑定记录 */
export interface WechatBinding {
  wechat_openid: string;
  player_xuid: string;
  player_name: string;
  bound_at: number;
}

/** 申请短码的结果 */
export type WechatBindRequestResult =
  | { ok: true; code: string; expires_at: number; ttl_ms: number }
  | { ok: false; status: number; error: string; player_name?: string };

/** 按 openid 读取绑定；未绑定返回 null */
export function findWechatBindingByOpenid(query: QueryFn, openid: string): WechatBinding | null {
  const rows = query(SQL`SELECT * FROM sfmc_wechat_bindings WHERE wechat_openid = ${openid} LIMIT 1`) as WechatBinding[];
  return rows[0] ?? null;
}

/** 微信待确认表中是否存在该短码 */
export function hasWechatPendingCode(query: QueryFn, code: string): boolean {
  return (query(SQL`SELECT 1 AS ok FROM sfmc_wechat_bind_pending WHERE code = ${code} LIMIT 1`) as unknown[]).length > 0;
}

/**
 * 为微信用户申请绑定短码。已绑定则拒绝（须先解绑）；同一 openid 旧的短码作废。
 *
 * @param isCodeTaken 跨渠道查重（QQ + 微信），由入口注入。
 */
export function requestWechatBindCode(
  query: QueryFn,
  openid: string,
  isCodeTaken: (code: string) => boolean,
  now = Date.now()
): WechatBindRequestResult {
  const existing = findWechatBindingByOpenid(query, openid);
  if (existing) return { ok: false, status: 409, error: "already_bound", player_name: existing.player_name };
  query(SQL`DELETE FROM sfmc_wechat_bind_pending WHERE wechat_openid = ${openid} OR expires_at < ${now}`);
  const code = generateBindCode(isCodeTaken);
  if (!code) return { ok: false, status: 500, error: "code_gen_failed" };
  const expiresAt = now + BIND_CODE_TTL_MS;
  query(
    SQL`INSERT INTO sfmc_wechat_bind_pending (code, wechat_openid, created_at, expires_at)
        VALUES (${code}, ${openid}, ${now}, ${expiresAt})`
  );
  return { ok: true, code, expires_at: expiresAt, ttl_ms: BIND_CODE_TTL_MS };
}

/**
 * 用短码确认微信绑定（游戏侧）。判断顺序与错误码风格与 QQ 确认一致，便于游戏侧复用提示文案（LSP）。
 */
export function confirmWechatBind(query: QueryFn, { code, xuid, name, now }: BindConfirmInput): BindConfirmResult {
  const rows = query(SQL`SELECT * FROM sfmc_wechat_bind_pending WHERE code = ${code} LIMIT 1`) as Array<{
    wechat_openid: string;
    expires_at: number;
  }>;
  const row = rows[0];
  if (!row) return { ok: false, status: 400, error: "invalid_code" };
  if (Number(row.expires_at) < now) {
    query(SQL`DELETE FROM sfmc_wechat_bind_pending WHERE code = ${code}`);
    return { ok: false, status: 400, error: "code_expired" };
  }
  const byOpenid = findWechatBindingByOpenid(query, row.wechat_openid);
  if (byOpenid && byOpenid.player_xuid !== xuid) {
    return { ok: false, status: 409, error: "wechat_already_bound", hint: "请先在小程序解绑" };
  }
  const byXuid = query(
    SQL`SELECT wechat_openid FROM sfmc_wechat_bindings WHERE player_xuid = ${xuid} LIMIT 1`
  ) as Array<{ wechat_openid: string }>;
  if (byXuid[0] && byXuid[0].wechat_openid !== row.wechat_openid) {
    return { ok: false, status: 409, error: "player_already_bound_wechat", hint: "请先解绑当前微信" };
  }
  query(SQL`DELETE FROM sfmc_wechat_bindings WHERE wechat_openid = ${row.wechat_openid} OR player_xuid = ${xuid}`);
  query(
    SQL`INSERT INTO sfmc_wechat_bindings (wechat_openid, player_xuid, player_name, bound_at)
        VALUES (${row.wechat_openid}, ${xuid}, ${name}, ${now})`
  );
  query(SQL`DELETE FROM sfmc_wechat_bind_pending WHERE code = ${code}`);
  return {
    ok: true,
    binding: { wechat_openid: row.wechat_openid, player_xuid: xuid, player_name: name, bound_at: now },
  };
}

/** 解绑微信（同时作废该 openid 未用完的短码），返回删除的绑定条数 */
export function unbindWechat(query: QueryFn, openid: string): number {
  const before = query(SQL`SELECT 1 AS ok FROM sfmc_wechat_bindings WHERE wechat_openid = ${openid}`) as unknown[];
  query(SQL`DELETE FROM sfmc_wechat_bindings WHERE wechat_openid = ${openid}`);
  query(SQL`DELETE FROM sfmc_wechat_bind_pending WHERE wechat_openid = ${openid}`);
  return before.length;
}

/**
 * 玩家当前名字：优先取运行期快照 sfmc_players（玩家改名后会更新），没有时用绑定时记录的名字。
 * 使用场景：计算 SFMC 覆盖等级（按玩家名索引）与展示。
 */
export function currentPlayerName(query: QueryFn, xuid: string, fallback: string): string {
  try {
    const rows = query(
      SQL`SELECT name FROM sfmc_players WHERE (id = ${xuid} OR xuid = ${xuid}) AND name <> '' LIMIT 1`
    ) as Array<{ name: string }>;
    return rows[0]?.name || fallback;
  } catch {
    return fallback;
  }
}

/**
 * 微信绑定提供方。
 * 使用场景：index.ts 注册到统一确认入口与跨渠道短码查重。
 */
export function createWechatBindProvider(query: QueryFn): BindProvider {
  return {
    id: "wechat",
    hasPendingCode: (code) => hasWechatPendingCode(query, code),
    confirm: (input) => confirmWechatBind(query, input),
  };
}
