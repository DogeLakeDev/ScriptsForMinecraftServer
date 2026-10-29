/**
 * routes/wechat-player.ts — 微信玩家只读资产接口（领地、经济流水）
 *
 *   GET /api/sfmc/wechat/lands?openid=          → { success, bound, lands }
 *   GET /api/sfmc/wechat/transactions?openid=&limit=&offset=
 *     → { success, bound, records, total, limit, offset }
 *
 * 使用场景：mp-gateway 的 /player/lands、/player/transactions。
 * 先按 openid 找绑定账号，未绑定返回 bound:false；执行者由绑定强制限定。
 */
import { listPlayerLands } from "../domain/player-lands.js";
import { queryPlayerTransactions } from "../domain/player-transactions.js";
import { findWechatBindingByOpenid } from "../domain/wechat-bind.js";
import { intParam, json, type QueryFn, type RouteHandler } from "./_shared.js";

interface Deps {
  query: QueryFn;
}

function parsePaging(params: URLSearchParams): { limit: number; offset: number } {
  return {
    limit: intParam(params, "limit", 50, 1, 200),
    offset: intParam(params, "offset", 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * 创建微信玩家资产路由。
 * 使用场景：index.ts 平台路由链。
 */
export function createWechatPlayerRoutes({ query }: Deps): RouteHandler {
  return async function handle({ path, method, params, res }): Promise<boolean> {
    if (path === "/api/sfmc/wechat/lands") {
      if (method !== "GET") {
        json(res, { success: false, error: "method_not_allowed" }, 405);
        return true;
      }
      const openid = String(params.get("openid") ?? "").trim();
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      const binding = findWechatBindingByOpenid(query, openid);
      if (!binding?.player_xuid) {
        json(res, { success: true, bound: false, lands: [] });
        return true;
      }
      json(res, { success: true, bound: true, lands: listPlayerLands(query, String(binding.player_xuid)) });
      return true;
    }

    if (path === "/api/sfmc/wechat/transactions") {
      if (method !== "GET") {
        json(res, { success: false, error: "method_not_allowed" }, 405);
        return true;
      }
      const openid = String(params.get("openid") ?? "").trim();
      if (!openid) {
        json(res, { success: false, error: "openid_required" }, 400);
        return true;
      }
      const binding = findWechatBindingByOpenid(query, openid);
      if (!binding?.player_xuid) {
        json(res, { success: true, bound: false, records: [], total: 0, limit: 0, offset: 0 });
        return true;
      }
      const { limit, offset } = parsePaging(params);
      json(res, {
        success: true,
        bound: true,
        ...queryPlayerTransactions(query, String(binding.player_xuid), String(binding.player_name ?? ""), limit, offset),
      });
      return true;
    }

    return false;
  };
}
