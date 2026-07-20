/**
 * manifest.ts — SAPI module manifest reader (Stage I)
 *
 * Reads `modules/_manifests/module-manifests.json` at db-server startup.
 * Validates schema version and warns on unknown modules / unresolvable handlers.
 *
 * Future evolution: this reader will also drive handler-registry wiring. For now,
 * routes are already wired by the explicit routes/ files; the manifest provides
 * observability and an early-warning system if a SAPI module's manifest references
 * a route the db-server doesn't serve.
 */

import { readFileSync } from "node:fs";
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
  name: string;
  type: string;
  configKey: string;
  requires: string[];
  handlers: string[];
  routes: ModuleManifestRoute[];
  migrations: ModuleManifestMigration[];
}

export interface ModuleManifest {
  schemaVersion: number;
  generatedAt: string;
  modules: Record<string, ModuleManifestEntry>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPORTED_SCHEMA = 1;

export type ManifestPathResolver = () => string;

export function defaultManifestPath(): string {
  return (
    process.env.SFMC_MODULE_MANIFEST_PATH ||
    resolve(__dirname, "..", "..", "modules", "_manifests", "module-manifests.json")
  );
}

export function loadManifest(resolvePath: ManifestPathResolver = defaultManifestPath): ModuleManifest {
  const path = resolvePath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`[manifest] cannot read ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[manifest] ${path} is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`[manifest] ${path} root is not an object`);
  }
  const obj = parsed as Partial<ModuleManifest>;
  if (typeof obj.schemaVersion !== "number") {
    throw new Error(`[manifest] ${path} missing numeric schemaVersion`);
  }
  if (obj.schemaVersion > SUPPORTED_SCHEMA) {
    console.warn(
      `[manifest] ${path} schemaVersion=${obj.schemaVersion} is newer than db-server supports (${SUPPORTED_SCHEMA}); continuing with best-effort parsing`
    );
  }
  if (obj.schemaVersion < SUPPORTED_SCHEMA) {
    throw new Error(
      `[manifest] ${path} schemaVersion=${obj.schemaVersion} < supported ${SUPPORTED_SCHEMA}; refusing to boot`
    );
  }
  if (typeof obj.modules !== "object" || obj.modules === null) {
    throw new Error(`[manifest] ${path} missing modules object`);
  }
  return obj as ModuleManifest;
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
    handlerCount += entry.handlers.length;
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
      // path may contain :param placeholders that match any segment
      const prefix = route.path.split("/").slice(0, 4).join("/");
      const matched = knownRoutePrefixes.some((p) => prefix.startsWith(p.split("/").slice(0, 4).join("/")));
      if (!matched) {
        warnings.push(`${moduleId}: route ${route.method} ${route.path} is not covered by db-server`);
      }
    }
    // handlers array is forward-looking (Stage I has zero handlers per module);
    // entries will be cross-checked against HANDLERS table in a future stage.
  }
  return warnings;
}