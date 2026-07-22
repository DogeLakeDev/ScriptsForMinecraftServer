/**
 * tools/lib/packages.mjs — 扫描 packages/<id>/sapi/manifest.json 并投影为 catalog 条目
 */
import fs from "node:fs";
import { catalogEntryRelPath, packageDir, packageEntryPath, packageManifestPath, PACKAGES_DIR } from "./paths.mjs";
import { exists, readJson } from "./io.mjs";

/**
 * @typedef {object} PackageInfo
 * @property {string} folder  packages 下目录名(registry install id)
 * @property {object} manifest
 * @property {string} manifestPath
 * @property {string} entryAbs
 * @property {boolean} hasEntry
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
 */

/** @returns {PackageInfo[]} */
export function scanInstalledPackages() {
  if (!exists(PACKAGES_DIR)) return [];
  /** @type {PackageInfo[]} */
  const out = [];
  for (const ent of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    const folder = ent.name;
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
 * 从 v2 manifest + 目录名投影 catalog 条目
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

  const enabledByDefault =
    typeof manifest.enabledByDefault === "boolean" ? manifest.enabledByDefault : type === "core";
  const canDisable = typeof manifest.canDisable === "boolean" ? manifest.canDisable : type !== "core";

  return {
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
  const m = String(entryPath || "").replace(/\\/g, "/").match(/modules\/packages\/([^/]+)\//);
  return m ? m[1] : null;
}
