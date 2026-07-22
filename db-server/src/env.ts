/**
 * env.ts — 环境配置加载
 */

import { ensureJsonConfig, modulePath, resolveRuntimeRoot } from "@sfmc/sdk/node/config";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { log } from "./lib/log.js";

import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DB_CONFIG = {
  db_port: 3001,
  dbDir: "data/sfmc_data.db",
  modulesDir: "modules",
} as const;

const DEFAULT_QQ_CONFIG = {
  llbot_host: "127.0.0.1",
  llbot_port: 3004,
  llbot_token: "",
} as const;

export interface EnvConfig {
  PROJECT_ROOT: string;
  PORT: number;
  HOST: string;
  DB_PATH: string;
  AUTH_TOKEN: string;
  // LLBot HTTP
  LLBOT_HOST: string;
  LLBOT_PORT: number;
  LLBOT_TOKEN: string;
  // QQ 群 / channel(从 qq_config.json 透出,给 bridge / messages 路由用)
  QQ_GROUP_ID: string;
  QQ_BRIDGE_CHANNEL_ID: string;
  MODULES_DIR: string;
  MODULE_CATALOG_PATH: string;
  MODULE_LOCK_PATH: string;
  dbconfig: Record<string, unknown>;
  qqconfig: Record<string, unknown>;
}

export function loadEnv(): EnvConfig {
  const PROJECT_ROOT = resolveRuntimeRoot(resolve(__dirname, "..", ".."));
  /* 启动时确认 db/qq config 存在;不存在就写带默认值的骨架。
   * 不依赖 wizard:wizard 只填字段,骨架由服务自己 ensure。 */
  const dbconfig = ensureJsonConfig<Record<string, unknown>>(
    PROJECT_ROOT,
    "db_config.json",
    DEFAULT_DB_CONFIG as unknown as Record<string, unknown>
  );
  const qqconfig = ensureJsonConfig<Record<string, unknown>>(
    PROJECT_ROOT,
    "qq_config.json",
    DEFAULT_QQ_CONFIG as unknown as Record<string, unknown>
  );

  // ── 优先级:JSON > 系统环境变量 > 默认值 ───────────────────────
  const envBaseline = { ...process.env };

  // 元数据前缀:`_` 开头视为注释/说明(如 _comment / _comment_group),不写 env、不打日志
  const isMeta = (k: string): boolean => String(k).startsWith("_");

  for (const [k, v] of Object.entries(dbconfig)) {
    if (isMeta(k)) continue;
    const envKey = k.replace(/([A-Z])/g, "_$1").toUpperCase();
    process.env[envKey] = String(v);
    log.info(`db_config::${k} -> process.env.${envKey} = ${String(v)}`);
  }
  for (const [k, v] of Object.entries(qqconfig)) {
    if (isMeta(k)) continue;
    const envKey = k.replace(/([A-Z])/g, "_$1").toUpperCase();
    if (process.env[envKey] === undefined) {
      process.env[envKey] = String(v);
      log.info(`qq_config::${k} -> process.env.${envKey} = ${String(v)}`);
    }
  }

  // 工具:JSON > envBaseline(原 process.env) > default
  // 语义:JSON 里有这个键(非 undefined / null)就用 JSON;空串、0、false 都算"显式配置"
  // 只有 JSON 完全没这个键(或者显式 null)才 fall through 到 env
  function pick<T>(jsonVal: T | undefined | null, envKey: string, fallback: T, source: string): T {
    if (jsonVal !== undefined && jsonVal !== null) {
      return jsonVal;
    }
    const fromEnv = envBaseline[envKey];
    if (fromEnv !== undefined && fromEnv !== "") {
      log.info(`${source} 未在 JSON 中配置,使用系统环境变量 ${envKey} = ${fromEnv}`);
      return fromEnv as unknown as T;
    }
    return fallback;
  }

  const PORT = parseInt(String(pick(dbconfig["db_port"] as number | undefined, "DB_PORT", 3001, "db_port")), 10);
  const HOST = "127.0.0.1";
  const DB_PATH_RAW = String(pick(dbconfig["dbDir"] as string | undefined, "DB_DIR", "data/sfmc_data.db", "dbDir"));
  const DB_PATH = isAbsolute(DB_PATH_RAW) ? DB_PATH_RAW : resolve(PROJECT_ROOT, DB_PATH_RAW);
  const LLBOT_HOST = String(
    pick(qqconfig["llbot_host"] as string | undefined, "LLBOT_HOST", "127.0.0.1", "llbot_host")
  );
  const LLBOT_PORT = parseInt(
    String(pick(qqconfig["llbot_port"] as number | undefined, "LLBOT_PORT", 3004, "llbot_port")),
    10
  );
  const LLBOT_TOKEN = String(pick(qqconfig["llbot_token"] as string | undefined, "LLBOT_TOKEN", "", "llbot_token"));
  const QQ_GROUP_ID = String(pick(qqconfig["qq_group_id"] as string | undefined, "QQ_GROUP_ID", "", "qq_group_id"));
  const QQ_BRIDGE_CHANNEL_ID = String(
    pick(qqconfig["bridge_channel_id"] as string | undefined, "BRIDGE_CHANNEL_ID", "", "bridge_channel_id")
  );
  const AUTH_TOKEN = String(pick(dbconfig["http_auth"] as string | undefined, "HTTP_AUTH", "", "http_auth"));
  const MODULES_DIR = dbconfig["modulesDir"]
    ? resolve(PROJECT_ROOT, String(dbconfig["modulesDir"]))
    : join(PROJECT_ROOT, "modules");
  const MODULE_CATALOG_PATH = modulePath(MODULES_DIR, "catalog.json");
  const MODULE_LOCK_PATH = modulePath(MODULES_DIR, "module-lock.json");

  return {
    PROJECT_ROOT,
    PORT,
    HOST,
    DB_PATH,
    AUTH_TOKEN,
    LLBOT_HOST,
    LLBOT_PORT,
    LLBOT_TOKEN,
    QQ_GROUP_ID,
    QQ_BRIDGE_CHANNEL_ID,
    MODULES_DIR,
    MODULE_CATALOG_PATH,
    MODULE_LOCK_PATH,
    dbconfig,
    qqconfig,
  };
}
