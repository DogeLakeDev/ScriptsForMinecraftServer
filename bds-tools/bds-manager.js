/**
 * bds-manager.js — shim, 委托给 src/bds-manager.ts 编译产物
 *
 * 用法:
 *   node bds-manager.js start | stop | restart | status | send <cmd> | watch
 */

const path = require("node:path");
const dist = path.join(__dirname, "dist", "bds-manager.js");

try {
  require(dist);
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    console.error("[BDSManager] dist/ 未找到，请先运行 `npm run build`");
    process.exit(2);
  }
  throw e;
}
