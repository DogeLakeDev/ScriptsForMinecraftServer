#!/usr/bin/env node
// @ts-check
/**
 * 本地发布前 pack 冒烟 — 包清单唯一来源 NPM_PUBLISH_PACKAGES（DRY）。
 * 用法: node packages/tools/pack-verify.mjs  或  pnpm exec node packages/tools/pack-verify.mjs
 */
import {
  NPM_PUBLISH_PACKAGES,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";
import { ROOT } from "./lib/paths.mjs";
import { spawnPnpmSync } from "./lib/proc.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** @param {string[]} args */
function runPnpm(args, cwd = ROOT) {
  const r = spawnPnpmSync(args, { cwd });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

runPnpm(["run", "build"]);

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pack-verify-"));
try {
  for (const [name, rel] of Object.entries(NPM_PUBLISH_PACKAGES)) {
    assertPublishPackageInWorkspaces(name, ROOT);
    console.log(`\n[pack:verify] pnpm pack ${name}`);
    runPnpm(["pack", "--pack-destination", packDir], path.dirname(path.join(ROOT, rel)));
  }
} finally {
  fs.rmSync(packDir, { recursive: true, force: true });
}

console.log(`\n[pack:verify] ok — ${Object.keys(NPM_PUBLISH_PACKAGES).length} packages`);
