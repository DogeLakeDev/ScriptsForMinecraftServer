/**
 * routes/module-config-routes.ts — 模块配置文件管理
 *
 * 端点:
 *   GET  /api/sfmc/configs/:configKey                 → { config: <configs/<configKey>.json> }
 *   POST /api/sfmc/configs/:configKey/set             → 写一个 key
 *   GET  /api/sfmc/configs/:configKey/notify           (SSE:onChange 推送)
 *
 * 鉴权:模块身份来自 moduleAuth;Permission = config:read:configKey / config:write:configKey。
 *
 * 设计:文件 = configs/<configKey>.json;整文件 read-modify-write(lock by
 * 简单 mutex),不是细粒度 lock — 模块 config 文件本来就小;并发冲突概率极低。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { json as defaultJson, type Method } from "../lib/http.js";
import { assertModulePermission, Perm } from "../permission-gate.js";
import type { ModuleManifestV2 } from "../manifest-loader.js";

export interface ModuleConfigRoutesDeps {
  projectRoot: string;
  enabled: Map<string, ModuleManifestV2>;
  json?: typeof defaultJson;
}

type ModuleAuth = { id: string; permissions: string[] };

function configPath(projectRoot: string, key: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error(`invalid configKey "${key}"`);
  }
  return join(projectRoot, "configs", `${key}.json`);
}

function readConfig(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
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
  }): Promise<boolean> => {
    const { path, method, req, res } = ctx;
    const m = path.match(/^\/api\/sfmc\/configs\/([A-Za-z0-9_-]+)(?:\/(set|notify))?$/);
    if (!m) return false;
    const configKey = m[1];
    const tail = m[2];
    const auth = (req as IncomingMessage & { moduleAuth?: ModuleAuth }).moduleAuth;
    if (!auth) {
      json(res, { success: false, error: "unauthorized" }, 401);
      return true;
    }
    const manifest = enabled.get(auth.id);
    if (!manifest || manifest.configKey !== configKey) {
      json(res, { success: false, error: `模块 ${auth.id} 不持有 configKey "${configKey}"` }, 403);
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
        json(res, { success: false, error: (e as Error).message }, code);
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
        writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
        notify(configKey, key, value);
        json(res, { ok: true });
      } catch (e) {
        const code = (e as { name?: string }).name === "PermissionDeniedError" ? 403 : 500;
        json(res, { success: false, error: (e as Error).message }, code);
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
