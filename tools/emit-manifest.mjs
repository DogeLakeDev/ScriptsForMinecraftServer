/**
 * emit-manifest.mjs — Aggregate per-module manifest.json into modules/_manifests/module-manifests.json
 *
 * Each module under modules/packages/<id>/sapi/ may optionally provide a `manifest.json` file with:
 *   {
 *     "handlers": ["<moduleId>:<name>", ...],   // exported from db-server/handlers/<id>/index.ts
 *     "routes":   [{ "method": "GET", "path": "/api/sfmc/foo", "handler": "<moduleId>:<name>" }, ...],
 *     "migrations": [{ "name": "create_foo_table", "version": 1 }, ...]
 *   }
 *
 * The emitter scans all modules listed in modules/catalog.json with entry.kind === "sapi", reads each
 * optional manifest.json, and emits a single aggregated file consumed by db-server at boot.
 *
 * Stage I uses per-module hand-written manifests for reliability (no AST parsing).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MODULES_DIR = join(ROOT, "modules", "packages");
const CATALOG_PATH = join(ROOT, "modules", "catalog.json");
const OUT_DIR = join(ROOT, "modules", "_manifests");
const OUT_PATH = join(OUT_DIR, "module-manifests.json");

const SCHEMA_VERSION = 1;

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const sapiModules = (catalog.modules || []).filter(
    (m) => m.entry && m.entry.kind === "sapi" && m.entry.path && m.entry.path.startsWith("modules/packages/")
  );

  const aggregated = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    modules: {},
  };

  for (const m of sapiModules) {
    const moduleDir = resolve(ROOT, m.entry.path, "..", "..", "..");
    const manifestPath = join(moduleDir, "sapi", "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const raw = JSON.parse(await readFile(manifestPath, "utf8"));
    aggregated.modules[m.id] = {
      name: m.name,
      type: m.type,
      configKey: m.configKey,
      requires: m.requires || [],
      handlers: raw.handlers || [],
      routes: raw.routes || [],
      migrations: raw.migrations || [],
    };
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(aggregated, null, 2) + "\n", "utf8");

  const moduleCount = Object.keys(aggregated.modules).length;
  console.log(`[emit-manifest] wrote ${OUT_PATH}`);
  console.log(`[emit-manifest] schemaVersion=${SCHEMA_VERSION} modules=${moduleCount}`);
}

main().catch((err) => {
  console.error("[emit-manifest] FAILED:", err);
  process.exit(1);
});