#!/usr/bin/env node
// @ts-check
/**
 * tools/check-modules.mjs — 离线校验 catalog + 已装包
 *
 * - 空 catalog 合法(纯 SDK 仓)
 * - 唯一 id / configKey
 * - requires 闭包(引用必须在 catalog 内)
 * - entry.path 文件存在
 * - 已装包 schemaVersion ∈ {2, 3}；v3 走语义字段校验；v2 自动 migrate 再 validate（向后兼容）
 * - manifest.id 与 catalog 一致
 *
 * 用法: node tools/check-modules.mjs
 *       node tools/check-modules.mjs --sync   # 先 catalog-sync 再校验
 */
import fs from "node:fs";
import path from "node:path";
import { readCatalog, syncCatalogFromPackages } from "./lib/catalog.mjs";
import { exists } from "./lib/io.mjs";
import { folderFromEntryPath, scanInstalledPackages } from "./lib/packages.mjs";
import { ROOT } from "./lib/paths.mjs";

const doSync = process.argv.includes("--sync");

/**
 * 校验单条 manifest。
 * v2 → 跑 v2 校验（与历史保持一致）；v3 → 跑 v3 校验（含 semantic 形状）。
 * 历史行为：v2 必备字段严格；v3 把 semantic 视为可选补强块。
 * @param {*} manifest
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
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

/**
 * @description v2 必备字段校验（与 sapi-manifest.v2.schema.json 的 required 对齐）。
 * @param {*} r
 * @return {*}
 */
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

/**
 * @description v3 校验：直接断言 schemaVersion=3 + 沿用 v2 必需字段 + semantic 形状校验（缺失合法）。
 * @param {*} r
 * @return {*}
 */
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
 * @description
 * @param {string} msg
 */
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
      fail(`catalog 为空但 packages/ 有 ${pkgs.length} 个已装包 — 运行 node tools/catalog-sync.mjs`);
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

    const folder = folderFromEntryPath(m.entry.path);
    if (!folder) {
      fail(`${m.id}: 无法从 entry.path 解析 packages 目录: ${m.entry.path}`);
      return;
    }
    const manifestPath = path.join(ROOT, "modules", "packages", folder, "sapi", "manifest.json");
    if (!exists(manifestPath)) fail(`${m.id}: 缺少 packages/${folder}/sapi/manifest.json`);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      fail(`${m.id}: manifest 解析失败: ${message}`);
    }
    /* v2/v3 双轨：v2 仍按旧契约校验；v3 走新契约。 */
    const v = validateManifest(manifest);
    if (!v.ok) {
      fail(`${m.id}: manifest 校验未通过 — ${v.errors.join("; ")}`);
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
  fail(String(e));
}
