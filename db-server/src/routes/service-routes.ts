/**
 * routes/service-routes.ts — /api/sfmc/services/* 处理器
 *
 * 端点:
 *   GET  /api/sfmc/services               → { services: [{name, moduleId}] }
 *   GET  /api/sfmc/services/:name?input=<urlencoded json>
 *        → { ok: true, result } | { ok: false, error, code, status }
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { json as defaultJson, type Method } from "../lib/http.js";
import type { ServiceRegistry } from "../service-registry.js";

export interface ServiceRoutesDeps {
  serviceRegistry: ServiceRegistry;
  enabled: Map<string, import("../manifest-loader.js").ModuleManifestV2>;
  json?: typeof defaultJson;
}

type ModuleAuth = { id: string; permissions: string[] };

function getModuleAuth(req: IncomingMessage): ModuleAuth | null {
  return (req as IncomingMessage & { moduleAuth?: ModuleAuth }).moduleAuth ?? null;
}

export function createServiceRoutes(depsIn: Partial<ServiceRoutesDeps>) {
  const deps = depsIn as Partial<ServiceRoutesDeps>;
  if (!deps.serviceRegistry || !deps.enabled) {
    throw new Error("createServiceRoutes: 缺少 serviceRegistry / enabled map");
  }
  const json = deps.json || defaultJson;

  return async (ctx: {
    path: string;
    method: Method | string;
    params: URLSearchParams;
    req: IncomingMessage;
    res: ServerResponse;
  }): Promise<boolean> => {
    const { path, method, params, req, res } = ctx;
    if (!path.startsWith("/api/sfmc/services")) return false;
    if (method !== "GET") return false;

    const auth = getModuleAuth(req);
    if (!auth) {
      json(res, { success: false, error: "unauthorized: module identity missing" }, 401);
      return true;
    }

    if (path === "/api/sfmc/services") {
      json(res, { services: deps.serviceRegistry!.list() });
      return true;
    }

    const m = path.match(/^\/api\/sfmc\/services\/([A-Za-z0-9_.]+)$/);
    if (m && m[1]) {
      const name = m[1];
      const rawInput = params.get("input");
      let payload: unknown = {};
      if (rawInput) {
        try {
          payload = JSON.parse(rawInput);
        } catch (e) {
          json(res, { success: false, error: `invalid input json: ${(e as Error).message}` }, 400);
          return true;
        }
      }
      try {
        const out = await deps.serviceRegistry!.dispatch(
          deps.enabled!,
          auth.id,
          name,
          payload
        );
        json(res, { ok: true, result: out.result });
      } catch (e) {
        const err = e as { status?: number; code?: string; message: string };
        json(
          res,
          { success: false, error: err.message, code: err.code ?? "internal" },
          err.status ?? 500
        );
      }
      return true;
    }

    return false;
  };
}
