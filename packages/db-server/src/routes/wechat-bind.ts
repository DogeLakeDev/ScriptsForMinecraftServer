/**
 * routes/wechat-bind.ts — 微信↔MC 身份绑定（平台 HTTP，仅本机）
 *
 *   POST /api/sfmc/wechat/bind/request  — mp-gateway 代小程序玩家申请短码 { openid }
 *   POST /api/sfmc/wechat/bind/unbind   — 解绑 { openid }
 *   GET  /api/sfmc/wechat/bind/me       — 查询 ?openid=：绑定、账号资料与 SFMC 有效等级
 *
 * 游戏侧确认走统一入口 POST /api/sfmc/bind/confirm（routes/bind-confirm.ts）。
 * openid 由 mp-gateway 通过微信 code2session 取得，db-server 只信任本机调用方（与 QQ 绑定路由同一信任边界）。
 */

import type http from "node:http";
import { loadQqAccountProfile } from "../domain/qq-account-profile.js";
import { currentPlayerName, findWechatBindingByOpenid, requestWechatBindCode, unbindWechat } from "../domain/wechat-bind.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  body: (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: http.ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 跨渠道短码查重（QQ + 微信） */
  isCodeTaken: (code: string) => boolean;
  /** 按 xuid / 玩家名计算 SFMC 有效等级（DIP：文件位置由入口决定） */
  resolveLevel: (player: { xuid: string; name: string }) => number;
}

/** 路由上下文（与其他平台路由一致） */
interface Ctx {
  path: string;
  method: string;
  params: URLSearchParams;
  req: http.IncomingMessage;
  res: http.ServerResponse;
}

const PREFIX = "/api/sfmc/wechat/bind";

/**
 * 创建微信绑定路由。
 * 使用场景：index.ts 装配到平台路由链。
 */
function createWechatBindRoutes({ query, body, json, isCodeTaken, resolveLevel }: Deps) {
  return async function handle({ path, method, params, req, res }: Ctx): Promise<boolean> {
    if (!path.startsWith(PREFIX)) return false;

    if (path === `${PREFIX}/me` && method === "GET") {
      const openid = String(params.get("openid") ?? "").trim();
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      const binding = findWechatBindingByOpenid(query, openid);
      if (!binding) {
        json(res, { success: true, bound: false, binding: null });
        return true;
      }
      const name = currentPlayerName(query, binding.player_xuid, binding.player_name);
      json(res, {
        success: true,
        bound: true,
        binding: { ...binding, player_name: name },
        level: resolveLevel({ xuid: binding.player_xuid, name }),
        profile: loadQqAccountProfile(query, binding.player_xuid, name),
      });
      return true;
    }

    if (path === `${PREFIX}/request` && method === "POST") {
      const openid = String((await body(req)).openid ?? "").trim();
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      const result = requestWechatBindCode(query, openid, isCodeTaken);
      if (result.ok) json(res, { success: true, code: result.code, expires_at: result.expires_at, ttl_ms: result.ttl_ms });
      else json(res, { success: false, error: result.error, ...(result.player_name ? { player_name: result.player_name } : {}) }, result.status);
      return true;
    }

    if (path === `${PREFIX}/unbind` && method === "POST") {
      const openid = String((await body(req)).openid ?? "").trim();
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      const removed = unbindWechat(query, openid);
      json(res, { success: true, unbound: removed > 0, removed });
      return true;
    }

    json(res, { success: false, error: "not_found" }, 404);
    return true;
  };
}

export { createWechatBindRoutes };
