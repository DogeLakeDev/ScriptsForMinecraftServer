#!/usr/bin/env node
// @ts-check
/**
 * 本地发布前 pack 冒烟 — 包清单唯一来源 NPM_PUBLISH_PACKAGES（DRY）。
 * 用法: npm run pack:verify  或  node packages/tools/pack-verify.mjs
 */
import {
  NPM_PUBLISH_PACKAGES,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";
import { ROOT } from "./lib/paths.mjs";
import { spawnNpmSync } from "./lib/proc.mjs";

/** @param {string[]} args */
function runNpm(args) {
  const r = spawnNpmSync(args, { cwd: ROOT });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

runNpm(["run", "build", "--workspaces", "--if-present"]);

for (const name of Object.keys(NPM_PUBLISH_PACKAGES)) {
  assertPublishPackageInWorkspaces(name, ROOT);
  console.log(`\n[pack:verify] npm pack -w ${name}`);
  runNpm(["pack", "-w", name]);
}

console.log(`\n[pack:verify] ok — ${Object.keys(NPM_PUBLISH_PACKAGES).length} packages`);
