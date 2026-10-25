/**
 * player-activity-routes.ts — 小程序玩家端：查看自己的行为记录
 *
 *   GET …/player/activity?limit=&offset=&eventTypePrefix=&from=&to=
 *     → { bound, installed, records, total, limit, offset }
 *
 * 使用场景：小程序「我的」页进入「我的行为记录」。需要玩家会话；只能看到当前微信绑定账号的记录。
 * 按 player-routes.ts 约定的方式新增路由工厂并在 server.ts 注册（OCP）。
 */
import type { PlayerActivitySource } from "./activity-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import type { Route } from "./routes.js";
import { sendJson } from "./upload.js";

/** 玩家行为记录路由依赖 */
export interface PlayerActivityRouteDeps extends PlayerAuthDeps {
  /** 未启用微信登录时回 503，与其他玩家接口一致 */
  wechatEnabled: boolean;
  activity: PlayerActivitySource;
}

/**
 * 创建玩家行为记录路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createPlayerActivityRoutes(deps: PlayerActivityRouteDeps): Route[] {
  return [
    {
      method: "GET",
      suffix: "/player/activity",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        sendJson(context.response, 200, await deps.activity.page(openid, context.url.searchParams));
      },
    },
  ];
}
