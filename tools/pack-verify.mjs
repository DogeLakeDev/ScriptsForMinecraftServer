#!/usr/bin/env node
/**
 * 本地发布前 pack 冒烟 — 包清单唯一来源 NPM_PUBLISH_PACKAGES（DRY）。
 * 用法: node tools/pack-verify.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NPM_PUBLISH_PACKAGES,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npm", ["run", "build", "--workspaces", "--if-present"]);

for (const name of Object.keys(NPM_PUBLISH_PACKAGES)) {
  assertPublishPackageInWorkspaces(name, ROOT);
  console.log(`\n[pack:verify] npm pack -w ${name}`);
  run("npm", ["pack", "-w", name]);
}

console.log(`\n[pack:verify] ok — ${Object.keys(NPM_PUBLISH_PACKAGES).length} packages`);
