#!/usr/bin/env node
/**
 * 按 NPM_PUBLISH_PACKAGES 构建全部可发包（changeset-release / 本地发版共用）。
 * 勿在 workflow YAML 里再抄一份 workspace 列表（DRY/OCP）。
 */
import { spawnSync } from "node:child_process";
import { listPublishableBuildOrder } from "./lib/npm-publish-packages.mjs";
import { ROOT } from "./lib/changeset-release.mjs";

const order = listPublishableBuildOrder();
for (const name of order) {
  console.log(`[build-publishable] npm run build --workspace ${name} --if-present`);
  const r = spawnSync("npm", ["run", "build", "--workspace", name, "--if-present"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

console.log(`[build-publishable] ok — ${order.length} workspaces`);
