/**
 * env.ts — 环境配置加载
 */

import { readFileSync } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export interface EnvConfig {
  PROJECT_ROOT: string;
  PORT: number;
  HOST: string;
  DB_PATH: string;
  AUTH_TOKEN: string;
  QQ_BRIDGE_HOST: string;
  QQ_BRIDGE_PORT: number;
  MODULES_DIR: string;
  MODULE_CATALOG_PATH: string;
  MODULE_LOCK_PATH: string;
  dbconfig: Record<string, unknown>;
  qqconfig: Record<string, unknown>;
}

function readJSON(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadEnv(): EnvConfig {
  const PROJECT_ROOT = process.env["SFMC_ROOT"] || resolve(__dirname, "..");
  const dbcfgPath = join(PROJECT_ROOT, "configs", "db_config.json");
  const qqcfgPath = join(PROJECT_ROOT, "configs", "qq_config.json");
  const dbconfig = readJSON(dbcfgPath);
  const qqconfig = readJSON(qqcfgPath);

  for (const [k, v] of Object.entries(dbconfig)) {
    const envKey = k.replace(/([A-Z])/g, "_$1").toUpperCase();
    process.env[envKey] = String(v);
    console.info(`[DogeDB] 配置 ${k} -> process.env.${envKey} = ${String(v)}`);
  }

  const PORT = parseInt(String(dbconfig["db_port"] ?? "3001"), 10);
  const HOST = "127.0.0.1";
  const configuredDbPath = String(
    process.env["SFMC_DB_PATH"] ?? dbconfig["dbDir"] ?? "./data/sfmc_data.db"
  );
  const DB_PATH = isAbsolute(configuredDbPath)
    ? configuredDbPath
    : resolve(PROJECT_ROOT, configuredDbPath);
  const QQ_BRIDGE_HOST = "127.0.0.1";
  const QQ_BRIDGE_PORT = parseInt(String(qqconfig["qq_http_port"] ?? "3003"), 10);
  const AUTH_TOKEN = String(dbconfig["http_auth"] ?? "");
  const MODULES_DIR = dbconfig["modulesDir"]
    ? resolve(String(dbconfig["modulesDir"]))
    : join(PROJECT_ROOT, "modules");
  const MODULE_CATALOG_PATH = join(MODULES_DIR, "catalog.json");
  const MODULE_LOCK_PATH = join(MODULES_DIR, "module-lock.json");

  return {
    PROJECT_ROOT,
    PORT,
    HOST,
    DB_PATH,
    AUTH_TOKEN,
    QQ_BRIDGE_HOST,
    QQ_BRIDGE_PORT,
    MODULES_DIR,
    MODULE_CATALOG_PATH,
    MODULE_LOCK_PATH,
    dbconfig,
    qqconfig,
  };
}
