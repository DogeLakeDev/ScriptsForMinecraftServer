/**
 * sync-index.js — 把 packages/* 同步到 index.json (fetch-module 用的 keyed map)
 *
 * 用法:node tools/sync-index.js
 *       node tools/sync-index.js <folder>   # 增量:只确保该 folder 有条目
 *
 * 输出 schema(与 tools/fetch-module.mjs 对齐):
 *   { version, generatedAt, modules: { <folder>: { repo, tag } } }
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const packagesDir = resolve(root, "packages");
const indexPath = resolve(root, "index.json");

const DEFAULT_REPO = "Tanya7z/sfmc-modules";
const DEFAULT_TAG = "modules-v0.1.0";

const arg = process.argv[2];

const index = existsSync(indexPath)
  ? JSON.parse(readFileSync(indexPath, "utf8"))
  : { version: 1, modules: {} };

if (!index.modules || typeof index.modules !== "object" || Array.isArray(index.modules)) {
  index.modules = {};
}

function ensureEntry(folder) {
  const manifestPath = resolve(packagesDir, folder, "sapi", "manifest.json");
  if (!existsSync(manifestPath)) return false;
  if (!index.modules[folder]) {
    index.modules[folder] = { repo: DEFAULT_REPO, tag: DEFAULT_TAG };
  }
  return true;
}

if (arg) {
  if (!ensureEntry(arg)) {
    console.error(`no packages/${arg}/sapi/manifest.json`);
    process.exit(1);
  }
} else {
  const next = {};
  for (const e of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (ensureEntry(e.name)) {
      next[e.name] = index.modules[e.name];
    }
  }
  index.modules = next;
}

index.generatedAt = new Date().toISOString();
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
console.log(`✓ index.json synced: ${Object.keys(index.modules).length} modules`);
