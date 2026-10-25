/**
 * routes/scoreboard.ts — 世界计分板快照
 *
 * 路由列表：
 *   POST /api/sfmc/scoreboard/live — 游戏内平台脚本上报快照 / 哈希 / 空闲探询（走旧 token 鉴权）
 *   GET  /api/sfmc/scoreboard      — CLI 的 scoreboard.read 读取快照，并让脚本在关注期内持续同步
 *
 * 规则见 domain/scoreboard.ts。
 */

import { parseScoreboardReport, ScoreboardStore } from "../domain/scoreboard.js";
import { body, json, type RouteHandler } from "./_shared.js";

interface Deps {
  /** 测试可注入独立实例；缺省每个路由实例各持有一个 */
  store?: ScoreboardStore;
  now?: () => number;
}

/** 创建计分板路由。使用场景：index.ts 平台路由链。 */
export function createScoreboardRoutes({ store = new ScoreboardStore(), now = Date.now }: Deps = {}): RouteHandler {
  return async function handle({ path, method, req, res }): Promise<boolean> {
    if (path === "/api/sfmc/scoreboard/live") {
      if (method !== "POST") {
        json(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      const report = parseScoreboardReport(await body(req), now());
      if (!report) {
        json(res, { success: false, error: "invalid_scoreboard_report" }, 400);
        return true;
      }
      json(res, { success: true, ...store.report(report, now()) });
      return true;
    }
    if (path !== "/api/sfmc/scoreboard") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }
    json(res, { success: true, ...store.read(now()) });
    return true;
  };
}
