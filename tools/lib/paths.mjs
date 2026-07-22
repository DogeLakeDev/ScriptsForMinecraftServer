/**
 * tools/lib/paths.mjs — 仓库根与模块相关路径
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 主仓根目录 */
export const ROOT = path.resolve(__dirname, "..", "..");

export const MODULES_DIR = path.join(ROOT, "modules");
export const PACKAGES_DIR = path.join(MODULES_DIR, "packages");
export const CATALOG_PATH = path.join(MODULES_DIR, "catalog.json");
export const MODULE_LOCK_PATH = path.join(MODULES_DIR, "module-lock.json");
export const CONFIGS_DIR = path.join(ROOT, "configs");
export const CONFIGS_DEFAULT_DIR = path.join(ROOT, "configs-default");
export const DB_SERVER_DIST = path.join(ROOT, "db-server", "dist", "index.js");
export const SFMC_DIST = path.join(ROOT, "sfmc", "dist", "main.js");
export const FETCH_MODULE = path.join(ROOT, "tools", "fetch-module.mjs");

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
