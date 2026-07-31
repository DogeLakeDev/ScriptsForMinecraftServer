import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertInspectIds,
  assertLogMatch,
  evaluateAssert,
  formatAssertDetail,
  migrateAssertConfig,
  normalizeAssertKind,
} from "./assert.ts";
import { resolveExpr, collectExprObjectIds, looksLikeExpr } from "./expr.ts";
import { orderNodes } from "./order.ts";

test("orderNodes graph / from / only", () => {
  const nodes = [
    { id: "a", kind: "player" },
    { id: "b", kind: "emit" },
    { id: "c", kind: "tick" },
    { id: "n", kind: "note" },
  ];
  const edges = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ];
  assert.deepEqual(orderNodes(nodes, edges, "only", "b"), ["b"]);
  assert.deepEqual(orderNodes(nodes, edges, "from", "b"), ["b", "c"]);
  assert.deepEqual(orderNodes(nodes, edges, "graph", null), ["a", "b", "c"]);
});

test("assertLogMatch substring / regex / ignoreCase / negate", () => {
  assert.equal(assertLogMatch(["hello playground"], "playground"), true);
  assert.equal(assertLogMatch(["playground"], "/play.*/"), true);
  assert.equal(assertLogMatch(["x"], "nope"), false);
  assert.equal(assertLogMatch(["Hello"], "hello", { ignoreCase: true }), true);
  assert.equal(assertLogMatch(["Hello"], "hello", { ignoreCase: false }), false);
  assert.equal(assertLogMatch(["noise"], "noise", { negate: true }), false);
  assert.equal(assertLogMatch(["noise"], "missing", { negate: true }), true);
  assert.equal(assertLogMatch(["x"], ""), true);
  assert.equal(assertLogMatch(["x"], "", { negate: true }), false);
});

test("migrateAssertConfig defaults old pattern-only nodes to log", () => {
  const m = migrateAssertConfig({ pattern: "ok", detail: "ok" });
  assert.equal(m.assertKind, "log");
  assert.equal(m.pattern, "ok");
  assert.equal(normalizeAssertKind(undefined), "log");
});

test("resolveExpr literals / $ref / @lastEmit / @lastCall", () => {
  assert.equal(looksLikeExpr("$p1.name"), true);
  assert.equal(looksLikeExpr("bob"), false);
  assert.deepEqual(resolveExpr("42", { scene: {} }), { ok: true, value: 42 });
  assert.deepEqual(resolveExpr("true", { scene: {} }), { ok: true, value: true });
  assert.deepEqual(resolveExpr('"hi"', { scene: {} }), { ok: true, value: "hi" });
  assert.deepEqual(resolveExpr("bare", { scene: {} }), { ok: true, value: "bare" });

  const refs = { p1: { id: "p1", props: { name: "bob", nested: { x: 1 } } } };
  assert.deepEqual(resolveExpr("$p1.name", { scene: {}, refs }), { ok: true, value: "bob" });
  assert.deepEqual(resolveExpr("$p1.nested.x", { scene: {}, refs }), { ok: true, value: 1 });
  assert.equal(resolveExpr("$missing.name", { scene: {}, refs }).ok, false);
  assert.equal(resolveExpr("$p1", { scene: {}, refs }).ok, false);

  const scene = {
    lastEmit: { path: "world.beforeEvents.chatSend", payload: { message: "hi" }, result: { cancel: false } },
    lastCall: { id: "p1", method: "sendMessage", result: null },
  };
  assert.deepEqual(resolveExpr("@lastEmit.path", { scene }), {
    ok: true,
    value: "world.beforeEvents.chatSend",
  });
  assert.deepEqual(resolveExpr("@lastEmit.payload.message", { scene }), { ok: true, value: "hi" });
  assert.deepEqual(resolveExpr("@lastCall.method", { scene }), { ok: true, value: "sendMessage" });
  assert.deepEqual(collectExprObjectIds("$p1.name"), ["p1"]);
  assert.deepEqual(collectExprObjectIds("bob"), []);
});

test("evaluateAssert log / logNot", () => {
  const logs = ["[run] ok", "player joined"];
  assert.equal(evaluateAssert({ assertKind: "log", pattern: "joined" }, { logs, scene: {} }).ok, true);
  assert.equal(evaluateAssert({ assertKind: "logNot", pattern: "error" }, { logs, scene: {} }).ok, true);
  assert.equal(evaluateAssert({ assertKind: "logNot", pattern: "joined" }, { logs, scene: {} }).ok, false);
});

test("evaluateAssert sceneExists / count", () => {
  const scene = {
    world: { id: "world", kind: "World" },
    players: [
      { id: "p1", kind: "Player", name: "bob" },
      { id: "p2", kind: "Player", name: "alice" },
    ],
    entities: [{ id: "e1", kind: "Entity", typeId: "minecraft:cow" }],
  };
  assert.equal(
    evaluateAssert({ assertKind: "sceneExists", targetKind: "Player", targetName: "bob" }, { logs: [], scene })
      .ok,
    true
  );
  assert.equal(
    evaluateAssert({ assertKind: "count", targetKind: "Player", countOp: "eq", countN: 2 }, { logs: [], scene })
      .ok,
    true
  );
});

test("evaluateAssert prop with expr expected", () => {
  const target = { id: "p1", kind: "Player", props: { name: "bob", op: true } };
  const other = { id: "p2", kind: "Player", props: { name: "bob" } };
  assert.equal(
    evaluateAssert(
      { assertKind: "prop", targetId: "p1", propName: "name", expected: "$p2.name", matchMode: "equals" },
      { logs: [], scene: {}, target, refs: { p1: target, p2: other } }
    ).ok,
    true
  );
  assert.equal(
    evaluateAssert(
      { assertKind: "prop", targetId: "p1", propName: "name", expected: "bob", matchMode: "equals" },
      { logs: [], scene: {}, target }
    ).ok,
    true
  );
  assert.deepEqual(assertInspectIds({ targetId: "p1", expected: "$p2.name" }).sort(), ["p1", "p2"]);
});

test("evaluateAssert lastEmit path+payload / field", () => {
  const scene = {
    lastEmit: {
      path: "world.beforeEvents.chatSend",
      payload: { message: "hello" },
      result: { cancel: false, message: "hello" },
      at: 1,
    },
    lastCall: { id: "p1", method: "sendMessage", result: "ok", at: 2 },
  };
  assert.equal(
    evaluateAssert({ assertKind: "lastEmit", pattern: "hello" }, { logs: [], scene }).ok,
    true
  );
  assert.equal(
    evaluateAssert({ assertKind: "lastEmit", pattern: "chatSend" }, { logs: [], scene }).ok,
    true
  );
  assert.equal(
    evaluateAssert(
      {
        assertKind: "lastEmit",
        propName: "payload.message",
        expected: "hello",
        matchMode: "equals",
      },
      { logs: [], scene }
    ).ok,
    true
  );
  assert.equal(
    evaluateAssert(
      {
        assertKind: "lastEmit",
        propName: "result.cancel",
        expected: "false",
        matchMode: "equals",
      },
      { logs: [], scene }
    ).ok,
    true
  );
  assert.equal(
    evaluateAssert({ assertKind: "lastCall", pattern: "sendMessage" }, { logs: [], scene }).ok,
    true
  );
  assert.equal(
    evaluateAssert(
      { assertKind: "lastCall", propName: "result", expected: "ok", matchMode: "equals" },
      { logs: [], scene }
    ).ok,
    true
  );
  assert.equal(
    evaluateAssert(
      {
        assertKind: "lastCall",
        propName: "method",
        expected: "@lastCall.method",
        matchMode: "equals",
      },
      { logs: [], scene }
    ).ok,
    true
  );
});

test("formatAssertDetail", () => {
  assert.match(formatAssertDetail({ assertKind: "count", targetKind: "Player", countOp: "gte", countN: 1 }), /≥/);
  assert.match(formatAssertDetail({ assertKind: "log", pattern: "hi", ignoreCase: true }), /忽略大小写/);
});
