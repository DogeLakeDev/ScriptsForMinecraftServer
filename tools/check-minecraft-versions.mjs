#!/usr/bin/env node
/**
 * tools/check-minecraft-versions.mjs — 校验 @minecraft/* 版本与主仓权威 pin 一致
 *
 * 权威来源：根 package.json devDependencies + overrides（见 tools/lib/minecraft-versions.mjs）
 *
 * 用法:
 *   node tools/check-minecraft-versions.mjs
 *   node tools/check-minecraft-versions.mjs --modules-root ../sfmc-modules
 *   SFMC_MODULES_ROOT=/path/to/sfmc-modules node tools/check-minecraft-versions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/paths.mjs";
import {
  findPackageJsonFiles,
  readCanonicalFromRootPkg,
  readMinecraftDeps,
  validateCanonicalPins,
  validateOverrides,
  validatePackageMinecraftDeps,
} from "./lib/minecraft-versions.mjs";

/** @param {string} msg */
function fail(msg) {
  console.error(`[check-minecraft] FAIL: ${msg}`);
  process.exit(1);
}

function resolveModulesRoot() {
  const argIdx = process.argv.indexOf("--modules-root");
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return path.resolve(process.argv[argIdx + 1]);
  }
  if (process.env.SFMC_MODULES_ROOT) {
    return path.resolve(process.env.SFMC_MODULES_ROOT);
  }
  const sibling = path.resolve(ROOT, "..", "sfmc-modules");
  if (fs.existsSync(path.join(sibling, "package.json"))) return sibling;
  return null;
}

function main() {
  const rootPkgPath = path.join(ROOT, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  const canonical = readCanonicalFromRootPkg(ROOT);

  if (Object.keys(canonical).length === 0) {
    fail("根 package.json 未声明 @minecraft/* devDependencies");
  }

  /** @type {string[]} */
  const errors = [];
  errors.push(...validateCanonicalPins(rootPkg.devDependencies));
  errors.push(...validateOverrides(rootPkg.overrides ?? {}, canonical));

  /** @type {string[]} */
  const scanRoots = [ROOT];
  const modulesRoot = resolveModulesRoot();
  if (modulesRoot) scanRoots.push(modulesRoot);

  /** @type {string[]} */
  const pkgFiles = [];
  for (const scanRoot of scanRoots) {
    pkgFiles.push(...findPackageJsonFiles(scanRoot));
  }

  for (const pkgPath of pkgFiles.sort()) {
    const { name, deps } = readMinecraftDeps(pkgPath);
    if (Object.keys(deps).length === 0) continue;
    errors.push(
      ...validatePackageMinecraftDeps({
        canonical,
        pkgPath: path.relative(ROOT, pkgPath) || pkgPath,
        pkgName: name,
        deps,
      })
    );
  }

  console.log("[check-minecraft] 权威版本:");
  for (const [name, ver] of Object.entries(canonical).sort()) {
    console.log(`  ${name}: ${ver}`);
  }
  if (modulesRoot) {
    console.log(`[check-minecraft] 已扫描 sfmc-modules: ${modulesRoot}`);
  }

  if (errors.length > 0) {
    console.error(`[check-minecraft] ${errors.length} 个问题:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`[check-minecraft] OK (${pkgFiles.length} package.json scanned)`);
}

main();
