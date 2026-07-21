/**
 * paths.ts — 路径常量 & 加载 bds_updater.json
 *
 * SCRIPT_DIR = 编译产物上一级目录 (即 BDSTools/)
 * 这样无论从 src/ 还是 dist/ 调用，都能找到 scripts/bds-manager.js 等。
 *
 * SEA bundle 模式下优先读 SFMC_ROOT env (由 spawnService 设置)，
 * 退回到 __dirname 兼容原生 CJS standalone 模式。
 */

import fs from "node:fs";
import path from "node:path";
import { configPath, resolveRuntimeRoot } from "@sfmc/sdk/node/config";
import type { BdsUpdaterConfig } from "./types.js";

/** 尝试获取当前脚本所在目录 */
function detectScriptDir(): string {
  // SEA bundle: 由 spawnService 注入 SFMC_ROOT
  if (process.env.SFMC_ROOT) {
    return path.join(process.env.SFMC_ROOT, "bds-tools");
  }
  // 原生 CJS: __dirname 由 Node 提供
  try {
    const here = __dirname;
    const base = path.basename(here);
    if (base === "dist" || base === "src") {
      return path.resolve(here, "..");
    }
    return here;
  } catch {
    return process.cwd();
  }
}

export const SCRIPT_DIR: string = detectScriptDir();
export const ROOT_DIR: string = resolveRuntimeRoot(path.resolve(SCRIPT_DIR, ".."));
export const CFG_PATH: string = configPath(ROOT_DIR, "bds_updater.json");
export const LOG_PATH: string = path.join(SCRIPT_DIR, "update.log");
export const VERSION_CACHE: string = path.join(SCRIPT_DIR, ".version_cache.json");
export const PID_FILE: string = path.join(SCRIPT_DIR, ".bds.pid");
export const ROLLBACK_MARKER: string = path.join(SCRIPT_DIR, ".last_update_rollback.json");

/** 加载并解析 bds_updater.json */
export function loadConfig(): BdsUpdaterConfig {
  try {
    const raw = fs.readFileSync(CFG_PATH, "utf-8");
    const cfg = JSON.parse(raw) as BdsUpdaterConfig & { _comment?: unknown };
    delete cfg._comment;
    return cfg as BdsUpdaterConfig;
  } catch (e) {
    throw new Error(`无法读取 ${CFG_PATH}: ${(e as Error).message}`);
  }
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
