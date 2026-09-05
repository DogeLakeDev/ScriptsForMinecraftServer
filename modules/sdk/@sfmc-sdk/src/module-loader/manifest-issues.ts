/**
 * manifest-issues.ts — manifest 域对平台 validation 内核的薄适配
 *
 * 工厂 `@sfmc-bds/sdk/validation`；rootLabel=`manifest`
 * 并保留既有 Manifest* 导出名，避免破坏 module-loader 调用方。
 */

import {
  Expected,
  failShapeValidation,
  formatShapeIssue,
  issueConstMismatch,
  issueInvalidItem,
  issueInvalidType,
  issueRootNotObject,
  type ExpectedLabel,
} from "../validation/issues.js";
import type { ManifestIssue } from "./manifest-schema.js";

/** @deprecated 请优先使用 `@sfmc-bds/sdk/validation` 的 `Expected`；保留别名兼容既有 import。 */
export const ManifestExpected = Expected;

/** @deprecated 请优先使用 `ExpectedLabel`。 */
export type ManifestExpectedLabel = ExpectedLabel;

const MANIFEST_FORMAT = { rootLabel: "manifest" } as const;

export { issueConstMismatch, issueInvalidItem, issueInvalidType, issueRootNotObject };

/** 将 manifest 问题格式化为规范中文。 */
export function formatManifestIssue(issue: ManifestIssue): string {
  return formatShapeIssue(issue, MANIFEST_FORMAT);
}

/** 构造 manifest 校验失败结果（errors 由统一句式派生）。 */
export function failValidation(issues: ManifestIssue[]): {
  ok: false;
  errors: string[];
  issues: ManifestIssue[];
} {
  return failShapeValidation(issues, MANIFEST_FORMAT);
}
