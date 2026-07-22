/**
 * routes/service-routes.ts — /api/sfmc/services/* 处理器
 *
 * 端点:
 *   GET  /api/sfmc/services               → { services: [{name, moduleId}] }
 *   GET  /api/sfmc/services/:name?input=<urlencoded json>
 *        → { ok: true, result } | { ok: false, error, code } (+ HTTP status)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { json as defaultJson, type Method } from "../lib/http.js";
import { assertModulePermission, Perm, PermissionDeniedError } from "../permission-gate.js";
import type { ServiceRegistry } from "../service-registry.js";
import type { ModuleAuth } from "./_shared.js";

export interface ServiceRoutesDeps {
  serviceRegistry: ServiceRegistry;
  enabled: Map<string, import("../manifest-loader.js").ModuleManifestV2>;
  json?: typeof defaultJson;
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
    moduleAuth?: ModuleAuth;
  }): Promise<boolean> => {
    const { path, method, params, res } = ctx;
    if (!path.startsWith("/api/sfmc/services")) return false;
    if (method !== "GET") return false;

    const auth = ctx.moduleAuth ?? null;
    if (!auth) {
      // LSP: 与成功路径同一 ok 方言(文档约定 { ok:false, error, code })
      json(res, { ok: false, error: "unauthorized: module identity missing", code: "unauthorized" }, 401);
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
          json(
            res,
            { ok: false, error: `invalid input json: ${(e as Error).message}`, code: "bad_request" },
            400
          );
          return true;
        }
      }
      try {
        // 与 tx-runner.doService 对齐(LSP):HTTP service.get 与 tx.call 必须同契约 —
        // 既要在 services.requires 里(由 dispatch 校验),也要有 service:<name> 权限。
        assertModulePermission(auth.id, auth.permissions, Perm.service(name));
        const out = await deps.serviceRegistry!.dispatch(
          deps.enabled!,
          auth.id,
          name,
          payload
        );
        json(res, { ok: true, result: out.result });
      } catch (e) {
        if (e instanceof PermissionDeniedError) {
          json(res, { ok: false, error: e.message, code: "permission_denied" }, 403);
          return true;
        }
        const err = e as { status?: number; code?: string; message: string };
        json(
          res,
          { ok: false, error: err.message, code: err.code ?? "internal" },
          err.status ?? 500
        );
      }
      return true;
    }

    return false;
  };
}
