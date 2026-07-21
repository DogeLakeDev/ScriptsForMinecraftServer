/**
 * sync-index.js — 把 packages/* 加入 index.json (catalog mirror)
 *
 * 用法:node tools/sync-index.js            # 全量同步
 *       node tools/sync-index.js <id>       # 增量添加一个模块
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const packagesDir = resolve(root, "packages");
const indexPath = resolve(root, "index.json");

const arg = process.argv[2];

const index = existsSync(indexPath)
  ? JSON.parse(readFileSync(indexPath, "utf8"))
  : { version: 1, modules: [] };

const seen = new Set(index.modules.map((m) => m.id));

function loadOne(id) {
  const manifestPath = resolve(packagesDir, id, "sapi", "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    configKey: m.configKey,
    requires: m.requires ?? [],
    permissions: m.permissions ?? [],
    services: m.services ?? { provides: [], requires: [] },
    notes: m.notes ?? "",
  };
}

if (arg) {
  if (!seen.has(arg)) {
    const entry = loadOne(arg);
    if (entry) {
      index.modules.push(entry);
      seen.add(arg);
    }
  }
} else {
  const ids = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  index.modules = ids.map((id) => loadOne(id)).filter(Boolean);
}

writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
console.log(`✓ index.json synced: ${index.modules.length} modules`);