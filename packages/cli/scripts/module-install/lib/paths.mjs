// @ts-check
/**
 * CLI module-install 路径 — modules/packages、catalog、lock（相对 SFMC_ROOT）
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMonorepoRoot } from "@sfmc-bds/sdk/node/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @sfmc-bds/cli 包根（packages/cli 或 node_modules/@sfmc-bds/cli） */
export const CLI_PKG_DIR = path.resolve(__dirname, "..", "..", "..");

/**
 * 工作根目录。
 * 优先 SFMC_ROOT；否则 walk-up 找 sfmc-monorepo；再回退到 cwd。
 */
export const ROOT = process.env.SFMC_ROOT
  ? path.resolve(process.env.SFMC_ROOT)
  : findMonorepoRoot(__dirname) ?? process.cwd();

export const MODULES_DIR = path.join(ROOT, "modules");
export const PACKAGES_DIR = path.join(MODULES_DIR, "packages");
export const CATALOG_PATH = path.join(MODULES_DIR, "catalog.json");
export const MODULE_LOCK_PATH = path.join(MODULES_DIR, "module-lock.json");

/** 本包内 fetch-module 入口（npm 安装时勿拼 ROOT） */
export const FETCH_MODULE = path.join(CLI_PKG_DIR, "scripts", "module-install", "fetch-module.mjs");

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
