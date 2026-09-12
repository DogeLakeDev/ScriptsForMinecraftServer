/**
 * ui-studio/index.ts — UI Studio 子路径公共出口。
 *
 * 供 CLI（sfmc ui studio）启动本地编辑服务；
 * 求值器同时被浏览器端预览复用，保持与 Runtime 同一份语义。
 */
export { startUiStudioServer } from "./server.js";
export type {
  UiStudioServerHandle,
  UiStudioServerOptions,
} from "./server.js";
export {
  discoverUiRoot,
  isInside,
  loadUiStudioProject,
  UiStudioProjectError,
} from "./project.js";
export type { UiStudioProjectSnapshot } from "./project.js";
export { saveUiProjectFile, UiStudioSaveError } from "./save.js";
export type { SaveUiProjectFileOptions } from "./save.js";
export {
  evaluateCondition,
  evaluateExpression,
  readPath,
  resolveTemplate,
  resolveTemplateJson,
  resolveTemplateText,
  toDisplayText,
} from "./shared/evaluate.js";
export type { UiEvaluateScope } from "./shared/evaluate.js";
