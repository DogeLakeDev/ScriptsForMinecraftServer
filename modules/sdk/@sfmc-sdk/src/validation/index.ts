/**
 * validation/index.ts — 平台结构校验诊断
 */
export {
  Expected,
  failShapeValidation,
  formatShapeIssue,
  issueConstMismatch,
  issueInvalidItem,
  issueInvalidType,
  issueRootNotObject,
} from "./issues.js";
export type { ExpectedLabel, FormatShapeIssueOptions, ShapeIssue, ShapeIssueKind } from "./issues.js";
export { compileUiProject, validateUiFeature, validateUiScreen } from "./ui-document.js";
export type {
  UiProjectInput,
  UiValidationIssue,
  UiValidationIssueCode,
  UiValidationResult,
} from "./ui-document.js";
