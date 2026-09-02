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
import { jsonV2Fail, type ModuleAuth } from "./_shared.js";

export interface ServiceRoutesDeps {
  serviceRegistry: ServiceRegistry;
  enabled: Map<string, import("../manifest-loader.js").ModuleManifestV2>;
  json?: typeof defaultJson;
}

/**
 * 创建 `/api/sfmc/services/*` 跨模块服务路由请求处理器。
 *
 * @param depsIn 依赖注入项（包含 serviceRegistry、enabled 模块字典等）。
 * @returns 异步路由处理函数。
 */
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
      jsonV2Fail(res, "unauthorized: module identity missing", 401, "unauthorized");
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
          jsonV2Fail(res, `invalid input json: ${(e as Error).message}`, 400, "bad_request");
          return true;
        }
      }
      try {
        // 与 tx-runner 保持契约一致：HTTP GET 与 tx.call 均须声明在 services.requires 中且具备对应权限
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
          jsonV2Fail(res, e.message, 403, "permission_denied");
          return true;
        }
        const err = e as { status?: number; code?: string; message: string };
        jsonV2Fail(res, err.message, err.status ?? 500, err.code ?? "internal");
      }
      return true;
    }

    return false;
  };
}
