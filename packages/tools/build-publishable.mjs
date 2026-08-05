#!/usr/bin/env node
// @ts-check
/**
 * 按 NPM_PUBLISH_PACKAGES 构建可发包。
 * - 无参数：全量拓扑 build（changeset-release / 本地发版）
 * - --workspace <pkg>：先 build 可发包依赖闭包，再 build 目标（npm-publish 应急补发）
 * 勿在 workflow YAML 里再抄 workspace / 依赖列表（DRY/OCP）。
 */
import {
  listPublishableBuildDeps,
  listPublishableBuildOrder,
  resolvePublishPackage,
} from "./lib/npm-publish-packages.mjs";
import { ROOT } from "./changeset-release-lib.mjs";
import { spawnNpmSync } from "./lib/proc.mjs";

/**
 * @param {string} name
 */
function buildOne(name) {
  console.log(`[build-publishable] npm run build --workspace ${name} --if-present`);
  const r = spawnNpmSync(["run", "build", "--workspace", name, "--if-present"], {
    cwd: ROOT,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

const args = process.argv.slice(2);
const wsIdx = args.indexOf("--workspace");
if (wsIdx >= 0) {
  const pkg = args[wsIdx + 1];
  if (!pkg) {
    console.error("usage: node tools/build-publishable.mjs [--workspace <pkg>]");
    process.exit(2);
  }
  const resolved = resolvePublishPackage(pkg);
  if (!resolved) {
    console.error(`Unknown publish package: ${pkg}`);
    process.exit(2);
  }
  const deps = listPublishableBuildDeps(resolved);
  for (const d of deps) buildOne(d);
  buildOne(resolved);
  console.log(`[build-publishable] ok — ${resolved} (+${deps.length} deps)`);
} else {
  const order = listPublishableBuildOrder();
  for (const name of order) buildOne(name);
  console.log(`[build-publishable] ok — ${order.length} workspaces`);
}
