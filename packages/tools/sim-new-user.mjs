#!/usr/bin/env node
// @ts-check
/** @deprecated 请用 verify.mjs --skip-isolated 以外的隔离段，或 verify 全量 */
import process from "node:process";
import { runIsolatedRootSimulation } from "./lib/verify/isolated-root.mjs";

const keep = process.argv.includes("--keep");
const noRestore = process.argv.includes("--no-restore");

console.warn("[deprecated] sim-new-user.mjs → 请用: npm run verify");

try {
  const { simDir } = await runIsolatedRootSimulation({ keep, noRestore });
  if (simDir) console.log(`[sim-new-user] 工作根保留: ${simDir}`);
  else console.log("[sim-new-user] 全部模拟通过");
} catch (e) {
  console.error(e);
  process.exit(1);
}
