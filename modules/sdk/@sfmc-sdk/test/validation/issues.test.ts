/**
 * 平台 validation 内核句式单测（manifest 适配见 manifest-schema.test.ts）。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  Expected,
  formatShapeIssue,
  issueConstMismatch,
  issueInvalidItem,
  issueInvalidType,
  issueRootNotObject,
} from "../../dist/esm/validation/index.js";

test("formatShapeIssue: rootLabel 可换域名", () => {
  assert.equal(
    formatShapeIssue(issueRootNotObject(), { rootLabel: "catalog" }),
    "catalog 根必须是普通对象"
  );
  assert.equal(
    formatShapeIssue(issueRootNotObject(), { rootLabel: "manifest" }),
    "manifest 根必须是普通对象"
  );
});

test("formatShapeIssue: 四种 kind 句式", () => {
  assert.equal(
    formatShapeIssue(issueConstMismatch("version", "1", "2"), { rootLabel: "x" }),
    "version 必须为 1，实际为 2"
  );
  assert.equal(
    formatShapeIssue(issueInvalidType("id", Expected.nonEmptyString), { rootLabel: "x" }),
    "id 必须是非空字符串"
  );
  assert.equal(
    formatShapeIssue(issueInvalidItem("requires", Expected.nonEmptyString), { rootLabel: "x" }),
    "requires 的元素必须是非空字符串"
  );
});
