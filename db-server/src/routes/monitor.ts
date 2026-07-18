/**
 * routes/monitor.ts — 监控面板数据上报与汇总（仅内存，不落 DB）
 *
 * 路由列表：
 *   POST /api/sfmc/monitor/metrics       — SAPI 上报 tps / entity stats
 *   POST /api/sfmc/monitor/player-chunks — SAPI 上报玩家 chunk 数
 *   GET  /api/sfmc/monitor/summary       — 面板展示汇总
 */

interface Deps {
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  monitorState: {
    metrics: { tps: number; entities: Record<string, number>; timestamp: number } | null;
    players: Array<{ timestamp: number; [k: string]: unknown }>;
  };
}

function createMonitorRoutes({ body, json, monitorState }: Deps) {
  return async function handle({
    path,
    method,
    req,
    res,
    params,
  }: {
    path: string;
    method: string;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
    params: URLSearchParams;
  }): Promise<boolean> {
    void params; // unused
    if (path === "/api/sfmc/monitor/metrics") {
      if (method === "POST") {
        const data = await body(req);
        monitorState.metrics = {
          tps: (data.tps as number) || 0,
          entities: (data.entities as Record<string, number>) || {},
          timestamp: Date.now(),
        };
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    if (path === "/api/sfmc/monitor/player-chunks") {
      if (method === "POST") {
        const data = await body(req);
        monitorState.players = ((data.players as Array<Record<string, unknown>>) ?? []).map((p) => ({
          ...p,
          timestamp: Date.now(),
        }));
        json(res, { success: true });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    if (path === "/api/sfmc/monitor/summary") {
      if (method === "GET") {
        const now = Date.now();
        const stale = now - 60000;
        const metrics =
          monitorState.metrics && monitorState.metrics.timestamp > stale ? monitorState.metrics : null;
        const players = monitorState.players
          ? monitorState.players.filter((p) => (p.timestamp as number) > stale)
          : [];
        const totalChunks = players.reduce(
          (s: number, p) => s + ((p.chunkEstimate as number) || 0),
          0
        );
        json(res, {
          tps: metrics ? metrics.tps : 0,
          entities: metrics ? metrics.entities : {},
          players,
          totalChunks,
          updatedAt: now,
        });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    return false;
  };
}

export { createMonitorRoutes };
