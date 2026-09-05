#!/usr/bin/env node
// @ts-check
/**
 * @sfmc-bds/cli — 离线校验 catalog 与已安装模块包的全局一致性
 *
 * 职责分工边界：
 * - 全局目录一致性：本文件专注于校验 catalog 唯一性（id / configKey）、requires 依赖闭包、以及 catalog.id 与 manifest.id 的严格对齐；
 * - 字段形状校验解耦：模块 manifest 的具体字段结构、版本判定与必填规则完全委托给 SDK 的权威总入口 `validateManifest`，不再在本地重复实现字段形状检查。
 *
 * 用法：
 *   node packages/cli/scripts/module-install/check-modules.mjs
 *   node …/check-modules.mjs --sync   # 先 sync catalog 再执行校验
 */
import { validateManifest } from "@sfmc-bds/sdk/module-loader";
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

      // 单个 manifest 字段形状校验：委托 SDK validateManifest 权威入口，本脚本不重复实现字段检查
      const v = validateManifest(manifest);
      if (!v.ok) {
        return { ok: false, error: `${m.id}: manifest 校验未通过 — ${v.errors.join("; ")}` };
      }
      // 校验 catalog 条目与 manifest 实际声明的模块身份（id）严格一致
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
