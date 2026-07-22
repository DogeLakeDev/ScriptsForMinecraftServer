/**
 * tools/lib/io.mjs — JSON 读写与 die 辅助
 */
import fs from "node:fs";
import path from "node:path";

/** @param {string} file @param {unknown} fallback */
export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** @param {string} file @param {unknown} data */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** @param {string} tag @param {string} msg @param {number} [code] */
export function die(tag, msg, code = 1) {
  console.error(`[${tag}] ${msg}`);
  process.exit(code);
}

/** @param {string} p */
export function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
