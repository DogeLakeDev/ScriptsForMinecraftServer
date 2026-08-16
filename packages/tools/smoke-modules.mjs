#!/usr/bin/env node
// @ts-check
/** @deprecated 请用 verify.mjs（需已启动 db 时仅跑 REST 段） */
import process from "node:process";
import { assertModuleRestApi } from "./lib/verify/db-api.mjs";

const PORT = parseInt(process.env.DB_PORT || "3001", 10);

console.warn("[deprecated] smoke-modules.mjs → 请用: npm run verify");

try {
  const result = await assertModuleRestApi(PORT);
  console.log(
    `[smoke] PASS: modules=${result.moduleCount}${result.toggled ? " (已翻转启停)" : ""}`
  );
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[smoke] FAIL: ${message}`);
  process.exit(1);
}
