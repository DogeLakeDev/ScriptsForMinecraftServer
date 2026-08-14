// @ts-check
/**
 * tools/lib/packages.mjs — 扫描 packages/<id>/sapi/manifest.json 并投影为 catalog 条目
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
 * @typedef {object} CatalogEntry
 * @property {string} id
 * @property {string} configKey
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} enabledByDefault
 * @property {boolean} canDisable
 * @property {string[]} requires
 * @property {{ kind: string, path: string }} entry
 * @property {SemanticBlock} [semantic]  v3 字段；v2 模块不写
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
 * 从 v2 / v3 manifest + 目录名投影 catalog 条目。
 * v2 → 与历史完全相同；v3 → 把 semantic 块原样带进 catalog（沙箱读模块语义镜像）。
 * @param {string} folder
 * @param {Record<string, unknown>} manifest
 * @returns {CatalogEntry}
 */
export function projectCatalogEntry(folder, manifest) {
  const type = String(manifest.type || "feature");
  const id = String(manifest.id || "").trim();
  const configKey = String(manifest.configKey || "").trim();
  if (!id) throw new Error(`packages/${folder}: manifest.id 缺失`);
  if (!configKey) throw new Error(`packages/${folder}: manifest.configKey 缺失`);

  const enabledByDefault = typeof manifest.enabledByDefault === "boolean" ? manifest.enabledByDefault : type === "core";
  const canDisable = typeof manifest.canDisable === "boolean" ? manifest.canDisable : type !== "core";

  /** @type {CatalogEntry} */
  const entry = {
    id,
    configKey,
    name: String(manifest.name || configKey),
    type,
    description: String(manifest.description || ""),
    enabledByDefault,
    canDisable,
    requires: Array.isArray(manifest.requires) ? manifest.requires.map(String) : [],
    entry: {
      kind: "sapi",
      path: catalogEntryRelPath(folder),
    },
  };
  /* v3 semantic 投影：原样复制即可（catalog 与 manifest 同源）。
   * 此处不再做形状校验——check-modules 才是权威校验点。 */
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
