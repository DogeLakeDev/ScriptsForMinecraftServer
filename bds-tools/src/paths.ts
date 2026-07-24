/**
 * paths.ts — 路径常量 & 加载 bds_updater.json
 *
 * ROOT_DIR = 项目/数据根,通过 SDK 统一解析(env SFMC_ROOT > __dirname 上溯)。
 * STATE_DIR / LOG_PATH 等运行态路径一律走 SDK stateDir / logFile,勿再手写 ".sfmc"。
 */

import {
  configPath,
  DEFAULT_BDS_UPDATER_CONFIG,
  loadEnsuredConfig,
  logFile,
  resolveRuntimeRoot,
  stateDir,
  type BdsUpdaterConfig,
} from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR: string = path.dirname(__filename);
/** 项目根目录:bds-tools 的上一级。统一通过 SDK 解析。 */
export const ROOT_DIR: string = resolveRuntimeRoot(path.resolve(SCRIPT_DIR, "..", ".."));
export const CFG_PATH: string = configPath(ROOT_DIR, "bds_updater.json");

/** 运行态目录(相对数据根，勿落在 bds-tools/dist) */
export const STATE_DIR: string = stateDir(ROOT_DIR);
export const LOG_PATH: string = logFile(ROOT_DIR, "bds-update");
export const VERSION_CACHE: string = path.join(STATE_DIR, "bds-version-cache.json");
export const PID_FILE: string = path.join(STATE_DIR, "bds.pid");
/** 更新中途失败可恢复的回滚标记 */
export const ROLLBACK_MARKER: string = path.join(STATE_DIR, "last_update_rollback.json");

/** 确保 .sfmc 运行态目录存在(PID 写入等不经 writeJson 的路径需要) */
export function ensureStateDir(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

/** 加载并解析 bds_updater.json。
 *  启动时 ensure 文件存在,避免 wizard 没跑时 bds_updater.json 缺失导致 loadConfig 抛错。 */
export function loadConfig(): BdsUpdaterConfig {
  return loadEnsuredConfig(
    ROOT_DIR,
    "bds_updater.json",
    "bds_updater",
    { ...DEFAULT_BDS_UPDATER_CONFIG } as Record<string, unknown>
  ) as BdsUpdaterConfig;
}

/** 解析后的 BDS 路径 / 备份目录 */
export interface BdsPaths {
  bds_path: string;
  backup_dir: string;
  preserve: string[];
  cfg: BdsUpdaterConfig;
}

export function resolvePaths(cfg: BdsUpdaterConfig): BdsPaths {
  const bds_path = path.resolve(cfg.bds_path || process.cwd());
  const backup_dir = path.resolve(cfg.backup_dir || path.join(bds_path, "..", "backups"));
  const relativeBackup = path.relative(bds_path, backup_dir);
  if (relativeBackup === "" || (!relativeBackup.startsWith("..") && !path.isAbsolute(relativeBackup))) {
    throw new Error("backup_dir must be outside bds_path so deployment cannot delete the backup");
  }
  const preserve = Array.isArray(cfg.preserve) ? cfg.preserve : [];
  return { bds_path, backup_dir, preserve, cfg };
}

/** 删除 PID 文件 */
export function clearPid(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
}
