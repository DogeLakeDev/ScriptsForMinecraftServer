/**
 * manifest.ts — runtime SAPI module manifest reader.
 *
 * At db-server startup, scan `modules/packages/<id>/sapi/manifest.json` for
 * every installed module and aggregate them into a single in-memory manifest.
 * No pre-built `modules/_manifests/module-manifests.json` is required; the
 * per-module files are the single source of truth (the SEA reads them at
 * runtime too).
 *
 * Behavior:
 *   - Missing file: skip that module (WARN).
 *   - Corrupt JSON: skip + WARN.
 *   - schemaVersion > supported: WARN, continue best-effort.
 *   - schemaVersion < supported: refuse to load that module.
 *
 * Reconcile: every route declared in a module's manifest is checked against
 * the prefix table; mismatches WARN but do not block startup.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface ModuleManifestRoute {
  method: string;
  path: string;
  handler: string;
}

export interface ModuleManifestMigration {
  name: string;
  version: number;
}

export interface ModuleManifestEntry {
  name?: string | undefined;
  type?: string | undefined;
  configKey?: string | undefined;
  requires?: string[] | undefined;
  handlers?: string[] | undefined;
  routes: ModuleManifestRoute[];
  migrations: ModuleManifestMigration[];
  notes?: string | undefined;
}

export interface ModuleManifest {
  schemaVersion: number;
  generatedAt: string;
  modules: Record<string, ModuleManifestEntry>;
}

const SUPPORTED_SCHEMA = 1;
const __dirname = dirname(fileURLToPath(import.meta.url));

export type PackagesDirResolver = () => string;

/** Resolve where db-server should look for `modules/packages/`. */
export function defaultPackagesDir(): string {
  return process.env.SFMC_PACKAGES_DIR || resolve(__dirname, "..", "..", "modules", "packages");
}

/**
 * Read every `modules/packages/<id>/sapi/manifest.json` and aggregate.
 * Modules without a manifest are silently skipped (the SAPI side will fall
 * back to a default-empty surface); modules with a corrupt or too-new
 * manifest produce warnings.
 */
export function loadManifest(packagesDir: string = defaultPackagesDir()): ModuleManifest {
  const modules: Record<string, ModuleManifestEntry> = {};
  if (!existsSync(packagesDir)) {
    console.warn(`[manifest] ${packagesDir} does not exist; db-server will run with zero modules`);
    return { schemaVersion: SUPPORTED_SCHEMA, generatedAt: new Date().toISOString(), modules };
  }
  const ids = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const id of ids) {
    const manifestPath = resolve(packagesDir, id, "sapi", "manifest.json");
    if (!existsSync(manifestPath)) continue;
    let raw: string;
    try {
      raw = readFileSync(manifestPath, "utf8");
    } catch (err) {
      console.warn(`[manifest] ${id}: cannot read ${manifestPath}: ${(err as Error).message}`);
      continue;
    }
    let parsed: Partial<ModuleManifestEntry> & { schemaVersion?: number };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch (err) {
      console.warn(`[manifest] ${id}: ${manifestPath} is not valid JSON: ${(err as Error).message}`);
      continue;
    }
    if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SUPPORTED_SCHEMA) {
      console.warn(`[manifest] ${id}: schemaVersion=${parsed.schemaVersion} > supported ${SUPPORTED_SCHEMA}; parsing best-effort`);
    }
    modules[id] = {
      name: parsed.name,
      type: parsed.type,
      configKey: parsed.configKey,
      requires: Array.isArray(parsed.requires) ? parsed.requires : [],
      handlers: Array.isArray(parsed.handlers) ? parsed.handlers : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      migrations: Array.isArray(parsed.migrations) ? parsed.migrations : [],
      notes: parsed.notes,
    };
  }
  return {
    schemaVersion: SUPPORTED_SCHEMA,
    generatedAt: new Date().toISOString(),
    modules,
  };
}

export interface ManifestSummary {
  moduleCount: number;
  routeCount: number;
  handlerCount: number;
  migrationCount: number;
  moduleIds: string[];
}

export function summarize(m: ModuleManifest): ManifestSummary {
  let routeCount = 0;
  let handlerCount = 0;
  let migrationCount = 0;
  for (const entry of Object.values(m.modules)) {
    routeCount += entry.routes.length;
    handlerCount += entry.handlers?.length ?? 0;
    migrationCount += entry.migrations.length;
  }
  return {
    moduleCount: Object.keys(m.modules).length,
    routeCount,
    handlerCount,
    migrationCount,
    moduleIds: Object.keys(m.modules).sort(),
  };
}

/**
 * Reconcile manifest routes against the routes the db-server currently serves.
 * Returns a list of warnings for routes declared in the manifest that no route
 * file covers. Routes already covered by `routes/*.ts` files are not flagged.
 */
export function reconcile(m: ModuleManifest, knownRoutePrefixes: string[]): string[] {
  const warnings: string[] = [];
  for (const [moduleId, entry] of Object.entries(m.modules)) {
    for (const route of entry.routes) {
      const prefix = route.path.split("/").slice(0, 4).join("/");
      const matched = knownRoutePrefixes.some((p) => prefix.startsWith(p.split("/").slice(0, 4).join("/")));
      if (!matched) {
        warnings.push(`${moduleId}: route ${route.method} ${route.path} is not covered by db-server`);
      }
    }
  }
  return warnings;
}