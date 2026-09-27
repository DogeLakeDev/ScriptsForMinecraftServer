/**
 * @sfmc-bds/devkit — 模块作者工具核心（扩展 / CI 共用）
 * Watch / rebuild / 启停；建仓请用 pnpm dlx @sfmc-bds/create-module。
 */

export { resolveLocalModuleRoot } from "./paths.js";
export {
  isValidModuleRoot,
  readModuleRootInfo,
  findModuleRootFromFile,
  type ModuleRootInfo,
} from "./module-root.js";
export { isValidSfmcRoot } from "./sfmc-root.js";
export { resolveSfmcCli, runSfmcCli, type ResolveSfmcCliOptions, type RunSfmcCliOptions, type RunSfmcCliResult } from "./sfmc-cli.js";
export { startModuleWatch, type ModuleWatchOptions } from "./watch.js";
export { rebuildAndDeploy, type RebuildOptions, type RebuildResult } from "./rebuild.js";
export {
  setModuleEnabled,
  type SetModuleEnabledOptions,
  type SetModuleEnabledResult,
} from "./module-toggle.js";
