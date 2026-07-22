#!/usr/bin/env node
/**
 * rebuild-catalog.js — 从已安装的 modules/packages/<folder>/sapi/manifest.json
 * 重建 modules/catalog.json（本地 mirror）。
 *
 * 权威来源：磁盘上的模块包 manifest（DIP：catalog 不再手写维护业务清单）。
 * 空 packages/ → catalog.modules = [] 合法（平台壳，业务模块远程拉取）。
 *
 * 用法: node tools/rebuild-catalog.js [--check]
 *   --check  只校验当前 catalog 是否与 packages 一致，不一致则 exit 1
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "modules", "packages");
const CATALOG_PATH = path.join(ROOT, "modules", "catalog.json");

const CATALOG_COMMENT =
  "modules/catalog.json 是本地 mirror；由 tools/rebuild-catalog.js 根据 modules/packages/*/sapi/manifest.json 生成。" +
  " source of truth 为 github:Tanya7z/sfmc-modules。空 modules 表示尚未安装业务包，可用 tools/fetch-module.mjs install <id>。";

function die(msg) {
  console.error(`[rebuild-catalog] ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function listPackageFolders() {
  if (!fs.existsSync(PACKAGES_DIR)) return [];
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

/**
 * 将单包 manifest 投影为 catalog 条目。
 * entry.path 约定：modules/packages/<folder>/sapi/src/index.ts
 */
function catalogEntryFromPackage(folder) {
  const pkgRoot = path.join(PACKAGES_DIR, folder);
  const manifestPath = path.join(pkgRoot, "sapi", "manifest.json");
  const indexPath = path.join(pkgRoot, "sapi", "src", "index.ts");
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[rebuild-catalog] skip ${folder}: 缺少 sapi/manifest.json`);
    return null;
  }
  if (!fs.existsSync(indexPath)) {
    console.warn(`[rebuild-catalog] skip ${folder}: 缺少 sapi/src/index.ts`);
    return null;
  }
  const m = readJson(manifestPath);
  const id = String(m.id || "").trim();
  const configKey = String(m.configKey || m.config_key || "").trim();
  if (!id || !configKey) {
    console.warn(`[rebuild-catalog] skip ${folder}: manifest 缺少 id/configKey`);
    return null;
  }
  let description = "";
  if (typeof m.notes === "string" && m.notes.trim()) description = m.notes.trim();
  else {
    const pkgJsonPath = path.join(pkgRoot, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        description = String(readJson(pkgJsonPath).description || "");
      } catch {
        /* ignore */
      }
    }
  }
  return {
    id,
    configKey,
    name: String(m.name || configKey),
    type: String(m.type || "feature"),
    description,
    enabledByDefault: m.enabledByDefault !== false,
    canDisable: m.canDisable !== false,
    requires: Array.isArray(m.requires) ? m.requires.map(String) : [],
    entry: {
      kind: "sapi",
      path: `modules/packages/${folder}/sapi/src/index.ts`,
    },
  };
}

function buildCatalog() {
  const modules = [];
  for (const folder of listPackageFolders()) {
    const entry = catalogEntryFromPackage(folder);
    if (entry) modules.push(entry);
  }
  modules.sort((a, b) => a.id.localeCompare(b.id));
  return {
    _comment: CATALOG_COMMENT,
    version: 1,
    modules,
  };
}

function stableModules(modules) {
  return JSON.stringify(modules, null, 2);
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const next = buildCatalog();

  if (checkOnly) {
    if (!fs.existsSync(CATALOG_PATH)) die(`找不到 ${CATALOG_PATH}`);
    const cur = readJson(CATALOG_PATH);
    const curMods = Array.isArray(cur.modules) ? cur.modules : [];
    if (stableModules(curMods) !== stableModules(next.modules)) {
      die(
        `catalog 与 packages 不一致（磁盘 ${next.modules.length} 个，catalog ${curMods.length} 个）。运行: node tools/rebuild-catalog.js`
      );
    }
    console.log(`[rebuild-catalog] OK (check, ${next.modules.length} modules)`);
    return;
  }

  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(next, null, 2) + "\n", "utf-8");
  console.log(`[rebuild-catalog] wrote ${CATALOG_PATH} (${next.modules.length} modules)`);
}

main();
