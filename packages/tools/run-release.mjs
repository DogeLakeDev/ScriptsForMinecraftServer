#!/usr/bin/env node
// @ts-check
/**
 * tools/run-release.mjs — 一键发版编排（替代根 package.json 里一长串 run-s）
 *
 *   node packages/tools/run-release.mjs --ci      # CI：publish → tag → push → gh（版本已 bump）
 *   node packages/tools/run-release.mjs --pre     # 应急本地 beta（日常请走 CI Version PR）
 *   node packages/tools/run-release.mjs --stable  # 应急本地正式
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT, TOOLS_PKG_DIR } from "./lib/paths.mjs";
import { spawnNpmSync } from "./lib/proc.mjs";

const TOOLS = TOOLS_PKG_DIR;

const mode = process.argv.includes("--ci")
  ? "ci"
  : process.argv.includes("--stable")
    ? "stable"
    : process.argv.includes("--pre")
      ? "pre"
      : null;

if (!mode) {
  console.error(`用法:
  node packages/tools/run-release.mjs --ci      # CI / npm run ci-release-packages
  node packages/tools/run-release.mjs --pre     # 应急本地 beta（日常请走 CI）
  node packages/tools/run-release.mjs --stable  # 应急本地正式`);
  process.exit(2);
}

/**
 * @param {string} rel packages/tools/ 下脚本相对路径
 * @param {string[]} [args]
 */
function runNode(rel, args = []) {
  const script = path.join(TOOLS, rel);
  console.log(`\n[run-release] node packages/tools/${rel}${args.length ? ` ${args.join(" ")}` : ""}`);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** @param {string[]} args npm 参数（不含 npm 自身） */
function runNpm(args) {
  console.log(`\n[run-release] npm ${args.join(" ")}`);
  const r = spawnNpmSync(args, { cwd: ROOT, env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (mode === "ci") {
  // 与旧 ci-release-packages 顺序一致：publish → tag → push → gh
  runNode("changeset-publish.mjs");
  runNode("changeset-tag.mjs");
  runNode("changeset-push.mjs");
  runNode("changeset-github-release.mjs");
  console.log("\n[run-release] ci 完成");
  process.exit(0);
}

if (mode === "pre") {
  runNode("changeset-assert-mode.mjs", ["--pre"]);
} else {
  runNode("changeset-assert-mode.mjs", ["--stable"]);
}

runNode("changeset-ensure.mjs");
runNpm(["run", "version-packages"]);
runNode("changeset-commit-version.mjs");
runNode("changeset-tag.mjs");
runNode("changeset-push.mjs");
runNode("changeset-publish.mjs");

if (mode === "pre") {
  runNode("changeset-github-release.mjs", ["--prerelease"]);
} else {
  runNode("changeset-github-release.mjs", ["--latest"]);
}

console.log(`\n[run-release] ${mode} 完成`);
