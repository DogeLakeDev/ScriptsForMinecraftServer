/**
 * recovery.js — shim, 委托给 dist/recovery.js
 *
 * 用法: node recovery.js
 *
 * 注意：bds-tools 为 ESM（"type":"module"），不能再用 createRequire 加载 dist。
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distUrl = pathToFileURL(path.join(__dirname, "dist", "recovery.js")).href;

try {
  await import(distUrl);
} catch (e) {
  const err = /** @type {NodeJS.ErrnoException} */ (e);
  if (err && (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "MODULE_NOT_FOUND")) {
    console.error("[BDSRecovery] dist/ 未找到，请先运行 `npm run build`");
    process.exit(2);
  }
  throw e;
}
