/**
 * index.ts — 入口
 *
 * 工作流:
 *   1. 加载 env（覆盖 process.env）
 *   2. 校验 Node 版本
 *   3. 启动数据库 + 初始化 schema
 *   4. 装配所有路由
 *   5. 启动 HTTP 服务
 */

import http from "node:http";

import { loadEnv } from "./env.js";
import { openDatabase, createQuery } from "./lib/sqlite.js";
import { initSchema } from "./domain/schema.js";
import { assertNodeVersion } from "./lib/runtime.js";
import { createServer, startConsole } from "./server.js";
import { body as sharedBody, json as sharedJson } from "./lib/http.js";
import { log } from "./lib/log.js";

import { createHealthRoutes } from "./routes/health.js";
import { createScoreboardsRoutes } from "./routes/scoreboards.js";
import { createWorldRoutes } from "./routes/world.js";
import { createPlayersRoutes } from "./routes/players.js";
import { createActivitiesRoutes } from "./routes/activities.js";
import { createChannelsRoutes } from "./routes/channels.js";
import { createMessagesRoutes } from "./routes/messages.js";
import { createRedpacketRoutes } from "./routes/redpacket.js";
import { createMonitorRoutes } from "./routes/monitor.js";
import { createConfigRoutes } from "./routes/config.js";
import { createEconomyRoutes } from "./routes/economy.js";
import { createLandsRoutes } from "./routes/lands.js";
import { createCoopsRoutes } from "./routes/coops.js";
import { createModuleRoutes } from "./routes/modules.js";

import { ensureEconomyAccount as domainEnsureEconomyAccount, economyResult as domainEconomyResult } from "./domain/economy.js";
import { forwardToQQBridge, makeLLBotConfig } from "./domain/bridge.js";
import { readJsonFile } from "./lib/json.js";
import { loadModuleLock, isEnabled, updateModuleState } from "./lib/module-state.js";
import { writeJsonFile } from "./lib/json.js";

if (!assertNodeVersion(22, 5)) {
  process.exit(2);
}

const env = loadEnv();
const db = openDatabase(env.DB_PATH);
initSchema(db); // ← 唯一 schema 初始化

const query = createQuery(db);

// ── 内存存储（监控面板用）──────────────────────────────────────────
const monitorState = {
  metrics: null as { tps: number; entities: Record<string, number>; timestamp: number } | null,
  players: [] as Array<{ name?: string; dimension?: string; chunkEstimate?: number; timestamp: number }>,
};

// ── 辅助函数 ────────────────────────────────────────────────────
// 复用 lib/http.ts 的统一 json / body —— 路由内部使用同源
const json = sharedJson;
const body = sharedBody;

// ── 模块目录加载（供 moduleRoutes 使用）──────────────────────────
function loadModuleCatalog() {
  const data = readJsonFile<{ version?: number; modules?: unknown[] }>(env.MODULE_CATALOG_PATH, { version: 1, modules: [] });
  return Array.isArray(data.modules) ? data.modules : [];
}

function buildModuleList() {
  const catalog = loadModuleCatalog();
  const lock = loadModuleLock(env.MODULE_LOCK_PATH);
  return catalog.map((raw) => {
    const entry = (raw as Record<string, unknown>).entry && typeof (raw as Record<string, unknown>).entry === "object"
      ? (raw as Record<string, unknown>).entry as Record<string, unknown>
      : {};
    const id = String((raw as Record<string, unknown>).id || "").trim();
    const configKey = String((raw as Record<string, unknown>).configKey || (raw as Record<string, unknown>).config_key || "").trim();
    if (!id || !configKey) return null;
    const state = (lock.modules as Record<string, { updatedAt?: number }>)[id];
    const enabled = isEnabled(lock, id, (raw as Record<string, unknown>).enabledByDefault !== false);
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
  }).filter(Boolean);
}

function resolveModuleByKey(key: string) {
  const catalog = loadModuleCatalog();
  const k = String(key || "").trim();
  return catalog.find((m) =>
    String((m as Record<string, unknown>).id || "") === k ||
    String((m as Record<string, unknown>).configKey || (m as Record<string, unknown>).config_key || "") === k
  ) as { id: string; configKey: string; canDisable: boolean } | null;
}

function setModuleEnabled(module: { id: string; canDisable: boolean }, enabled: boolean) {
  const lock = loadModuleLock(env.MODULE_LOCK_PATH);
  updateModuleState(lock, module.id, { enabled: !!enabled });
  writeJsonFile(env.MODULE_LOCK_PATH, lock);
}

// ── 路由工厂实例 ────────────────────────────────────────────────
const healthRoutes = createHealthRoutes() as any;
const scoreboardsRoutes = createScoreboardsRoutes({ query, body, json } as any) as any;
const worldRoutes = createWorldRoutes({ query, body, json } as any) as any;
const playersRoutes = createPlayersRoutes({ query, body, json } as any) as any;
const activitiesRoutes = createActivitiesRoutes({ query, body, json } as any) as any;
const channelsRoutes = createChannelsRoutes({ query, body, json } as any) as any;
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
} as any) as any;
const redpacketRoutes = createRedpacketRoutes({
  query: query as any, db, body, json,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query as any, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
  economyResult: (acc: unknown) => {
    const view = domainEconomyResult(acc as Parameters<typeof domainEconomyResult>[0]);
    return view ? { balance: view.balance, version: view.version } : null;
  },
}) as any;
const monitorRoutes = createMonitorRoutes({ body, json, monitorState } as any) as any;
const configRoutes = createConfigRoutes({ json, projectRoot: env.PROJECT_ROOT } as any) as any;
const economyRoutes = createEconomyRoutes({ query: query as any, db, body, json } as any) as any;
const landsRoutes = createLandsRoutes({
  query: query as any, db, body, json, projectRoot: env.PROJECT_ROOT,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query as any, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
}) as any;
const coopsRoutes = createCoopsRoutes({
  query: query as any, db, body, json,
  ensureEconomyAccount: (playerId: string, playerName: string) => {
    const acc = domainEnsureEconomyAccount(query as any, playerId, playerName);
    if (!acc) throw new Error("ensureEconomyAccount returned undefined");
    return { balance: acc.balance, player_id: acc.player_id, version: acc.version };
  },
  economyResult: (acc: unknown) => {
    const view = domainEconomyResult(acc as Parameters<typeof domainEconomyResult>[0]);
    return view ? { balance: view.balance, version: view.version } : null;
  },
}) as any;
const moduleRoutesInstance = createModuleRoutes({
  loadModuleCatalog,
  buildModuleList: buildModuleList as () => Record<string, unknown>[],
  resolveModuleByKey,
  setModuleEnabled,
  body,
  json,
} as any);

// ── 主请求处理器 ─────────────────────────────────────────────────
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

  // token 鉴权
  const PUBLIC_GET = path === "/api/health" ||
    (method === "GET" && (
      path === "/api/sfmc/modules" ||
      path === "/api/sfmc/modules/catalog" ||
      path.startsWith("/api/sfmc/modules/")
    ));
  const NEEDS_AUTH = !PUBLIC_GET && method !== "GET";
  if (env.AUTH_TOKEN && NEEDS_AUTH) {
    const auth = req.headers["authorization"] || "";
    const provided = auth.startsWith("Bearer ")
      ? auth.slice(7)
      : (req.headers["x-db-token"] as string || "");
    if (provided !== env.AUTH_TOKEN) {
      json(res, { success: false, error: "unauthorized" }, 401);
      return;
    }
  }

  // 预读 body
  await body(req);

  try {
    // /api/sfmc/modules/*
    if (await moduleRoutesInstance({ path, method, params, req, res })) return;

    // /api/health
    if (await healthRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/scoreboards
    if (await scoreboardsRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/world
    if (await worldRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/players
    if (await playersRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/activities
    if (await activitiesRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/channels
    if (await channelsRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/messages
    if (await messagesRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/redpacket
    if (await redpacketRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/monitor/*
    if (await monitorRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/db/* — 内联读取 / sqlite 浏览端点
    if (path === "/api/sfmc/db/tables" && method === "GET") {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
      const result = tables.map((t) => {
        const count = db.prepare(`SELECT COUNT(*) AS cnt FROM "${t.name.replace(/[^A-Za-z0-9_]/g, "")}"`).get() as { cnt: number };
        return { name: t.name, rows: count.cnt };
      });
      json(res, { tables: result });
      return;
    }

    if (path.startsWith("/api/sfmc/db/table/")) {
      const tname = path.slice("/api/sfmc/db/table/".length);
      if (!tname || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tname)) {
        json(res, { success: false, error: "invalid table name" }, 400);
        return;
      }
      try {
        const safeTable = `"${tname}"`;
        const columns = db.prepare(`PRAGMA table_info(${safeTable})`).all();
        const rows = db.prepare(`SELECT * FROM ${safeTable} LIMIT 20`).all();
        json(res, { columns, rows });
      } catch (e) {
        json(res, { success: false, error: (e as Error).message }, 500);
      }
      return;
    }

    // /api/sfmc/configs/*
    if (await configRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/economy/*
    if (await economyRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/lands/*
    if (await landsRoutes({ path, method, params, req, res })) return;

    // /api/sfmc/coops/*
    if (await coopsRoutes({ path, method, params, req, res })) return;

    json(res, { success: false, error: "not_found" }, 404);
  } catch (err) {
    log.err(err, "DogeDB");
    json(res, { success: false, error: (err as Error).message }, 500);
  }
}

// ── 启动 ────────────────────────────────────────────────────────
const server = createServer({
  env: { PORT: env.PORT, HOST: env.HOST, AUTH_TOKEN: env.AUTH_TOKEN },
  handle,
});
startConsole(server, db);

export { env, db, query };
