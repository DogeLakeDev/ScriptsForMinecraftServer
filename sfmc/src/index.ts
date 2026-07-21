/**
 * sfmc/ public runtime surface (Stage J — minimum entry design)
 *
 * This is the clean API that downstream callers (future sfmc-cil commands,
 * external scripts, CI tooling) consume to manage the runtime stack
 * without re-implementing process lifecycle logic.
 *
 * Design:
 * - Single process tree. sfmc/ does not spawn itself recursively — it spawns
 *   the actual services (db-server, qq-bridge, bds-tools, BDS).
 * - `IS_SEA` / `ROOT` from runtime.ts describe the deployment shape so callers
 *   can adapt (path lookup, config dir).
 * - Service lifecycle goes through ServiceRegistry (start/stop/restart/status).
 * - Module manifest from db-server is exposed via `readModuleManifest()` so
 *   callers can show enabled modules + per-module state.
 *
 * Re-exports are deliberately thin: each item is a stable contract. Internal
 * helpers (LogLine buffers, child-process piping) are NOT re-exported.
 */

export { ROOT, IS_SEA, spawnService, spawnServiceSync, type ServiceId } from "./runtime.js";

export {
  SERVICE_NAMES,
  type ServiceName,
  type ServiceStatus,
  refreshServices,
  startAll,
  stopAll,
  forceStopAll,
  serviceStatus,
  services,
  START_ORDER,
} from "./services.js";

export { pushLog, onLog, getAllLogs, getRecentLogs, type UnifiedLog, type LogLevel, type LogSource } from "./logs.js";

/**
 * Reads the manifest emitted by the behavior pack build, if present.
 * Returns null when no manifest exists (e.g. behavior pack hasn't been built).
 */
export async function readModuleManifest(): Promise<unknown> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { ROOT } = await import("./runtime.js");
  const manifestPath = path.join(ROOT, "modules", "_manifests", "module-manifests.json");
  try {
    const text = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export { startRepl, HELP } from "./repl.js";
export { runWizard } from "./wizard.js";