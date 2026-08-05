#!/usr/bin/env node
// @ts-check
/**
 * syncpack fix 需两轮：
 * 1) DiffersToLocal → 先写成精确本地 version
 * 2) SemverRangeMismatch → 再套上 ^（本仓要发布到 npm，不能 pin 死）
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT as root } from "./lib/paths.mjs";

const syncpackCli = path.join(root, "node_modules", "syncpack", "index.cjs");

/**
 * @param {number} round
 */
function runFix(round) {
  console.log(`[syncpack] fix pass ${round}/2`);
  const r = spawnSync(process.execPath, [syncpackCli, "fix"], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status === null ? 1 : r.status);
}

runFix(1);
runFix(2);
console.log("[syncpack] fix done");
