/**
 * tools/lib/catalog.mjs — modules/catalog.json 读写与同步
 */
import { CATALOG_PATH } from "./paths.mjs";
import { readJson, writeJson } from "./io.mjs";
import {
  folderFromEntryPath,
  loadPackageCatalogEntry,
  projectCatalogEntry,
  scanInstalledPackages,
} from "./packages.mjs";

const DEFAULT_COMMENT =
  "modules/catalog.json 是本地 mirror；source of truth 为 github:Tanya7z/sfmc-modules/main/index.json。条目由已安装的 modules/packages/<id>/sapi/manifest.json 投影生成（fetch-module install / catalog-sync）。空数组表示纯 SDK 仓，合法。";

/**
 * @typedef {import("./packages.mjs").CatalogEntry} CatalogEntry
 * @typedef {{ _comment?: string, version: number, modules: CatalogEntry[] }} ModuleCatalog
 */

/** @returns {ModuleCatalog} */
export function readCatalog() {
  const raw = readJson(CATALOG_PATH, null);
  if (!raw || typeof raw !== "object") {
    return { _comment: DEFAULT_COMMENT, version: 1, modules: [] };
  }
  return {
    _comment: typeof raw._comment === "string" ? raw._comment : DEFAULT_COMMENT,
    version: typeof raw.version === "number" ? raw.version : 1,
    modules: Array.isArray(raw.modules) ? raw.modules : [],
  };
}

/** @param {ModuleCatalog} catalog */
export function writeCatalog(catalog) {
  writeJson(CATALOG_PATH, {
    _comment: catalog._comment || DEFAULT_COMMENT,
    version: catalog.version || 1,
    modules: catalog.modules || [],
  });
}

/**
 * 扫描 packages 全量重写 catalog.modules
 * @returns {{ catalog: ModuleCatalog, count: number }}
 */
export function syncCatalogFromPackages() {
  const prev = readCatalog();
  /** @type {CatalogEntry[]} */
  const modules = [];
  for (const pkg of scanInstalledPackages()) {
    modules.push(projectCatalogEntry(pkg.folder, pkg.manifest));
  }
  const catalog = {
    _comment: prev._comment || DEFAULT_COMMENT,
    version: prev.version || 1,
    modules,
  };
  writeCatalog(catalog);
  return { catalog, count: modules.length };
}

/**
 * install 后 upsert 单条
 * @param {string} folder
 * @returns {CatalogEntry}
 */
export function upsertCatalogEntry(folder) {
  const entry = loadPackageCatalogEntry(folder);
  if (!entry) throw new Error(`packages/${folder}: 无有效 sapi/manifest.json`);
  const catalog = readCatalog();
  const idx = catalog.modules.findIndex(
    (m) => m.id === entry.id || (m.entry && folderFromEntryPath(m.entry.path) === folder)
  );
  if (idx >= 0) catalog.modules[idx] = entry;
  else catalog.modules.push(entry);
  catalog.modules.sort((a, b) => a.id.localeCompare(b.id));
  writeCatalog(catalog);
  return entry;
}

/**
 * uninstall 后按 folder 或 manifest.id 删除
 * @param {string} folderOrId
 * @returns {CatalogEntry | null} 被删条目
 */
export function removeCatalogEntry(folderOrId) {
  const catalog = readCatalog();
  const idx = catalog.modules.findIndex((m) => {
    if (m.id === folderOrId) return true;
    return folderFromEntryPath(m.entry?.path) === folderOrId;
  });
  if (idx < 0) return null;
  const [removed] = catalog.modules.splice(idx, 1);
  writeCatalog(catalog);
  return removed;
}
