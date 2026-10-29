/**
 * routes/rank.ts — 玩家端排行榜与公开计分项名单
 *
 *   GET  /api/sfmc/rank/online?metric=today|month|total&limit=&openid=
 *   GET  /api/sfmc/rank/wealth?limit=&openid=
 *   GET  /api/sfmc/rank/scoreboard?objectiveId=&limit=&openid=
 *   GET  /api/sfmc/rank/public-objectives
 *   PUT  /api/sfmc/rank/public-objectives  { ids: string[] }  （需 AUTH_TOKEN，管理端开关）
 *
 * 使用场景：mp-gateway 玩家端排行页；管理端「在排行中公开」经 CLI 调 PUT。
 * openid 可选：传入且已绑定时附带 myRank。财富读经济账户表；计分项排行依赖内存计分板快照（与 scoreboard 路由共用 store）。
 */
import { join } from "node:path";
import { configDir, readJson } from "@sfmc-bds/sdk/node/config";
import { DEFAULT_ECONOMY_UNIT } from "../domain/qq-account-profile.js";
import {
  queryObjectiveRank,
  queryOnlineRank,
  queryWealthRank,
  type OnlineRankMetric,
} from "../domain/player-rank.js";
import { readPublicObjectives, writePublicObjectives } from "../domain/rank-public.js";
import type { ScoreboardStore } from "../domain/scoreboard.js";
import { findWechatBindingByOpenid } from "../domain/wechat-bind.js";
import { body, intParam, json, type RouteHandler, type QueryFn } from "./_shared.js";

interface Deps {
  query: QueryFn;
  scoreboard: ScoreboardStore;
  projectRoot: string;
  now?: () => number;
}

const METRICS = new Set<OnlineRankMetric>(["today", "month", "total"]);

/** 解析 limit（1–100，缺省 50） */
function parseLimit(params: URLSearchParams): number {
  return intParam(params, "limit", 50, 1, 100);
}

/** 按 openid 取绑定的 xuid 与名字；未绑定返回空 */
function bindingOf(query: QueryFn, openid: string): { playerId: string; playerName: string } {
  if (!openid) return { playerId: "", playerName: "" };
  const binding = findWechatBindingByOpenid(query, openid);
  if (!binding?.player_xuid) return { playerId: "", playerName: "" };
  return { playerId: String(binding.player_xuid), playerName: String(binding.player_name ?? "") };
}

/** 经济货币单位：读 configs/economy.json，缺省与账号页一致 */
function economyUnit(projectRoot: string): string {
  const cfg = (readJson(join(configDir(projectRoot), "economy.json")) as { unitName?: unknown } | null) ?? {};
  return typeof cfg.unitName === "string" && cfg.unitName.trim() ? cfg.unitName.trim() : DEFAULT_ECONOMY_UNIT;
}

/**
 * 创建排行路由。
 * 使用场景：index.ts；scoreboard 必须与 createScoreboardRoutes 共用同一 ScoreboardStore。
 */
export function createRankRoutes({ query, scoreboard, projectRoot, now = Date.now }: Deps): RouteHandler {
  return async function handle({ path, method, params, req, res }): Promise<boolean> {
    if (path === "/api/sfmc/rank/public-objectives") {
      if (method === "GET") {
        json(res, { success: true, ids: readPublicObjectives(projectRoot) });
        return true;
      }
      if (method === "PUT") {
        const data = await body(req);
        const ids = Array.isArray(data.ids) ? data.ids.map((item) => String(item)) : null;
        if (!ids) {
          json(res, { success: false, error: "ids_required" }, 400);
          return true;
        }
        json(res, { success: true, ids: writePublicObjectives(projectRoot, ids) });
        return true;
      }
      json(res, { success: false, error: "method_not_allowed" }, 405);
      return true;
    }

    if (path === "/api/sfmc/rank/online") {
      if (method !== "GET") {
        json(res, { success: false, error: "method_not_allowed" }, 405);
        return true;
      }
      const metric = String(params.get("metric") ?? "total") as OnlineRankMetric;
      if (!METRICS.has(metric)) {
        json(res, { success: false, error: "invalid_metric", message: "metric 须为 today / month / total" }, 400);
        return true;
      }
      const { playerId } = bindingOf(query, String(params.get("openid") ?? "").trim());
      json(res, { success: true, metric, ...queryOnlineRank(query, metric, parseLimit(params), playerId, now()) });
      return true;
    }

    if (path === "/api/sfmc/rank/wealth") {
      if (method !== "GET") {
        json(res, { success: false, error: "method_not_allowed" }, 405);
        return true;
      }
      const viewer = bindingOf(query, String(params.get("openid") ?? "").trim());
      json(res, { success: true, ...queryWealthRank(query, parseLimit(params), viewer, economyUnit(projectRoot)) });
      return true;
    }

    if (path === "/api/sfmc/rank/scoreboard") {
      if (method !== "GET") {
        json(res, { success: false, error: "method_not_allowed" }, 405);
        return true;
      }
      const objectiveId = String(params.get("objectiveId") ?? "").trim();
      const publicIds = readPublicObjectives(projectRoot);
      // 未指定 objectiveId 时返回公开名单及其显示名（供排行页分类切换）
      if (!objectiveId) {
        const view = scoreboard.read(now());
        const objectives = publicIds.map((id) => {
          const found = view.objectives.find((item) => item.id === id);
          return { id, displayName: found?.displayName ?? id };
        });
        json(res, {
          success: true,
          objectives,
          available: view.available,
          fresh: view.fresh,
          ...(view.note ? { note: view.note } : {}),
        });
        return true;
      }
      if (!publicIds.includes(objectiveId)) {
        json(res, { success: false, error: "not_public", message: "该计分项未在排行中公开" }, 403);
        return true;
      }
      const { playerName } = bindingOf(query, String(params.get("openid") ?? "").trim());
      json(res, {
        success: true,
        objectiveId,
        ...queryObjectiveRank(scoreboard, objectiveId, parseLimit(params), playerName, "", now()),
      });
      return true;
    }

    return false;
  };
}
