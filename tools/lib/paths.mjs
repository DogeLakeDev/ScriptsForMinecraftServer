/**
 * tools/lib/paths.mjs — 仓库根与模块相关路径
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 本包目录（tools/ 或 node_modules/@sfmc-bds/tools/） */
export const TOOLS_PKG_DIR = path.resolve(__dirname, "..");

/**
 * 主仓根目录。
 * 优先 SFMC_ROOT（与 db-server / 冒烟脚本一致）；否则按 tools/lib 相对路径回退到 monorepo 根。
 * 从 npm 安装到 node_modules 时务必设置 SFMC_ROOT。
 */
export const ROOT = process.env.SFMC_ROOT
  ? path.resolve(process.env.SFMC_ROOT)
  : path.resolve(__dirname, "..", "..");

export const MODULES_DIR = path.join(ROOT, "modules");
export const PACKAGES_DIR = path.join(MODULES_DIR, "packages");
export const CATALOG_PATH = path.join(MODULES_DIR, "catalog.json");
export const MODULE_LOCK_PATH = path.join(MODULES_DIR, "module-lock.json");
export const CONFIGS_DIR = path.join(ROOT, "configs");
export const DB_SERVER_DIST = path.join(ROOT, "db-server", "dist", "index.js");
export const SFMC_DIST = path.join(ROOT, "sfmc", "dist", "main.js");
/** 始终指向本包内脚本，勿拼 ROOT/tools（npm 安装时 ROOT≠包父目录） */
export const FETCH_MODULE = path.join(TOOLS_PKG_DIR, "fetch-module.mjs");
export const NEW_MODULE = path.join(TOOLS_PKG_DIR, "new-module.mjs");

/** @param {string} folder  packages/<folder> */
export function packageDir(folder) {
  return path.join(PACKAGES_DIR, folder);
}

/** @param {string} folder */
export function packageManifestPath(folder) {
  return path.join(PACKAGES_DIR, folder, "sapi", "manifest.json");
}

/** @param {string} folder */
export function packageEntryPath(folder) {
  return path.join(PACKAGES_DIR, folder, "sapi", "src", "index.ts");
}

/** catalog.entry.path 用正斜杠相对仓库根 */
export function catalogEntryRelPath(folder) {
  return `modules/packages/${folder}/sapi/src/index.ts`;
}
