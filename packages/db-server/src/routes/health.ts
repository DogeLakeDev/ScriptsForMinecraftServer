/**
 * routes/health.ts — 健康检查
 *
 * 路由列表：
 *   GET /api/health — 返回 db-server 的运行状态
 */

import { json, type RouteFactory } from "./_shared.js";

function createHealthRoutes(): ReturnType<RouteFactory> {
  return async function handle({ path, method, res }): Promise<boolean> {
    if (path === "/api/health") {
      if (method === "GET") {
        json(res, { status: "ok", uptime: process.uptime() });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    return false;
  };
}

export { createHealthRoutes };
