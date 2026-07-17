/**
 * check-update.js — shim, 委托给 src/check-update.ts 编译产物
 *
 * 用法:
 *   node check-update.js
 *   node check-update.js --channel=preview
 *   node check-update.js --check-only
 *   node check-update.js --force
 */

const path = require("node:path");
const dist = path.join(__dirname, "dist", "check-update.js");

try {
  require(dist);
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    console.error("[BDSUpdater] dist/ 未找到，请先运行 `npm run build`");
    process.exit(2);
  }
  throw e;
}
