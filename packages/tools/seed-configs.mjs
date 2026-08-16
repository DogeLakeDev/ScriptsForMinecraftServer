#!/usr/bin/env node
// @ts-check
/** @deprecated 请用 verify.mjs（内部会播种 configs） */
import process from "node:process";
import { seedCoreConfigs } from "./lib/verify/seed-configs.mjs";

const result = seedCoreConfigs();
if (!result.ok) {
  console.error(`[seed-configs] FAIL: ${result.error}`);
  process.exit(1);
}
console.log("[seed-configs] ok — 核心 configs 已就绪");
