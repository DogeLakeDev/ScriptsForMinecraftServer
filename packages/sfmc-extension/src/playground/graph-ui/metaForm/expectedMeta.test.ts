/**
 * expectedMeta.ts 单元测试：类型推断 + 序列化/反序列化。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatExpected,
  inferExpectedMeta,
  parseExpectedToControl,
  type ExpectedMeta,
} from "./expectedMeta.ts";
import { PLAYGROUND_META } from "../../../../../../modules/sdk/@sfmc-sdk/src/testing/engine/generated/playground-meta.ts";

const MIN_META = {
  classes: {
    Player: {
      properties: [
        { name: "name", type: "string", readonly: false },
        { name: "location", type: "Vector3", readonly: false },
        { name: "isOp", type: "boolean", readonly: false },
        { name: "gameMode", type: "GameMode", readonly: false },
        { name: "score", type: "number", readonly: false },
      ],
    },
    Entity: {
      properties: [
        { name: "location", type: "Vector3", readonly: false },
        { name: "isSneaking", type: "boolean", readonly: false },
      ],
    },
  },
  eventTypes: {},
};

test("inferExpectedMeta 解析 Player.name → string", () => {
  const m = inferExpectedMeta("Player.name", MIN_META as never);
  assert.equal(m.type, "string");
});

test("inferExpectedMeta 解析 Player.location → vector3", () => {
  const m = inferExpectedMeta("Player.location", MIN_META as never);
  assert.equal(m.type, "vector3");
});

test("inferExpectedMeta 解析 Player.isOp → boolean", () => {
  const m = inferExpectedMeta("Player.isOp", MIN_META as never);
  assert.equal(m.type, "boolean");
});

test("inferExpectedMeta 解析 Player.gameMode → enum + 候选值", () => {
  const m = inferExpectedMeta("Player.gameMode", MIN_META as never);
  assert.equal(m.type, "enum");
  assert.ok(m.enumValues.includes("Survival"));
  assert.ok(m.enumValues.includes("Creative"));
});

test("inferExpectedMeta 解析 Player.score → number", () => {
  const m = inferExpectedMeta("Player.score", MIN_META as never);
  assert.equal(m.type, "number");
});

test("inferExpectedMeta 解析路径缺前缀时回退 string + fallback=true", () => {
  const m = inferExpectedMeta("name", MIN_META as never);
  assert.equal(m.type, "string");
  // 没有 className 前缀，没法查；视为保守回退
  assert.equal(m.fallback, true);
});

test("inferExpectedMeta 未知 class 保守回退 string", () => {
  const m = inferExpectedMeta("Mystery.x", MIN_META as never);
  assert.equal(m.type, "string");
  assert.equal(m.fallback, true);
});

test("inferExpectedMeta meta=null 时回退 string", () => {
  const m = inferExpectedMeta("Player.location", null);
  assert.equal(m.type, "string");
  assert.equal(m.fallback, true);
});

test("formatExpected / parseExpectedToControl vector3 双向", () => {
  const meta: ExpectedMeta = { type: "vector3", enumValues: [], fallback: false };
  const v = { x: 1, y: 2, z: 3 };
  const s = formatExpected(meta, v);
  assert.equal(s, "[1,2,3]");
  const back = parseExpectedToControl(meta, s);
  assert.equal(back.ok, true);
  if (back.ok) assert.deepEqual(back.value, v);
});

test("formatExpected boolean 双向", () => {
  const meta: ExpectedMeta = { type: "boolean", enumValues: [], fallback: false };
  assert.equal(formatExpected(meta, true), "true");
  assert.equal(formatExpected(meta, false), "false");
  assert.deepEqual(parseExpectedToControl(meta, "true"), { ok: true, value: true });
  assert.deepEqual(parseExpectedToControl(meta, "false"), { ok: true, value: false });
});

test("formatExpected number 双向", () => {
  const meta: ExpectedMeta = { type: "number", enumValues: [], fallback: false };
  assert.equal(formatExpected(meta, 42), "42");
  assert.deepEqual(parseExpectedToControl(meta, "42"), { ok: true, value: 42 });
});

test("formatExpected enum 双向", () => {
  const meta: ExpectedMeta = {
    type: "enum",
    enumValues: ["Survival", "Creative"],
    fallback: false,
  };
  assert.equal(formatExpected(meta, "Survival"), "Survival");
  const ok = parseExpectedToControl(meta, "Survival");
  assert.deepEqual(ok, { ok: true, value: "Survival" });
  const bad = parseExpectedToControl(meta, "God");
  assert.equal(bad.ok, false);
});

test("formatExpected string 原样", () => {
  const meta: ExpectedMeta = { type: "string", enumValues: [], fallback: false };
  assert.equal(formatExpected(meta, "hello"), "hello");
  assert.equal(formatExpected(meta, null), "");
});

test("parseExpectedToControl vector3 兼容 '1,2,3' 旧写法", () => {
  const meta: ExpectedMeta = { type: "vector3", enumValues: [], fallback: false };
  const back = parseExpectedToControl(meta, "1,2,3");
  assert.equal(back.ok, true);
  if (back.ok) assert.deepEqual(back.value, { x: 1, y: 2, z: 3 });
});

test("PLAYGROUND_META 提供 Player / Entity 真实数据", () => {
  // 真实生成器产物至少含 Player 与若干 vector3 / number / boolean property；不严格断言字段名，只确认能解析
  const v = inferExpectedMeta("Player.location", PLAYGROUND_META as never);
  assert.equal(v.type, "vector3");
});
