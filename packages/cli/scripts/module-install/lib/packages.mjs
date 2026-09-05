// @ts-check
/**
 * 扫描 modules/packages/<id>/sapi/manifest.json 并投影为 catalog 条目
 *
 * v3 兼容：若 manifest.schemaVersion === 3，则把 semantic 块原样投影进 catalog 条目；
 *          v2 manifest 不带 semantic，catalog 条目也不带。
 */
import fs from "node:fs";
import path from "node:path";
import { exists, readJson } from "./io.mjs";
import { catalogEntryRelPath, packageDir, packageEntryPath, packageManifestPath, PACKAGES_DIR } from "./paths.mjs";

/**
 * @typedef {object} PackageInfo
 * @property {string} folder  packages 下目录名(registry install id)
 * @property {*} manifest
 * @property {string} manifestPath
 * @property {string} entryAbs
 * @property {boolean} hasEntry
 */

/**
 * v3 semantic 块投影后形状（catalog 与 manifest 同源；后续沙箱可直接读）。
 * @typedef {{
 *   configKeys?: string[],
 *   dependsOn?: string[],
 *   events?: { emits?: string[], listens?: string[] },
 *   dbTables?: Array<{ name: string, columns?: string[] }>,
 *   publicApi?: Array<{ symbol: string, description?: string, params?: Array<{ name: string, type: string, required?: boolean, description?: string }>, returns?: { type: string, description?: string } }>
 * }} SemanticBlock
 */

/**
 * @typedef {import("@sfmc-bds/sdk/contracts").ModuleCatalogEntry} CatalogEntry
 */

/** @returns {PackageInfo[]} */
export function scanInstalledPackages() {
  if (!exists(PACKAGES_DIR)) return [];
  /** @type {PackageInfo[]} */
  const out = [];
  for (const ent of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const folder = ent.name;
    const abs = path.join(PACKAGES_DIR, folder);
    // 跟随 symlink：Dirent.isDirectory() 对链接目录为 false
    try {
      if (!fs.statSync(abs).isDirectory()) continue;
    } catch {
      continue;
    }
    const manifestPath = packageManifestPath(folder);
    if (!exists(manifestPath)) continue;
    const manifest = readJson(manifestPath, null);
    if (!manifest || typeof manifest !== "object") continue;
    const entryAbs = packageEntryPath(folder);
    out.push({
      folder,
      manifest,
      manifestPath,
      entryAbs,
      hasEntry: exists(entryAbs),
    });
  }
  out.sort((a, b) => a.folder.localeCompare(b.folder));
  return out;
}

/**
 * 从 v2 / v3 manifest 及包所在目录名投影生成 catalog 条目。
 * - v2 manifest：投影基础核心字段，不包含 semantic 块；
 * - v3 manifest：在核心字段基础上将 semantic 块深拷贝透传至条目中；
 * - 契约原则：本函数仅做结构投影与深拷贝，不负责校验字段形状合法性；形状校验统一以 SDK 的 `validateManifest` 为准（由 check-modules 离线自检或安装器统一调用）。
 *
 * @param {string} folder 安装目录名。
 * @param {Record<string, unknown>} manifest 原始 manifest 对象。
 * @returns {CatalogEntry} 投影生成的 catalog 条目。
 */
export function projectCatalogEntry(folder, manifest) {
  const id = String(manifest.id || "").trim();
  const configKey = String(manifest.configKey || "").trim();
  if (!id) throw new Error(`packages/${folder}: manifest.id 缺失`);
  if (!configKey) throw new Error(`packages/${folder}: manifest.configKey 缺失`);

  /* 缺省：默认启用、允许禁用；不可禁用须在 manifest 显式 canDisable:false */
  const enabledByDefault = typeof manifest.enabledByDefault === "boolean" ? manifest.enabledByDefault : true;
  const canDisable = typeof manifest.canDisable === "boolean" ? manifest.canDisable : true;

  /** @type {CatalogEntry} */
  const entry = {
    id,
    configKey,
    name: String(manifest.name || configKey),
    description: String(manifest.description || ""),
    enabledByDefault,
    canDisable,
    requires: Array.isArray(manifest.requires) ? manifest.requires.map(String) : [],
    entry: {
      kind: "sapi",
      path: catalogEntryRelPath(folder),
    },
  };
  /* v3 semantic 语义块投影：
   * 采用 structuredClone 执行只读深拷贝透传，不在此处重复校验字段形状。
   * 契约原则：字段形状与类型的合法性统一以 SDK validateManifest 为唯一权威（由 check-modules 等上层检查脚本统一调用验证）。 */
  if (manifest.schemaVersion === 3 && manifest.semantic && typeof manifest.semantic === "object") {
    entry.semantic = /** @type {SemanticBlock} */ (structuredClone(manifest.semantic));
  }
  return entry;
}


/** @param {string} folder @returns {CatalogEntry | null} */
export function loadPackageCatalogEntry(folder) {
  const manifestPath = packageManifestPath(folder);
  if (!exists(manifestPath)) return null;
  const manifest = readJson(manifestPath, null);
  if (!manifest) return null;
  return projectCatalogEntry(folder, manifest);
}

/** @param {string} folder */
export function packageExists(folder) {
  return exists(packageDir(folder));
}

/**
 * 从 entry.path 解析 packages 目录名
 * @param {string} entryPath
 */
export function folderFromEntryPath(entryPath) {
  const m = String(entryPath || "")
    .replace(/\\/g, "/")
    .match(/modules\/packages\/([^/]+)\//);
  return m ? m[1] : null;
}
