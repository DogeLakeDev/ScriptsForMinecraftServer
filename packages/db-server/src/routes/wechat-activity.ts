/**
 * routes/wechat-activity.ts — 微信玩家查看自己的行为记录（平台 HTTP，仅本机）
 *
 *   GET /api/sfmc/wechat/activity?openid=&limit=&offset=&eventTypePrefix=&from=&to=
 *     → { success, bound, installed, records, total, limit, offset }
 *
 * 使用场景：mp-gateway 的玩家端 /player/activity 代小程序「我的行为记录」页调用。
 * 先按 openid 找到绑定的游戏账号，再把执行者强制限定为该账号（绑定表的 player_xuid 即游戏内 player.id，
 * 与行为日志的 actor_id 相同），调用方传入的 actorId / actorName 一律忽略，玩家只能看到自己的记录。
 * openid 由 mp-gateway 通过微信 code2session 取得，信任边界与 routes/wechat-bind.ts 相同。
 */

import type http from "node:http";
import { ActivityQueryError, parseActivityFilter, parseActivityPaging, queryActivityPage } from "../domain/activity-log.js";
import { findWechatBindingByOpenid } from "../domain/wechat-bind.js";
import type { QueryFn } from "../lib/sqlite.js";

interface Deps {
  query: QueryFn;
  json: (res: http.ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

/** 路由上下文（与其他平台路由一致） */
interface Ctx {
  path: string;
  method: string;
  params: URLSearchParams;
  req: http.IncomingMessage;
  res: http.ServerResponse;
}

const ROUTE = "/api/sfmc/wechat/activity";

/**
 * 创建微信玩家行为记录路由。
 * 使用场景：index.ts 装配到平台路由链。
 */
function createWechatActivityRoutes({ query, json }: Deps) {
  return async function handle({ path, method, params, res }: Ctx): Promise<boolean> {
    if (path !== ROUTE) return false;
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
    // 空 player_xuid 不能作为执行者条件（空值会被筛选条件忽略而查出所有人的记录），按未绑定处理
    if (!binding?.player_xuid) {
      json(res, { success: true, bound: false, installed: false, records: [], total: 0, limit: 0, offset: 0 });
      return true;
    }
    const raw = Object.fromEntries(params.entries());
    let page;
    try {
      const { actorId: _actorId, actorName: _actorName, ...filter } = parseActivityFilter(raw);
      page = queryActivityPage(query, { ...filter, actorId: binding.player_xuid }, parseActivityPaging(raw));
    } catch (error) {
      if (error instanceof ActivityQueryError) {
        json(res, { success: false, error: "invalid_params", message: error.message }, 400);
        return true;
      }
      throw error;
    }
    json(res, { success: true, bound: true, ...page });
    return true;
  };
}

export { createWechatActivityRoutes };
