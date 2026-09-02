/**
 * routes/module-config-routes.ts — 模块私有配置文件读写路由
 *
 * REST 端点：
 * - GET  /api/sfmc/configs/:configKey       读取对应 `configs/<configKey>.json` 配置文件
 * - POST /api/sfmc/configs/:configKey/set   修改并持久化指定配置键值对
 * - GET  /api/sfmc/configs/:configKey/notify 通过 SSE 推送配置实时变更通知
 *
 * 鉴权控制：
 * 模块身份经 `ctx.moduleAuth` 验证；必须具备 `config:read:<configKey>` 或 `config:write:<configKey>` 权限。
 */

import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJson, writeJson } from "@sfmc-bds/sdk/node/config";
import { json as defaultJson, type Method } from "../lib/http.js";
import { assertModulePermission, Perm } from "../permission-gate.js";
import type { ModuleManifestV2 } from "../manifest-loader.js";
import { jsonV2Fail, type ModuleAuth } from "./_shared.js";

export interface ModuleConfigRoutesDeps {
  projectRoot: string;
  enabled: Map<string, ModuleManifestV2>;
  json?: typeof defaultJson;
}

function configPath(projectRoot: string, key: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error(`invalid configKey "${key}"`);
  }
  return join(projectRoot, "configs", `${key}.json`);
}

function readConfig(file: string): Record<string, unknown> {
  const parsed = readJson<unknown>(file);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

const subscribers = new Map<string, Set<(payload: unknown) => void>>();

function subscribe(configKey: string, cb: (payload: unknown) => void): () => void {
  if (!subscribers.has(configKey)) subscribers.set(configKey, new Set());
  subscribers.get(configKey)!.add(cb);
  return () => {
    subscribers.get(configKey)?.delete(cb);
  };
}

function notify(configKey: string, key: string, value: unknown): void {
  const set = subscribers.get(configKey);
  if (!set) return;
  for (const cb of set) cb({ key, value });
}

/**
 * 创建模块私有配置路由请求处理器。
 *
 * @param depsIn 依赖注入项（包含工作根目录与已启用模块字典）。
 * @returns 异步路由处理函数。
 */
export function createModuleConfigRoutes(depsIn: Partial<ModuleConfigRoutesDeps>) {

  const deps = depsIn as Partial<ModuleConfigRoutesDeps>;
  if (!deps.projectRoot || !deps.enabled) {
    throw new Error("createModuleConfigRoutes: 缺少 projectRoot / enabled map");
  }
  const json = deps.json || defaultJson;
  const projectRoot = deps.projectRoot;
  const enabled = deps.enabled!;

  return async (ctx: {
    path: string;
    method: Method | string;
    req: IncomingMessage;
    res: ServerResponse;
    body?: Promise<Record<string, unknown>>;
    moduleAuth?: ModuleAuth;
  }): Promise<boolean> => {
    const { path, method, req, res } = ctx;
    const m = path.match(/^\/api\/sfmc\/configs\/([A-Za-z0-9_-]+)(?:\/(set|notify))?$/);
    if (!m) return false;
    const configKey = m[1];
    const tail = m[2];
    const auth = ctx.moduleAuth;
    if (!auth) {
      jsonV2Fail(res, "unauthorized", 401, "unauthorized");
      return true;
    }
    const manifest = enabled.get(auth.id);
    if (!manifest || manifest.configKey !== configKey) {
      jsonV2Fail(res, `模块 ${auth.id} 不持有 configKey "${configKey}"`, 403, "forbidden");
      return true;
    }

    const file = configPath(projectRoot, configKey);

    if (!tail && method === "GET") {
      try {
        assertModulePermission(auth.id, manifest.permissions, Perm.configRead(configKey));
        const cfg = readConfig(file);
        json(res, { config: cfg });
      } catch (e) {
        const code = (e as { name?: string }).name === "PermissionDeniedError" ? 403 : 500;
        // LSP: GET 失败与 /set 同用 ok 方言
        jsonV2Fail(res, (e as Error).message, code);
      }
      return true;
    }

    if (tail === "set" && method === "POST") {
      try {
        assertModulePermission(auth.id, manifest.permissions, Perm.configWrite(configKey));
        const body = (await (ctx.body as Promise<Record<string, unknown>>)) || {};
        const key = String(body.key);
        const value = body.value;
        const cfg = readConfig(file);
        cfg[key] = value;
        writeJson(file, cfg);
        notify(configKey, key, value);
        json(res, { ok: true });
      } catch (e) {
        // LSP: /set 成功用 ok:true,失败统一 ok:false(勿混用 success)
        const code = (e as { name?: string }).name === "PermissionDeniedError" ? 403 : 500;
        jsonV2Fail(res, (e as Error).message, code);
      }
      return true;
    }

    if (tail === "notify" && method === "GET") {
      // SSE — PoC 把监听留在内存里,不持久化
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(":ok\n\n");
      const unsub = subscribe(configKey, (payload) => {
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          unsub();
        }
      });
      req.on("close", unsub);
      return true;
    }

    return false;
  };
};
