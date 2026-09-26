/**
 * routes/content.ts — QQ 查询已装模块与世界资源包。
 *
 *   GET /api/sfmc/content
 *
 * 只读。模块启停与资源包文件仍由 catalog / 世界目录维护，本路由不改它们。
 */

import type { ContentSnapshot } from "../domain/installed-content.js";

interface Deps {
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 每次请求现读，避免 db-server 启动后装包却一直返回旧列表。 */
  loadSnapshot: () => ContentSnapshot;
}

/** 创建内容查询路由。当前只给 qq-bridge 的「模块」「资源包」命令使用。 */
function createContentRoutes({ json, loadSnapshot }: Deps) {
  return async function handle({
    path,
    method,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    if (path !== "/api/sfmc/content") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }
    json(res, loadSnapshot() as unknown as Record<string, unknown>);
    return true;
  };
}

export { createContentRoutes };
