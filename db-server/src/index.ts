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
 *      旧 业务路由(lands/economy/coops/...)保留直到对应模块迁 v2
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
import { SchemaRegistry } from "./schema-registry.js";
import { ServiceRegistry } from "./service-registry.js";
import { TxRunner } from "./tx-runner.js";

import { createModuleConfigRoutes } from "./routes/module-config-routes.js";
import { createDbRoutes } from "./routes/db-routes.js";
import { createServiceRoutes } from "./routes/service-routes.js";

import { createActivitiesRoutes } from "./routes/activities.js";
import { createChannelsRoutes } from "./routes/channels.js";
import { createConfigRoutes } from "./routes/config.js";
import { createCoopsRoutes } from "./routes/coops.js";
import { createEconomyRoutes } from "./routes/economy.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLandsRoutes } from "./routes/lands.js";
import { createMessagesRoutes } from "./routes/messages.js";
import { createModuleRoutes } from "./routes/modules.js";
import { createMonitorRoutes } from "./routes/monitor.js";
import { createPlayersRoutes } from "./routes/players.js";
import { createRedpacketRoutes } from "./routes/redpacket.js";
import { createScoreboardsRoutes } from "./routes/scoreboards.js";
import { createWorldRoutes } from "./routes/world.js";

import { forwardToQQBridge, makeLLBotConfig } from "./domain/bridge.js";
import {
  economyResult as domainEconomyResult,
  ensureEconomyAccount as domainEnsureEconomyAccount,
} from "./domain/economy.js";
import { readJsonFile, writeJsonFile } from "./lib/json.js";
import { isEnabled, loadModuleLock, updateModuleState } from "./lib/module-state.js";
import { body as sharedBody, json as sharedJson } from "./lib/http.js";

if (!assertNodeVersion(22, 5)) {
  process.exit(2);
}

const env = loadEnv();
const db = openDatabase(env.DB_PATH);
createPlatformTables(db); // 只建平台表(sfmc__audit / sfmc__idempotent)
const query = createQuery(db);

// ── v2 manifest 加载(失败 = 启动失败)─────────────────────────
const loadedManifest = loadManifestV2(); // throws on violation
log.success(
  `[manifest v2] loaded ${Object.keys(loadedManifest.modules).length} modules; provides ${loadedManifest.providesMap.size} services`
);

// ── enabled 集合(从 lock file)─────────────────────────────
let lockFile = loadModuleLock(env.MODULE_LOCK_PATH);
const moduleCatalog = readJsonFile<{ modules?: unknown[] }>(env.MODULE_CATALOG_PATH, {
  modules: [],
});
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
  schema: schemaRegistry,
  serviceRegistry,
  enabled: enabledManifests,
});

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
        config_key: configKey,
        display_name: String((raw as Record<string, unknown>).name || configKey),
        type: String((raw as Record<string, unknown>).type || "feature"),
        description: String((raw as Record<string, unknown>).description || ""),
        default_enabled: (raw as Record<string, unknown>).enabledByDefault !== false,
        can_disable: (raw as Record<string, unknown>).canDisable !== false,
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
  const lock = loadModuleLock(env.MODULE_LOCK_PATH);
  updateModuleState(lock, mod.id, { enabled: !!enabled });
  writeJsonFile(env.MODULE_LOCK_PATH, lock);
  // 同步内存缓存,避免写入后立即读取(如 enable/disable 接口的返回值)仍是旧状态
  lockFile = lock;
}

// ── 路由工厂实例 (旧业务路径 — 保留直到各模块迁 v2) ────────────────
const monitorState = {
  metrics: null as { tps: number; entities: Record<string, number>; timestamp: number } | null,
  players: [] as Array<{ name?: string; dimension?: string; chunkEstimate?: number; timestamp: number }>,
};

const healthRoutes = createHealthRoutes();
const scoreboardsRoutes = createScoreboardsRoutes({ query, body, json });
const worldRoutes = createWorldRoutes({ query, body, json });
const playersRoutes = createPlayersRoutes({ query, body, json });
const activitiesRoutes = createActivitiesRoutes({ query, body, json });
const channelsRoutes = createChannelsRoutes({ query, body, json });
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
const redpacketRoutes = createRedpacketRoutes({
  query,
  db,
  body,
  json,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
  economyResult: (acc: unknown) => {
    const view = domainEconomyResult(acc as Parameters<typeof domainEconomyResult>[0]);
    return view ? { balance: view.balance, version: view.version } : null;
  },
});
const monitorRoutes = createMonitorRoutes({ body, json, monitorState });
const configRoutes = createConfigRoutes({ json, projectRoot: env.PROJECT_ROOT });
const economyRoutes = createEconomyRoutes({ query, db });
const landsRoutes = createLandsRoutes({
  query,
  db,
  body,
  json,
  projectRoot: env.PROJECT_ROOT,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
});
const coopsRoutes = createCoopsRoutes({
  query,
  db,
  body,
  json,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
  economyResult: (acc: unknown) => {
    const view = domainEconomyResult(acc as Parameters<typeof domainEconomyResult>[0]);
    return view ? { balance: view.balance, version: view.version } : null;
  },
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

  // ── v2 模块身份校验:写 req.moduleAuth ────────────────────
  const needsModuleAuth =
    path.startsWith("/api/sfmc/db/") ||
    path.startsWith("/api/sfmc/services") ||
    /^\/api\/sfmc\/configs\/[A-Za-z0-9_-]+(?:\/(?:set|notify))?$/.test(path);
  if (needsModuleAuth) {
    const id = verifyModuleAuth({
      headers: req.headers,
      params,
      auth: moduleAuth,
      enabledModuleIds: enabledSet,
    });
    if (!id) {
      json(res, { success: false, error: "unauthorized: module identity invalid" }, 401);
      return;
    }
    const manifest = enabledManifests.get(id);
    (req as http.IncomingMessage & { moduleAuth: { id: string; permissions: string[] } }).moduleAuth = {
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
    const reqWithAuth = req as http.IncomingMessage & { moduleAuth?: { id: string; permissions: string[] } };
    if (reqWithAuth.moduleAuth && (path.startsWith("/api/sfmc/db/") || path.startsWith("/api/sfmc/services") || /^\/api\/sfmc\/configs\/[A-Za-z0-9_-]+/.test(path))) {
      const ctx: Record<string, unknown> = {
        path,
        method,
        params,
        req,
        res,
      };
      ctx["body"] = (req as http.IncomingMessage & { _body?: Record<string, unknown> })._body ?? {};
      if (path.startsWith("/api/sfmc/db/")) {
        if (await dbRoutes(ctx)) return;
      } else if (path.startsWith("/api/sfmc/services")) {
        if (await serviceRoutes(ctx)) return;
      } else {
        if (await moduleConfigRoutes(ctx)) return;
      }
    }

    // ── 旧路由 ──────────────────────────────────────
    const ctxBase = { path, method, params, req, res } as { path: string; method: string; params: URLSearchParams; req: http.IncomingMessage; res: http.ServerResponse };
    if (await moduleRoutesInstance(ctxBase)) return;
    if (await healthRoutes(ctxBase)) return;
    if (await scoreboardsRoutes(ctxBase)) return;
    if (await worldRoutes(ctxBase)) return;
    if (await playersRoutes(ctxBase)) return;
    if (await activitiesRoutes(ctxBase)) return;
    if (await channelsRoutes(ctxBase)) return;
    if (await messagesRoutes(ctxBase)) return;
    if (await redpacketRoutes(ctxBase)) return;
    if (await monitorRoutes(ctxBase)) return;
    if (await configRoutes(ctxBase)) return;
    if (await economyRoutes(ctxBase)) return;
    if (await landsRoutes(ctxBase)) return;
    if (await coopsRoutes(ctxBase)) return;

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
