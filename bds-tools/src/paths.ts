/**
 * paths.ts — 路径常量 & 加载 bds_updater.json
 *
 * ROOT_DIR = 项目根,通过 SDK 统一解析(env SFMC_ROOT > __dirname 上溯)。
 * SCRIPT_DIR = bds-tools/ 内部 dist 目录,bds 的 PID / log / cache 文件落盘处。
 */

import {
  configPath,
  DEFAULT_BDS_UPDATER_CONFIG,
  loadEnsuredConfig,
  resolveRuntimeRoot,
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
export const LOG_PATH: string = path.join(SCRIPT_DIR, "update.log");
export const VERSION_CACHE: string = path.join(SCRIPT_DIR, ".version_cache.json");
export const PID_FILE: string = path.join(SCRIPT_DIR, ".bds.pid");
export const ROLLBACK_MARKER: string = path.join(SCRIPT_DIR, ".last_update_rollback.json");

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
