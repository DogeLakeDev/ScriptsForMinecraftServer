#!/usr/bin/env node
/**
 * tools/check-modules.mjs — 离线校验 catalog + 已装包
 *
 * - 空 catalog 合法(纯 SDK 仓)
 * - 唯一 id / configKey
 * - requires 闭包(引用必须在 catalog 内)
 * - entry.path 文件存在
 * - 已装包 schemaVersion === 2 且 manifest.id 与 catalog 一致
 *
 * 用法: node tools/check-modules.mjs
 *       node tools/check-modules.mjs --sync   # 先 catalog-sync 再校验
 */
import fs from "node:fs";
import path from "node:path";
import { readCatalog, syncCatalogFromPackages } from "./lib/catalog.mjs";
import { scanInstalledPackages } from "./lib/packages.mjs";
import { ROOT } from "./lib/paths.mjs";
import { exists } from "./lib/io.mjs";

const doSync = process.argv.includes("--sync");

function fail(msg) {
  console.error(`[check-modules] FAIL: ${msg}`);
  process.exit(1);
}

function main() {
  if (doSync) {
    const { count } = syncCatalogFromPackages();
    console.log(`[check-modules] synced catalog (${count} modules)`);
  }

  const catalog = readCatalog();
  const modules = catalog.modules;
  console.log(`[check-modules] catalog modules: ${modules.length}`);

  if (modules.length === 0) {
    const pkgs = scanInstalledPackages();
    if (pkgs.length > 0) {
      fail(
        `catalog 为空但 packages/ 有 ${pkgs.length} 个已装包 — 运行 node tools/catalog-sync.mjs`
      );
    }
    console.log("[check-modules] OK (empty catalog, no installed packages)");
    return;
  }

  const ids = new Set();
  const keys = new Set();
  const idList = modules.map((m) => m.id);

  for (const m of modules) {
    if (!m.id || typeof m.id !== "string") fail("条目缺少 id");
    if (!m.configKey || typeof m.configKey !== "string") fail(`${m.id}: 缺少 configKey`);
    if (ids.has(m.id)) fail(`重复 id: ${m.id}`);
    if (keys.has(m.configKey)) fail(`重复 configKey: ${m.configKey}`);
    ids.add(m.id);
    keys.add(m.configKey);

    if (!m.entry || !m.entry.path) fail(`${m.id}: 缺少 entry.path`);
    const abs = path.join(ROOT, m.entry.path);
    if (!exists(abs)) fail(`${m.id}: entry 不存在: ${m.entry.path}`);

    const folder = String(m.entry.path).replace(/\\/g, "/").split("/")[2];
    const manifestPath = path.join(ROOT, "modules", "packages", folder, "sapi", "manifest.json");
    if (!exists(manifestPath)) fail(`${m.id}: 缺少 packages/${folder}/sapi/manifest.json`);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (e) {
      fail(`${m.id}: manifest 解析失败: ${e.message}`);
    }
    if (manifest.schemaVersion !== 2) {
      fail(`${m.id}: schemaVersion 应为 2，实际 ${manifest.schemaVersion}`);
    }
    if (manifest.id !== m.id) {
      fail(`${m.id}: catalog.id 与 manifest.id(${manifest.id}) 不一致`);
    }
  }

  for (const m of modules) {
    const reqs = Array.isArray(m.requires) ? m.requires : [];
    for (const dep of reqs) {
      if (!ids.has(dep)) fail(`${m.id}: requires "${dep}" 不在 catalog 中`);
    }
  }

  // 警告:磁盘有包但不在 catalog
  for (const pkg of scanInstalledPackages()) {
    if (!ids.has(pkg.manifest.id)) {
      console.warn(
        `[check-modules] WARN: packages/${pkg.folder} (manifest.id=${pkg.manifest.id}) 未入 catalog — 运行 catalog-sync`
      );
    }
  }

  console.log(`[check-modules] OK (${modules.length} modules, closure ok)`);
}

try {
  main();
} catch (e) {
  fail(e?.message ?? String(e));
}
