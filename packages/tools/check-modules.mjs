#!/usr/bin/env node
// @ts-check
/**
 * tools/check-modules.mjs — 离线校验 catalog + 已装包
 *
 * - 空 catalog 合法(纯平台仓)
 * - 唯一 id / configKey、requires 闭包、manifest v2/v3
 *
 * 用法:
 *   node tools/check-modules.mjs
 *   node tools/check-modules.mjs --sync   # 先 catalog-sync 再校验
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readCatalog, syncCatalogFromPackages } from "./lib/catalog.mjs";
import { exists } from "./lib/io.mjs";
import { folderFromEntryPath, scanInstalledPackages } from "./lib/packages.mjs";
import { ROOT } from "./lib/paths.mjs";

/**
 * @typedef {object} CheckModulesOpts
 * @property {boolean} [sync]
 */

/**
 * @typedef {object} CheckModulesResult
 * @property {boolean} ok
 * @property {string} [error]
 * @property {string} [summary]
 */

/**
 * @param {*} manifest
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
function validateManifest(manifest) {
  const v = manifest?.schemaVersion;
  if (v === 3) {
    const errors = checkV3(manifest);
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true };
  }
  if (v === 2) {
    const errors = checkV2(manifest);
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true };
  }
  return { ok: false, errors: [`schemaVersion 应为 2 或 3，实际 ${v}`] };
}

/** @param {*} r */
function checkV2(r) {
  const errs = [];
  if (!r || typeof r !== "object") return ["manifest 根必须是 plain object"];
  if (r.schemaVersion !== 2) errs.push("schemaVersion 必须为 2");
  if (!r.id || typeof r.id !== "string") errs.push("id 缺失或类型错");
  if (!r.name || typeof r.name !== "string") errs.push("name 缺失或类型错");
  if (r.type !== "core" && r.type !== "feature") errs.push(`type 必须是 "core" 或 "feature"，实际为 ${r.type}`);
  if (!r.configKey || typeof r.configKey !== "string") errs.push("configKey 缺失");
  if (!Array.isArray(r.requires)) errs.push("requires 必须是数组");
  if (!Array.isArray(r.permissions)) errs.push("permissions 必须是数组");
  if (!r.services || typeof r.services !== "object") errs.push("services 缺失");
  return errs;
}

/** @param {*} r */
function checkV3(r) {
  if (!r || typeof r !== "object") return ["manifest 根必须是 plain object"];
  const errs = [];
  if (r.schemaVersion !== 3) errs.push(`schemaVersion 必须为 3，实际为 ${r.schemaVersion}`);
  if (!r.id || typeof r.id !== "string") errs.push("id 缺失或类型错");
  if (!r.name || typeof r.name !== "string") errs.push("name 缺失或类型错");
  if (r.type !== "core" && r.type !== "feature") errs.push(`type 必须是 "core" 或 "feature"，实际为 ${r.type}`);
  if (!r.configKey || typeof r.configKey !== "string") errs.push("configKey 缺失");
  if (!Array.isArray(r.requires)) errs.push("requires 必须是数组");
  if (!Array.isArray(r.permissions)) errs.push("permissions 必须是数组");
  if (!r.services || typeof r.services !== "object") errs.push("services 缺失");
  const s = r.semantic;
  if (s !== undefined && s !== null && typeof s !== "object") {
    errs.push("semantic 必须是 plain object（缺失合法）");
    return errs;
  }
  if (s && typeof s === "object") {
    if (s.configKeys !== undefined && !Array.isArray(s.configKeys)) {
      errs.push("[semantic.configKeys] 必须是字符串数组");
    }
    if (s.dependsOn !== undefined && !Array.isArray(s.dependsOn)) {
      errs.push("[semantic.dependsOn] 必须是字符串数组");
    }
    if (s.events !== undefined && (s.events === null || typeof s.events !== "object")) {
      errs.push("[semantic.events] 必须是 plain object");
    }
    if (s.dbTables !== undefined && !Array.isArray(s.dbTables)) {
      errs.push("[semantic.dbTables] 必须是数组");
    }
    if (s.publicApi !== undefined && !Array.isArray(s.publicApi)) {
      errs.push("[semantic.publicApi] 必须是数组");
    }
  }
  return errs;
}

/**
 * @param {CheckModulesOpts} [opts]
 * @returns {CheckModulesResult}
 */
export function runCheckModules(opts = {}) {
  const doSync = opts.sync ?? false;

  try {
    if (doSync) {
      syncCatalogFromPackages();
    }

    const catalog = readCatalog();
    const modules = catalog.modules;

    if (modules.length === 0) {
      const pkgs = scanInstalledPackages();
      if (pkgs.length > 0) {
        return {
          ok: false,
          error: `catalog 为空但 packages/ 有 ${pkgs.length} 个已装包 — 运行 catalog-sync 或 fetch-module install`,
        };
      }
      return { ok: true, summary: "check-modules OK (空 catalog，无已装包)" };
    }

    const ids = new Set();
    const keys = new Set();

    for (const m of modules) {
      if (!m.id || typeof m.id !== "string") return { ok: false, error: "条目缺少 id" };
      if (!m.configKey || typeof m.configKey !== "string") return { ok: false, error: `${m.id}: 缺少 configKey` };
      if (ids.has(m.id)) return { ok: false, error: `重复 id: ${m.id}` };
      if (keys.has(m.configKey)) return { ok: false, error: `重复 configKey: ${m.configKey}` };
      ids.add(m.id);
      keys.add(m.configKey);

      if (!m.entry || !m.entry.path) return { ok: false, error: `${m.id}: 缺少 entry.path` };
      const abs = path.join(ROOT, m.entry.path);
      if (!exists(abs)) return { ok: false, error: `${m.id}: entry 不存在: ${m.entry.path}` };

      const folder = folderFromEntryPath(m.entry.path);
      if (!folder) return { ok: false, error: `${m.id}: 无法从 entry.path 解析 packages 目录` };

      const manifestPath = path.join(ROOT, "modules", "packages", folder, "sapi", "manifest.json");
      if (!exists(manifestPath)) return { ok: false, error: `${m.id}: 缺少 manifest.json` };

      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: `${m.id}: manifest 解析失败: ${message}` };
      }

      const v = validateManifest(manifest);
      if (!v.ok) {
        return { ok: false, error: `${m.id}: manifest 校验未通过 — ${v.errors.join("; ")}` };
      }
      if (manifest.id !== m.id) {
        return { ok: false, error: `${m.id}: catalog.id 与 manifest.id(${manifest.id}) 不一致` };
      }
    }

    for (const m of modules) {
      const reqs = Array.isArray(m.requires) ? m.requires : [];
      for (const dep of reqs) {
        if (!ids.has(dep)) return { ok: false, error: `${m.id}: requires "${dep}" 不在 catalog 中` };
      }
    }

    for (const pkg of scanInstalledPackages()) {
      if (!ids.has(pkg.manifest.id)) {
        console.warn(
          `[check-modules] WARN: packages/${pkg.folder} (${pkg.manifest.id}) 未入 catalog — 运行 catalog-sync`
        );
      }
    }

    return { ok: true, summary: `check-modules OK (${modules.length} modules)` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

function main() {
  const doSync = process.argv.includes("--sync");
  const result = runCheckModules({ sync: doSync });
  if (!result.ok) {
    console.error(`[check-modules] FAIL: ${result.error}`);
    process.exit(1);
  }
  console.log(`[check-modules] ${result.summary}`);
}

const __checkModulesMain = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__checkModulesMain)) {
  main();
}
