/**
 * index.ts — 入口(v2 启动顺序)
 *
 * 工作流:
 *   1. 加载 env
 *   2. 校验 Node 版本
 *   3. openDatabase + createPlatformTables(sfmc__audit / sfmc__idempotent)
 *   4. loadManifestV2() — 失败 = 启动失败
 *   5. filterEnabled(loaded, lockFileEnabled)
 *   6. buildModuleAuth({auth_token, enabled_modules})  ← 与 DB 同目录 module-tokens.json
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
import { syncModuleRuntimeState } from "./module-runtime-sync.js";

import { ensureJson, patchJson, readJson } from "@sfmc-bds/sdk/node/config";
import { join } from "node:path";

import { createModuleConfigRoutes } from "./routes/module-config-routes.js";
import { createDbRoutes } from "./routes/db-routes.js";
import { createServiceRoutes } from "./routes/service-routes.js";
import { jsonV2Fail } from "./routes/_shared.js";

import { createStatusRoutes } from "./routes/status.js";
import { createQqBindRoutes } from "./routes/qq-bind.js";
import { createQqJoinRoutes, type JoinFeatureFlags } from "./routes/qq-join.js";
import { createQqEventsRoutes } from "./routes/qq-events.js";
import { createMessagesRoutes } from "./routes/messages.js";
import { createModuleRoutes } from "./routes/modules.js";
import { createConfigRoutes } from "./routes/config.js";
import { createHealthRoutes } from "./routes/health.js";
import { forwardToQQBridge, makeOutboundConfig } from "./domain/bridge.js";
import {
  createQqEventsAggregator,
  resolveQqEventsConfig,
} from "./domain/qq-events.js";
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

// ── 模块 HMAC token map(与 DB 同目录 module-tokens.json)────────
const moduleAuth = buildModuleAuth({
  dbPath: env.DB_PATH,
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
        can_disable: moduleCanDisable(raw as Record<string, unknown>),
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

/** catalog 省略 canDisable 时默认允许禁用(与 buildModuleList.can_disable 同源)。 */
function moduleCanDisable(raw: Record<string, unknown>): boolean {
  return raw.canDisable !== false;
}

function resolveModuleByKey(key: string) {
  const k = String(key || "").trim();
  const catalog = loadModuleCatalog();
  const raw = catalog.find(
    (m) =>
      String((m as Record<string, unknown>).id || "") === k ||
      String((m as Record<string, unknown>).configKey || (m as Record<string, unknown>).config_key || "") === k
  ) as Record<string, unknown> | undefined;
  if (!raw) return null;
  const id = String(raw.id || "").trim();
  const configKey = String(raw.configKey || raw.config_key || "").trim();
  if (!id || !configKey) return null;
  /* LSP:与 buildModuleList.can_disable 同源 — 省略字段视为可禁用 */
  return { id, configKey, canDisable: moduleCanDisable(raw) };
}

function setModuleEnabled(mod: { id: string; canDisable: boolean }, enabled: boolean) {
  // 直接更新启动时缓存的 lockFile(而非另读一份新副本),
  // 否则 buildModuleList() 读的仍是旧缓存,导致启停后 enabled 状态不翻转。
  updateModuleState(lockFile, mod.id, { enabled: !!enabled });
  // DRY:与 loadModuleLock 对称走 saveModuleLock,勿散落 writeJson
  saveModuleLock(env.MODULE_LOCK_PATH, lockFile);

  // DIP:热同步 enabledSet / tokens / manifests / builtin handlers(不重启 db-server)
  syncModuleRuntimeState({
    moduleId: mod.id,
    enabled: !!enabled,
    dbPath: env.DB_PATH,
    envAuthToken: env.AUTH_TOKEN,
    enabledSet,
    enabledManifests,
    loadedManifest,
    moduleAuth,
    serviceRegistry,
    builtinDeps: { query, db },
  });
}

// ── 平台路由(非模块业务) ───────────────────────────────────
const healthRoutes = createHealthRoutes();
const statusRoutes = createStatusRoutes({ query });
const qqBindRoutes = createQqBindRoutes({ query, body, json });

/** 模块 qq-link 的配置文件（非 SDK qq_config） */
const QQ_LINK_CONFIG_KEY = "qq_link";
const QQ_LINK_DEFAULTS = {
  allowlist_enabled: true,
  require_approval: true,
  /** 是否将 QQ 群主/群管视作 SFMC 管理员；仅改本文件，API/群聊不可写 */
  treat_group_admins_as_admins: false,
} as const;

function asConfigBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback;
}

function qqLinkConfigFile(): string {
  return join(env.PROJECT_ROOT, "configs", `${QQ_LINK_CONFIG_KEY}.json`);
}

function readJoinFlags(): JoinFeatureFlags {
  // 模块配置 configs/qq_link.json（非 SDK qq_config）
  const disk = ensureJson<Record<string, unknown>>(qqLinkConfigFile(), { ...QQ_LINK_DEFAULTS });
  return {
    allowlistEnabled: asConfigBool(disk.allowlist_enabled, QQ_LINK_DEFAULTS.allowlist_enabled),
    requireApproval: asConfigBool(disk.require_approval, QQ_LINK_DEFAULTS.require_approval),
    treatGroupAdminsAsAdmins: asConfigBool(
      disk.treat_group_admins_as_admins,
      QQ_LINK_DEFAULTS.treat_group_admins_as_admins
    ),
  };
}

function writeJoinFlags(partial: Partial<JoinFeatureFlags>): JoinFeatureFlags {
  const file = qqLinkConfigFile();
  ensureJson<Record<string, unknown>>(file, { ...QQ_LINK_DEFAULTS });
  const patch: Record<string, boolean> = {};
  if (partial.allowlistEnabled !== undefined) patch.allowlist_enabled = partial.allowlistEnabled;
  if (partial.requireApproval !== undefined) patch.require_approval = partial.requireApproval;
  // 故意不写 treat_group_admins_as_admins：仅人工改 configs/qq_link.json
  if (Object.keys(patch).length > 0) {
    patchJson(file, patch);
  }
  return readJoinFlags();
}

// 启动即落盘模块默认配置，避免「从未点过配置/申请」时 configs/qq_link.json 不存在
{
  const created = !readJson(qqLinkConfigFile());
  ensureJson<Record<string, unknown>>(qqLinkConfigFile(), { ...QQ_LINK_DEFAULTS });
  if (created) {
    log.info(`已写入模块配置骨架: configs/${QQ_LINK_CONFIG_KEY}.json`);
  }
}

const qqJoinRoutes = createQqJoinRoutes({
  query,
  body,
  json,
  getAdminOpenids: () => {
    const raw = env.qqconfig["qq_admin_openids"];
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x).trim()).filter(Boolean);
  },
  getJoinFlags: () => readJoinFlags(),
  setJoinFlags: (partial) => writeJoinFlags(partial),
});

function currentOutbound() {
  return makeOutboundConfig({
    QQ_BACKEND: env.QQ_BACKEND,
    LLBOT_HOST: env.LLBOT_HOST,
    LLBOT_PORT: env.LLBOT_PORT,
    LLBOT_TOKEN: env.LLBOT_TOKEN,
    QQ_GROUP_ID: env.QQ_GROUP_ID,
    QQ_APP_ID: env.QQ_APP_ID,
    QQ_APP_SECRET: env.QQ_APP_SECRET,
    QQ_SANDBOX: env.QQ_SANDBOX,
    QQ_GROUP_OPENID: env.QQ_GROUP_OPENID,
    MCTOQQ_PREFIX: env.MCTOQQ_PREFIX,
  });
}

const qqEventsAggregator = createQqEventsAggregator({
  getConfig: () => resolveQqEventsConfig(env.qqconfig["qq_events"]),
  getOutbound: () => currentOutbound(),
});
const qqEventsRoutes = createQqEventsRoutes({
  body,
  json,
  aggregator: qqEventsAggregator,
});

const messagesRoutes = createMessagesRoutes({
  query,
  body,
  json,
  getBridgeChannelId: () => String(env.QQ_BRIDGE_CHANNEL_ID ?? "").trim(),
  forwardToQQBridge: (channelId: string, fromName: string, content: string, fromId: string) =>
    forwardToQQBridge(currentOutbound(), channelId, fromName, content, fromId),
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
      path === "/api/sfmc/status" ||
      path === "/api/sfmc/qq/join/apply-queue" ||
      path === "/api/sfmc/qq/join/settings" ||
      path === "/api/sfmc/qq/admin/action-queue" ||
      (method === "GET" &&
        (path === "/api/sfmc/modules" ||
          path === "/api/sfmc/modules/catalog" ||
          path.startsWith("/api/sfmc/modules/") ||
          path === "/api/sfmc/qq/bind/me" ||
          path === "/api/sfmc/qq/join/pending"));
    // bind/join/events POST 与 messages 一样走旧 AUTH_TOKEN（若配置）；游戏/桥同为 loopback
    const NEEDS_AUTH =
      !PUBLIC_GET &&
      method !== "GET" &&
      !(
        path.startsWith("/api/sfmc/qq/bind/") ||
        path.startsWith("/api/sfmc/qq/join/") ||
        path.startsWith("/api/sfmc/qq/admin/") ||
        path.startsWith("/api/sfmc/qq/events")
      );
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
    if (await statusRoutes(ctxBase)) return;
    if (await qqBindRoutes(ctxBase)) return;
    if (await qqJoinRoutes(ctxBase)) return;
    if (await qqEventsRoutes(ctxBase)) return;
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
