/**
 * assertFields.ts 单元测试：按 kind 取舍的字段表稳定。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSERT_FIELDS_BY_KIND,
  ASSERT_KIND_HINT,
  assertFieldsToMetaProps,
} from "./assertFields.ts";

const KINDS = ["log", "logNot", "sceneExists", "prop", "count", "lastEmit", "lastCall"] as const;

test("ASSERT_FIELDS_BY_KIND 覆盖所有 AssertKind", () => {
  for (const k of KINDS) {
    assert.ok(ASSERT_FIELDS_BY_KIND[k], `missing kind: ${k}`);
    assert.ok(ASSERT_FIELDS_BY_KIND[k].length > 0, `empty fields for: ${k}`);
  }
});

test("log / logNot 共用同一组字段", () => {
  assert.deepEqual(ASSERT_FIELDS_BY_KIND.log, ASSERT_FIELDS_BY_KIND.logNot);
});

test("lastEmit / lastCall 共用同一组字段", () => {
  assert.deepEqual(ASSERT_FIELDS_BY_KIND.lastEmit, ASSERT_FIELDS_BY_KIND.lastCall);
});

test("log 字段不含 propName / countOp / countN", () => {
  const names = ASSERT_FIELDS_BY_KIND.log.map((f) => f.name);
  for (const n of ["propName", "countOp", "countN", "expected"]) {
    assert.equal(names.includes(n), false, `log 不应含 ${n}`);
  }
});

test("count 字段不含 pattern / expected / propName", () => {
  const names = ASSERT_FIELDS_BY_KIND.count.map((f) => f.name);
  for (const n of ["pattern", "expected", "propName", "ignoreCase"]) {
    assert.equal(names.includes(n), false, `count 不应含 ${n}`);
  }
});

test("prop 字段含 expected / propName / matchMode", () => {
  const names = ASSERT_FIELDS_BY_KIND.prop.map((f) => f.name);
  for (const n of ["expected", "propName", "matchMode", "targetId", "targetKind"]) {
    assert.equal(names.includes(n), true, `prop 应含 ${n}`);
  }
});

test("ASSERT_KIND_HINT 每个 kind 都有中文 hint", () => {
  for (const k of KINDS) {
    assert.ok(ASSERT_KIND_HINT[k] && ASSERT_KIND_HINT[k].length > 0, `missing hint: ${k}`);
  }
});

test("assertFieldsToMetaProps 转 MetaProp 形态", () => {
  const meta = assertFieldsToMetaProps(ASSERT_FIELDS_BY_KIND.count);
  for (const m of meta) {
    assert.equal(typeof m.name, "string");
    assert.equal(m.readonly, false);
  }
  assert.equal(meta.length, ASSERT_FIELDS_BY_KIND.count.length);
});
