/**
 * @sfmc-bds/devkit — 模块作者工具核心（扩展 / CI 共用，不依赖 sfmc CLI）
 */

export { resolveLocalModuleRoot } from "./paths.js";
export {
  isValidModuleRoot,
  readModuleRootInfo,
  findModuleRootFromFile,
  type ModuleRootInfo,
} from "./module-root.js";
export { startModuleWatch, type ModuleWatchOptions } from "./watch.js";
export { scaffoldModule, type ScaffoldOptions } from "./scaffold.js";
export { rebuildAndDeploy, type RebuildOptions, type RebuildResult } from "./rebuild.js";
