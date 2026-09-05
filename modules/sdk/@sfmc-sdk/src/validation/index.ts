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
