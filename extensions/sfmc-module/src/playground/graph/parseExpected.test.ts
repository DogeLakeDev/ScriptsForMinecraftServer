/**
 * assert.ts 的 parseExpected 单元测试。
 * 与 expr.ts 的字面量 / 表达式解析路径保持独立。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseExpected, evaluateAssert } from "./assert.ts";

test("parseExpected 表达式路径原样串返", () => {
  assert.deepEqual(parseExpected("$p1.name", { type: "string" }), { ok: true, value: "$p1.name" });
  assert.deepEqual(parseExpected("@out.x", { type: "number" }), { ok: true, value: "@out.x" });
  assert.deepEqual(parseExpected("@lastEmit.path", { type: "string" }), { ok: true, value: "@lastEmit.path" });
});

test("parseExpected string 原样保留", () => {
  assert.deepEqual(parseExpected("hello", { type: "string" }), { ok: true, value: "hello" });
  assert.deepEqual(parseExpected("123", { type: "string" }), { ok: true, value: "123" });
  assert.deepEqual(parseExpected("", { type: "string" }), { ok: true, value: "" });
});

test("parseExpected vector3 JSON / 逗号两种写法", () => {
  const m = { type: "vector3" as const };
  assert.deepEqual(parseExpected("[1,2,3]", m), { ok: true, value: { x: 1, y: 2, z: 3 } });
  assert.deepEqual(parseExpected("4,5,6", m), { ok: true, value: { x: 4, y: 5, z: 6 } });
  assert.equal(parseExpected("not a vec", m).ok, false);
  assert.equal(parseExpected("", m).ok, false);
});

test("parseExpected boolean true/false/1/0", () => {
  const m = { type: "boolean" as const };
  assert.deepEqual(parseExpected("true", m), { ok: true, value: true });
  assert.deepEqual(parseExpected("false", m), { ok: true, value: false });
  assert.deepEqual(parseExpected("1", m), { ok: true, value: true });
  assert.deepEqual(parseExpected("0", m), { ok: true, value: false });
  assert.equal(parseExpected("yes", m).ok, false);
});

test("parseExpected number 拒绝空串与 NaN", () => {
  const m = { type: "number" as const };
  assert.deepEqual(parseExpected("3.14", m), { ok: true, value: 3.14 });
  assert.deepEqual(parseExpected("0", m), { ok: true, value: 0 });
  assert.equal(parseExpected("", m).ok, false);
  assert.equal(parseExpected("abc", m).ok, false);
});

test("parseExpected enum 候选值校验", () => {
  const m = { type: "enum" as const, enumValues: ["Survival", "Creative"] };
  assert.deepEqual(parseExpected("Survival", m), { ok: true, value: "Survival" });
  assert.equal(parseExpected("God", m).ok, false);
  assert.equal(parseExpected("", m).ok, false);
  // 没传 enumValues 时按自由字符串
  const open = { type: "enum" as const };
  assert.deepEqual(parseExpected("anything", open), { ok: true, value: "anything" });
});

test("evaluateAssert prop vector3 字面量按类型相等", () => {
  const target = { id: "p1", kind: "Player", props: { location: { x: 1, y: 2, z: 3 } } };
  // 无 meta：走旧 valueAsString 路径——actual={"x":1,"y":2,"z":3} 与 expected="[1,2,3]" 不等
  const oldCmp = evaluateAssert(
    { assertKind: "prop", targetId: "p1", propName: "location", expected: "[1,2,3]", matchMode: "equals" },
    { logs: [], scene: {}, target }
  );
  // 新路径不传 meta 时与旧行为一致
  assert.equal(oldCmp.ok, false);
});

test("evaluateAssert prop 旧行为兼容（expected=字符串字面量）", () => {
  const target = { id: "p1", kind: "Player", props: { name: "bob" } };
  const r = evaluateAssert(
    { assertKind: "prop", targetId: "p1", propName: "name", expected: "bob", matchMode: "equals" },
    { logs: [], scene: {}, target }
  );
  assert.equal(r.ok, true);
});
