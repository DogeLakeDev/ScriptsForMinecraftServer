/**
 * player-asset-routes.ts — 小程序玩家端资产：我的领地、交易记录
 *
 *   GET …/player/lands
 *   GET …/player/transactions?limit=&offset=
 *
 * 使用场景：小程序「我的领地」「交易记录」。需要玩家会话；未绑定时 bound:false。
 */
import type { PlayerHomeSource } from "./player-home-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import type { Route } from "./routes.js";
import { sendJson } from "./upload.js";

/** 资产路由依赖 */
export interface PlayerAssetRouteDeps extends PlayerAuthDeps {
  wechatEnabled: boolean;
  home: PlayerHomeSource;
}

function parsePaging(params: URLSearchParams): { limit: number; offset: number } {
  const limitRaw = Number(params.get("limit"));
  const offsetRaw = Number(params.get("offset"));
  return {
    limit: Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0,
  };
}

/**
 * 创建玩家资产路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createPlayerAssetRoutes(deps: PlayerAssetRouteDeps): Route[] {
  return [
    {
      method: "GET",
      suffix: "/player/lands",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        sendJson(context.response, 200, await deps.home.lands(openid));
      },
    },
    {
      method: "GET",
      suffix: "/player/transactions",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        const { limit, offset } = parsePaging(context.url.searchParams);
        sendJson(context.response, 200, await deps.home.transactions(openid, limit, offset));
      },
    },
  ];
}
