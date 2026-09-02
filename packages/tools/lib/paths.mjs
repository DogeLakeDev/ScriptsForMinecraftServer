// @ts-check
/**
 * tools/lib/paths.mjs — 仓库根与模块相关路径
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 从 startDir 向上查找 monorepo 根（package.json#name === sfmc-monorepo）。
 * @param {string} startDir
 * @returns {string | null}
 */
export function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const name = JSON.parse(fs.readFileSync(pkgPath, "utf8")).name;
        if (name === "sfmc-monorepo") return dir;
      } catch {
        /* 继续向上 */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** 本包目录（packages/tools/ 或 node_modules/@sfmc-bds/tools/） */
export const TOOLS_PKG_DIR = path.resolve(__dirname, "..");

/**
 * 主仓根目录。
 * 优先 SFMC_ROOT（与 db-server / 冒烟脚本一致）；否则 walk-up 找 sfmc-monorepo。
 * 从 npm 安装到 node_modules 时务必设置 SFMC_ROOT。
 */
export const ROOT = process.env.SFMC_ROOT
  ? path.resolve(process.env.SFMC_ROOT)
  : findMonorepoRoot(__dirname) ?? path.resolve(__dirname, "..", "..", "..");

export const MODULES_DIR = path.join(ROOT, "modules");
export const PACKAGES_DIR = path.join(MODULES_DIR, "packages");
export const CATALOG_PATH = path.join(MODULES_DIR, "catalog.json");
export const MODULE_LOCK_PATH = path.join(MODULES_DIR, "module-lock.json");
export const CONFIGS_DIR = path.join(ROOT, "configs");
export const DB_SERVER_DIST = path.join(ROOT, "packages", "db-server", "dist", "index.js");
export const SFMC_DIST = path.join(ROOT, "packages", "cli", "dist", "main.js");
/** fetch-module 权威入口在 @sfmc-bds/cli（monorepo 相对路径） */
export const FETCH_MODULE = path.join(ROOT, "packages", "cli", "scripts", "module-install", "fetch-module.mjs");

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
