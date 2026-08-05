/**
 * NestedForm 工具函数单测。组件本体不在 node --test 环境直接渲染，
 * 但其内部依赖的 json 文本 ↔ 对象互转逻辑（jsonUtils）需要单独覆盖。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { jsonFieldText, jsonToText, safeParseObject } from "./jsonUtils.ts";

test("safeParseObject 容错：空串 → null", () => {
  assert.equal(safeParseObject(""), null);
  assert.equal(safeParseObject("   "), null);
});

test("safeParseObject 合法对象", () => {
  assert.deepEqual(safeParseObject('{"a":1}'), { a: 1 });
});

test("safeParseObject 非法 JSON 不抛错，返回 null", () => {
  assert.equal(safeParseObject("{bad"), null);
});

test("safeParseObject 拒绝数组与非对象", () => {
  assert.equal(safeParseObject("[]"), null);
  assert.equal(safeParseObject('"foo"'), null);
  assert.equal(safeParseObject("null"), null);
  assert.equal(safeParseObject("42"), null);
});

test("jsonToText 基本编 / 零依赖 fallback", () => {
  assert.equal(jsonToText(null), "");
  assert.equal(jsonToText(undefined), "");
  assert.equal(jsonToText({ a: 1 }), JSON.stringify({ a: 1 }, null, 2));
  // 循环引用走 String fallback（实际场景罕见，但需不抛）
  const circ: Record<string, unknown> = {};
  circ.self = circ;
  assert.equal(typeof jsonToText(circ), "string");
});

test("jsonFieldText 直接保留字符串", () => {
  assert.equal(jsonFieldText("foo"), "foo");
  assert.equal(jsonFieldText(null), "");
  assert.equal(jsonFieldText(undefined), "");
  assert.equal(jsonFieldText(42), "42");
  assert.equal(jsonFieldText({ a: 1 }), JSON.stringify({ a: 1 }, null, 2));
});
