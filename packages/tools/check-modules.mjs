#!/usr/bin/env node
// @ts-check
/**
 * 薄封装 → @sfmc-bds/cli module-install/check-modules（权威实现）
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runCheckModules } from "../cli/scripts/module-install/check-modules.mjs";

export { runCheckModules };

const __main = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__main)) {
  const doSync = process.argv.includes("--sync");
  const result = runCheckModules({ sync: doSync });
  if (!result.ok) {
    console.error(`[check-modules] FAIL: ${result.error}`);
    process.exit(1);
  }
  console.log(`[check-modules] ${result.summary}`);
}
