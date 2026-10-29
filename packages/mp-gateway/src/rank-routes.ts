/**
 * rank-routes.ts — 小程序玩家端排行榜
 *
 *   GET …/rank/online?metric=today|month|total&limit=
 *   GET …/rank/wealth?limit=
 *   GET …/rank/scoreboard                 → 公开计分项目录
 *   GET …/rank/scoreboard?objectiveId=&limit= → 某一公开计分项排行
 *
 * 使用场景：小程序 pages/rank。需要玩家会话；openid 传给 db-server 以附带「我的名次」。
 */
import type { PlayerHomeSource } from "./player-home-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import { HttpError, type Route } from "./routes.js";
import { sendJson } from "./upload.js";

/** 排行路由依赖 */
export interface RankRouteDeps extends PlayerAuthDeps {
  wechatEnabled: boolean;
  home: PlayerHomeSource;
}

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

/**
 * 创建排行路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createRankRoutes(deps: RankRouteDeps): Route[] {
  return [
    {
      method: "GET",
      suffix: "/rank/online",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        const metric = context.url.searchParams.get("metric") ?? "total";
        if (metric !== "today" && metric !== "month" && metric !== "total") {
          throw new HttpError(400, "metric 须为 today / month / total");
        }
        sendJson(context.response, 200, await deps.home.onlineRank(metric, parseLimit(context.url.searchParams.get("limit")), openid));
      },
    },
    {
      method: "GET",
      suffix: "/rank/wealth",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        sendJson(context.response, 200, await deps.home.wealthRank(parseLimit(context.url.searchParams.get("limit")), openid));
      },
    },
    {
      method: "GET",
      suffix: "/rank/scoreboard",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        const objectiveId = (context.url.searchParams.get("objectiveId") ?? "").trim();
        if (!objectiveId) {
          sendJson(context.response, 200, await deps.home.scoreboardCatalog(openid));
          return;
        }
        sendJson(
          context.response,
          200,
          await deps.home.scoreboardRank(objectiveId, parseLimit(context.url.searchParams.get("limit")), openid)
        );
      },
    },
  ];
}
