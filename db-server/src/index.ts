/**
 * index.ts — 入口(v2 启动顺序)
 *
 * 工作流:
 *   1. 加载 env
 *   2. 校验 Node 版本
 *   3. openDatabase + createPlatformTables(sfmc__audit / sfmc__idempotent)
 *   4. loadManifestV2() — 失败 = 启动失败
 *   5. filterEnabled(loaded, lockFileEnabled)
 *   6. buildModuleAuth({auth_token, enabled_modules})  ← data/module-tokens.json
 *   7. 实例化:SchemaRegistry / ServiceRegistry / IdempotencyStore / TxRunner
 *   8. 装配 v2 路由 (/api/sfmc/db/* + /api/sfmc/services* + /api/sfmc/configs/:key/*)
 *      另保留 messages(qq-bridge) + config/modules/health 平台路由
 *   9. createServer + listen
 *
 * 鉴权(handle 层):
 *   - /api/sfmc/db/*, /api/sfmc/services*, /api/sfmc/configs/:key(/set|notify)*
 *     → module token (Authorization: Bearer ...) + ?moduleId=...
 *   - 其他:env.AUTH_TOKEN 旧 auth(NEEDS_AUTH)
 */

import http from "node:http";

import { createIdempotencyStore } from "./lib/idempotency-store.js";
import { loadEnv } from "./env.js";
import { buildModuleAuth, verifyModuleAuth } from "./module-auth.js";
import { loadManifestV2 } from "./manifest-loader.js";
import { log } from "./lib/log.js";
import { assertNodeVersion } from "./lib/runtime.js";
import { createQuery, openDatabase } from "./lib/sqlite.js";
import { createServer, startConsole } from "./server.js";
import { createPlatformTables } from "./db-tables.js";
import { initSchema } from "./domain/schema.js";
import { SchemaRegistry } from "./schema-registry.js";
import { ServiceRegistry } from "./service-registry.js";
import { TxRunner } from "./tx-runner.js";
import { registerEnabledBuiltinServices } from "./services/builtin-handlers.js";

import { readJson } from "@sfmc-bds/sdk/node/config";

import { createModuleConfigRoutes } from "./routes/module-config-routes.js";
import { createDbRoutes } from "./routes/db-routes.js";
import { createServiceRoutes } from "./routes/service-routes.js";
import { jsonV2Fail } from "./routes/_shared.js";

import { createConfigRoutes } from "./routes/config.js";
import { createHealthRoutes } from "./routes/health.js";
import { createMessagesRoutes } from "./routes/messages.js";
import { createModuleRoutes } from "./routes/modules.js";

import { forwardToQQBridge, makeLLBotConfig } from "./domain/bridge.js";
import { isEnabled, loadModuleLock, saveModuleLock, updateModuleState } from "./lib/module-state.js";
import { body as sharedBody, json as sharedJson } from "./lib/http.js";

if (!assertNodeVersion(22, 13)) {
  process.exit(2);
}

const env = loadEnv();
const db = openDatabase(env.DB_PATH);
createPlatformTables(db); // sfmc__audit / sfmc__idempotent
initSchema(db); // 平台业务 bootstrap 表(players/world/chat/...)——qq-bridge 在 SAPI defineTable 之前就需要
const query = createQuery(db);

// ── v2 manifest 加载(失败 = 启动失败)─────────────────────────
const loadedManifest = loadManifestV2(); // throws on violation
log.success(
  `[manifest v2] loaded ${Object.keys(loadedManifest.modules).length} modules; provides ${loadedManifest.providesMap.size} services`
);

// ── enabled 集合(从 lock file)─────────────────────────────
const lockFile = loadModuleLock(env.MODULE_LOCK_PATH);
const moduleCatalog = readJson<{ modules?: unknown[] }>(env.MODULE_CATALOG_PATH) ?? { modules: [] };
const catalogIds = new Set(
  Array.isArray(moduleCatalog.modules)
    ? (moduleCatalog.modules as Array<{ id?: string }>)
        .map((m) => String(m.id || ""))
        .filter((id) => id.length > 0)
    : []
);
const enabledSet = new Set<string>();
for (const id of Object.keys(loadedManifest.modules)) {
  if (!catalogIds.has(id)) continue;
  const catalogEntry = (moduleCatalog.modules as Array<Record<string, unknown>>).find(
    (m) => String(m.id) === id
  );
  if (!catalogEntry) continue;
  const defaultEnabled = catalogEntry.enabledByDefault !== false;
  if (isEnabled(lockFile, id, defaultEnabled)) enabledSet.add(id);
}
const enabledManifests = new Map<string, NonNullable<typeof loadedManifest.modules[string]>>();
for (const id of enabledSet) {
  const m = loadedManifest.modules[id];
  if (m) enabledManifests.set(id, m);
}
log.info(
  `[manifest v2] enabled: ${[...enabledSet].sort().join(", ") || "(none)"}`
);

// ── 模块 HMAC token map(写到 data/module-tokens.json)────────
const moduleAuth = buildModuleAuth({
  projectRoot: env.PROJECT_ROOT,
  envAuthToken: env.AUTH_TOKEN,
  enabledModuleIds: [...enabledSet],
});

// ── 三件套 + 路由工厂 ─────────────────────────────────────
const schemaRegistry = new SchemaRegistry(db);
const serviceRegistry = new ServiceRegistry();
const idempotent = createIdempotencyStore(db);
const txRunner = new TxRunner({
  db,
  query,
  schema: schemaRegistry,
  serviceRegistry,
  enabled: enabledManifests,
});

// ── 进程内置 service handler(扩展点:BUILTIN_SERVICE_PLUGINS) ──
{
  const plugins = registerEnabledBuiltinServices(serviceRegistry, { query, db }, enabledSet);
  if (plugins > 0) {
    log.success(
      `[service] registered ${serviceRegistry.list().length} handlers from ${plugins} builtin plugin(s)`
    );
  }
}

const json = sharedJson;
const body = sharedBody;

// ── 工具函数 ──────────────────────────────────────────────
function loadModuleCatalog() {
  return Array.isArray(moduleCatalog.modules) ? moduleCatalog.modules : [];
}

function buildModuleList() {
  const catalog = loadModuleCatalog();
  return catalog
    .map((raw) => {
      const entry =
        (raw as Record<string, unknown>).entry && typeof (raw as Record<string, unknown>).entry === "object"
          ? ((raw as Record<string, unknown>).entry as Record<string, unknown>)
          : {};
      const id = String((raw as Record<string, unknown>).id || "").trim();
      const configKey = String(
        (raw as Record<string, unknown>).configKey || (raw as Record<string, unknown>).config_key || ""
      ).trim();
      if (!id || !configKey) return null;
      const state = lockFile.modules[id];
      const enabled = isEnabled(lockFile, id, (raw as Record<string, unknown>).enabledByDefault !== false);
      return {
        id,
        module_id: id,
        name: configKey,
        configKey,
        config_key: configKey,
        display_name: String((raw as Record<string, unknown>).name || configKey),
        type: String((raw as Record<string, unknown>).type || "feature"),
        description: String((raw as Record<string, unknown>).description || ""),
        default_enabled: (raw as Record<string, unknown>).enabledByDefault !== false,
        can_disable: (raw as Record<string, unknown>).canDisable !== false,
        // ConfigManager 认 installed!==false;已装包默认 true
        installed: true,
        requires: Array.isArray((raw as Record<string, unknown>).requires)
          ? ((raw as Record<string, unknown>).requires as unknown[]).filter(Boolean).map(String)
          : [],
        optional: Array.isArray((raw as Record<string, unknown>).optional)
          ? ((raw as Record<string, unknown>).optional as unknown[]).filter(Boolean).map(String)
          : [],
        commands: Array.isArray((raw as Record<string, unknown>).commands)
          ? ((raw as Record<string, unknown>).commands as unknown[]).filter(Boolean).map(String)
          : [],
        entry: {
          kind: String(entry.kind || ""),
          path: String(entry.path || ""),
          init: String(entry.init || ""),
        },
        updated_at: state?.updatedAt ?? null,
        enabled: !!enabled,
      };
    })
    .filter(Boolean);
}

function resolveModuleByKey(key: string) {
  const k = String(key || "").trim();
  const catalog = loadModuleCatalog();
  return catalog.find(
    (m) =>
      String((m as Record<string, unknown>).id || "") === k ||
      String((m as Record<string, unknown>).configKey || (m as Record<string, unknown>).config_key || "") === k
  ) as { id: string; configKey: string; canDisable: boolean } | null;
}

function setModuleEnabled(mod: { id: string; canDisable: boolean }, enabled: boolean) {
  // 直接更新启动时缓存的 lockFile(而非另读一份新副本),
  // 否则 buildModuleList() 读的仍是旧缓存,导致启停后 enabled 状态不翻转。
  updateModuleState(lockFile, mod.id, { enabled: !!enabled });
  // DRY:与 loadModuleLock 对称走 saveModuleLock,勿散落 writeJson
  saveModuleLock(env.MODULE_LOCK_PATH, lockFile);
}

// ── 平台路由(非模块业务) ───────────────────────────────────
const healthRoutes = createHealthRoutes();
const messagesRoutes = createMessagesRoutes({
  query,
  body,
  json,
  forwardToQQBridge: (channelId: string, fromName: string, content: string, fromId: string) =>
    forwardToQQBridge(
      makeLLBotConfig({
        LLBOT_HOST: env.LLBOT_HOST,
        LLBOT_PORT: env.LLBOT_PORT,
        LLBOT_TOKEN: env.LLBOT_TOKEN,
        QQ_GROUP_ID: env.QQ_GROUP_ID,
      }),
      channelId,
      fromName,
      content,
      fromId
    ),
});
const configRoutes = createConfigRoutes({
  json,
  projectRoot: env.PROJECT_ROOT,
  // DIP:路由不读 lock/catalog/token 文件,由入口注入与 /modules 同源数据
  listModules: () => buildModuleList() as Array<Record<string, unknown>>,
  getModuleTokens: () => ({ ...moduleAuth.tokens }),
});
const moduleRoutesInstance = createModuleRoutes({
  loadModuleCatalog,
  buildModuleList: buildModuleList as unknown as () => Array<Record<string, unknown>>,
  resolveModuleByKey,
  setModuleEnabled,
  body,
  json,
});

// ── v2 路由工厂 ───────────────────────────────────────────────
// 类型断言成 unknown 函数 — v2 routes 的 ctx 类型与 RouteCtx 不兼容,
// 但调用契约({path, method, params, req, res, body?})是稳定的。
const dbRoutes = createDbRoutes({ schemaRegistry, txRunner, idempotent, json }) as unknown as (ctx: Record<string, unknown>) => Promise<boolean>;
const serviceRoutes = createServiceRoutes({
  serviceRegistry,
  enabled: enabledManifests,
  json,
}) as unknown as (ctx: Record<string, unknown>) => Promise<boolean>;
const moduleConfigRoutes = createModuleConfigRoutes({
  projectRoot: env.PROJECT_ROOT,
  enabled: enabledManifests,
  json,
}) as unknown as (ctx: Record<string, unknown>) => Promise<boolean>;

// ── 主请求处理器 ────────────────────────────────────────────
async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const method = req.method || "GET";
  const params = url.searchParams;

  // loopback 绑定
  const remote = req.socket.remoteAddress || "";
  if (remote && !remote.startsWith("127.") && remote !== "::1" && remote !== "::ffff:127.") {
    json(res, { success: false, error: "forbidden" }, 403);
    return;
  }

  // ── 预读 body(所有路由共享) ───────────────────────────────
  await body(req);

  // ── v2 模块身份校验 → 写入路由 ctx.moduleAuth(LoD:不挂 req 私有字段) ──
  // 注意:`/api/sfmc/configs/all` 是旧的一次性配置快照端点(SAPI ConfigManager.init
  // 启动必用),不属于 v2 模块配置命名空间(configs/<模块 configKey>),必须豁免,
  // 否则会被模块鉴权网关拦成 401,导致插件端起不来。
  const isLegacyConfigAll = path === "/api/sfmc/configs/all";
  const needsModuleAuth =
    path.startsWith("/api/sfmc/db/") ||
    path.startsWith("/api/sfmc/services") ||
    (/^\/api\/sfmc\/configs\/[A-Za-z0-9_-]+(?:\/(?:set|notify))?$/.test(path) && !isLegacyConfigAll);
  let moduleAuthCtx: { id: string; permissions: string[] } | null = null;
  if (needsModuleAuth) {
    const id = verifyModuleAuth({
      headers: req.headers,
      params,
      auth: moduleAuth,
      enabledModuleIds: enabledSet,
    });
    if (!id) {
      // LSP: v2 模块门与 service-routes 同用 ok 方言
      jsonV2Fail(res, "unauthorized: module identity invalid", 401, "unauthorized");
      return;
    }
    const manifest = enabledManifests.get(id);
    moduleAuthCtx = {
      id,
      permissions: manifest?.permissions ?? [],
    };
  } else {
    // ── 旧 env token 鉴权(只对 POST/PUT 生效) ─────────────
    const PUBLIC_GET =
      path === "/api/health" ||
      (method === "GET" &&
        (path === "/api/sfmc/modules" || path === "/api/sfmc/modules/catalog" || path.startsWith("/api/sfmc/modules/")));
    const NEEDS_AUTH = !PUBLIC_GET && method !== "GET";
    if (env.AUTH_TOKEN && NEEDS_AUTH) {
      const auth = req.headers["authorization"] || "";
      const provided = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-db-token"] as string) || "";
      if (provided !== env.AUTH_TOKEN) {
        json(res, { success: false, error: "unauthorized" }, 401);
        return;
      }
    }
  }

  try {
    // ── v2 路由(优先匹配) ─────────────────────────────
    if (moduleAuthCtx && (path.startsWith("/api/sfmc/db/") || path.startsWith("/api/sfmc/services") || (/^\/api\/sfmc\/configs\/[A-Za-z0-9_-]+/.test(path) && !isLegacyConfigAll))) {
      const ctx: Record<string, unknown> = {
        path,
        method,
        params,
        req,
        res,
        moduleAuth: moduleAuthCtx,
      };
      // body 已在上面 `await body(req)` 预读并缓存到 req._bodyPromise;
      // 这里复用缓存(原实现读的 req._body 从未被赋值,导致所有 v2 路由 body 恒为空)。
      ctx["body"] = await body(req);
      if (path.startsWith("/api/sfmc/db/")) {
        if (await dbRoutes(ctx)) return;
      } else if (path.startsWith("/api/sfmc/services")) {
        if (await serviceRoutes(ctx)) return;
      } else {
        if (await moduleConfigRoutes(ctx)) return;
      }
    }

    // ── 平台路由 ────────────────────────────────────
    const ctxBase = { path, method, params, req, res } as { path: string; method: string; params: URLSearchParams; req: http.IncomingMessage; res: http.ServerResponse };
    if (await moduleRoutesInstance(ctxBase)) return;
    if (await healthRoutes(ctxBase)) return;
    if (await messagesRoutes(ctxBase)) return;
    if (await configRoutes(ctxBase)) return;

    json(res, { success: false, error: "not_found" }, 404);
  } catch (err) {
    log.err(err, "DogeDB");
    json(res, { success: false, error: (err as Error).message }, 500);
  }
}

// ── 启动 ────────────────────────────────────────────────────
const server = createServer({
  env: { PORT: env.PORT, HOST: env.HOST, AUTH_TOKEN: env.AUTH_TOKEN },
  handle,
});
startConsole(server, db);

export { db, env, query, schemaRegistry, serviceRegistry, txRunner, enabledManifests, moduleAuth };
