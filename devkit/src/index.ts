/**
 * @sfmc-bds/devkit — 模块作者工具核心（扩展 / CI 共用）
 * Watch / scaffold 自洽；rebuild / 启停会解析并 spawn 已安装的 sfmc CLI（与工作目录无关）。
 */

export { resolveLocalModuleRoot } from "./paths.js";
export {
  isValidModuleRoot,
  readModuleRootInfo,
  findModuleRootFromFile,
  type ModuleRootInfo,
} from "./module-root.js";
export { isValidSfmcRoot } from "./sfmc-root.js";
export { resolveSfmcCli, type ResolveSfmcCliOptions } from "./sfmc-cli.js";
export { startModuleWatch, type ModuleWatchOptions } from "./watch.js";
export { scaffoldModule, type ScaffoldOptions } from "./scaffold.js";
export { rebuildAndDeploy, type RebuildOptions, type RebuildResult } from "./rebuild.js";
export {
  setModuleEnabled,
  type SetModuleEnabledOptions,
  type SetModuleEnabledResult,
} from "./module-toggle.js";
