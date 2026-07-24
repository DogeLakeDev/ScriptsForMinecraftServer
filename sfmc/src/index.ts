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
 *
 * Re-exports are deliberately thin: each item is a stable contract. Internal
 * helpers (LogLine buffers, child-process piping) are NOT re-exported.
 */

export { ROOT, IS_SEA, isMonorepoLayout, isRuntimeInitialized, resolveServiceScript, resolveFetchModule, spawnService, spawnServiceSync, type ServiceId } from "./runtime.js";

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

export { startRepl, getHelp, HELP } from "./repl.js";
export { t, getLocale, setLocale, initLocale, type Locale } from "./i18n/index.js";
export { runWizard } from "./wizard.js";
export { cmdModuleList, cmdModuleInstall, cmdModuleUninstall, cmdModuleVerify, cmdModuleInfo } from "./module-commands.js";
