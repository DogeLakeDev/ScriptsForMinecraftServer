/**
 * recovery.js — shim, 委托给 src/recovery.ts 编译产物
 *
 * 用法: node recovery.js
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dist = path.join(__dirname, "dist", "recovery.js");

try {
  require(dist);
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    console.error("[BDSRecovery] dist/ 未找到，请先运行 `npm run build`");
    process.exit(2);
  }
  throw e;
}