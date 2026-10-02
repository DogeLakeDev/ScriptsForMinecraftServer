/**
 * @sfmc-bds/devkit — 模块作者工具核心（扩展 / CI 共用）
 * Watch / rebuild / 启停；建仓请用 pnpm dlx @sfmc-bds/create-module。
 */

export { findModuleRootFromFile, isValidModuleRoot, readModuleRootInfo, type ModuleRootInfo } from "./module-root.js";
export { setModuleEnabled, type SetModuleEnabledOptions, type SetModuleEnabledResult } from "./module-toggle.js";
export { resolveLocalModuleRoot } from "./paths.js";
export { rebuildAndDeploy, type RebuildOptions, type RebuildResult } from "./rebuild.js";
export { runRegistrySubmitCommand } from "./registry-command.js";
export {
  MODULE_REGISTRY_REPO,
  createRegistryEntry,
  submitModuleToRegistry,
  type RegistryMetadata,
  type RegistryModule,
  type RegistrySubmitOptions,
  type RegistrySubmitResult,
} from "./registry-submit.js";
export {
  resolveSfmcCli,
  runSfmcCli,
  type ResolveSfmcCliOptions,
  type RunSfmcCliOptions,
  type RunSfmcCliResult,
} from "./sfmc-cli.js";
export { isValidSfmcRoot } from "./sfmc-root.js";
export { startModuleWatch, type ModuleWatchOptions } from "./watch.js";
