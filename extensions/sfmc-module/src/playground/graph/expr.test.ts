import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveExpr, exprTruthy, collectExprObjectIds } from "./expr.ts";

test("resolveExpr @out.<name> direct read", () => {
  const ctx = {
    scene: {},
    out: { foo: { id: "e1", name: "alpha" } },
  };
  assert.deepEqual(resolveExpr("@out.foo", ctx), { ok: true, value: { id: "e1", name: "alpha" } });
});

test("resolveExpr @out.<name> with property drilling", () => {
  const ctx = {
    scene: {},
    out: { entity: { id: "e1", props: { typeId: "minecraft:zombie", hp: 12 } } },
  };
  assert.deepEqual(resolveExpr("@out.entity.props.typeId", ctx), {
    ok: true,
    value: "minecraft:zombie",
  });
  assert.deepEqual(resolveExpr("@out.entity.props.hp", ctx), { ok: true, value: 12 });
});

test("resolveExpr @out.<name> with bare object drilling", () => {
  const ctx = { scene: {}, out: { bundle: { id: "x", kind: "Bag", value: 7 } } };
  assert.deepEqual(resolveExpr("@out.bundle.value", ctx), { ok: true, value: 7 });
});

test("resolveExpr @out.<name> missing name returns ok:false", () => {
  const ctx = { scene: {}, out: { foo: 1 } };
  assert.equal(resolveExpr("@out.bar", ctx).ok, false);
  assert.match(String(resolveExpr("@out.bar", ctx).error), /尚无记录/);
});

test("resolveExpr @out.<name> priority > @lastCall", () => {
  const ctx = {
    scene: { lastCall: { id: "old", method: "sendMessage", result: "from-lastCall" } },
    out: { foo: "from-out" },
  };
  assert.deepEqual(resolveExpr("@out.foo", ctx), { ok: true, value: "from-out" });
  assert.deepEqual(resolveExpr("@lastCall.result", ctx), { ok: true, value: "from-lastCall" });
});

test("exprTruthy covers common shapes", () => {
  assert.equal(exprTruthy(true), true);
  assert.equal(exprTruthy(false), false);
  assert.equal(exprTruthy(0), false);
  assert.equal(exprTruthy(1), true);
  assert.equal(exprTruthy(""), false);
  assert.equal(exprTruthy("hello"), true);
  assert.equal(exprTruthy(null), false);
  assert.equal(exprTruthy(undefined), false);
  assert.equal(exprTruthy({}), true);
  assert.equal(exprTruthy([]), true);
  assert.equal(exprTruthy({ ok: true }), true);
  assert.equal(exprTruthy({ ok: false }), false);
});

test("collectExprObjectIds still ignores @out.* (out 是字典，不算 token)", () => {
  assert.deepEqual(collectExprObjectIds("@out.foo.name"), []);
  assert.deepEqual(collectExprObjectIds("$p1.name"), ["p1"]);
  assert.deepEqual(collectExprObjectIds("@lastCall.result"), []);
});
