/**
 * testing.test.mjs — harness 自身冒烟
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFakePlayer,
  createFakeWorld,
  createFakeDb,
  assertMsg,
  runLifecycle,
  runCleanup,
} from "./dist/esm/testing/index.js";

test("createFakePlayer 收集 sendMessage", () => {
  const p = createFakePlayer({ id: "1", name: "tester" });
  p.sendMessage("hello");
  p.sendMessage("§a[√] ok");
  assert.equal(p.log.length, 2);
  assert.equal(p.log[0], "hello");
  assert.equal(assertMsg(p, "ok"), true);
});

test("createFakeWorld emit 触发订阅", () => {
  const w = createFakeWorld();
  const calls = [];
  const off = w.on("foo", (payload) => calls.push(payload));
  w.emit("foo", 42);
  w.emit("foo", "bar");
  off();
  w.emit("foo", "baz");
  assert.deepEqual(calls, [42, "bar"]);
});

test("createFakeWorld reset 清空订阅", () => {
  const w = createFakeWorld();
  const calls = [];
  w.on("e", (p) => calls.push(p));
  w.emit("e", 1);
  w.reset();
  w.emit("e", 2);
  assert.equal(calls.length, 1);
});

test("createFakeDb stub service 调用记录", async () => {
  const db = createFakeDb({
    provides: {
      "echo.input": (input) => ({ echoed: input }),
    },
  });
  const result = await db.tx(async (tx) => {
    return tx.call("echo.input", { v: 1 });
  });
  assert.deepEqual(result, { echoed: { v: 1 } });
});

test("createFakeDb 未 stub 服务抛错", async () => {
  const db = createFakeDb();
  await assert.rejects(
    db.tx(async (tx) => tx.call("missing", {})),
    /no stub for service "missing"/
  );
});

test("runLifecycle 跑过 register* → init", async () => {
  const order = [];
  const descriptor = {
    id: "test",
    afterWorldLoad: false,
    lifecycle: {
      registerPermissions() {
        order.push("p");
      },
      registerCommands() {
        order.push("c");
      },
      registerEvents() {
        order.push("e");
      },
      async init() {
        await Promise.resolve();
        order.push("i");
      },
    },
  };
  const r = await runLifecycle(descriptor);
  assert.equal(r.ok, true);
  assert.deepEqual(order, ["p", "c", "e", "i"]);
});

test("runLifecycle afterWorldLoad=true 不主动 init", async () => {
  const order = [];
  const descriptor = {
    id: "test-w",
    afterWorldLoad: true,
    lifecycle: {
      registerPermissions() {
        order.push("p");
      },
      async init() {
        order.push("i");
      },
    },
  };
  await runLifecycle(descriptor, { afterWorldLoad: false }); /* 显式禁用 init */
  assert.deepEqual(order, ["p"]);
});

test("runLifecycle 抛错时返回 ok=false", async () => {
  const descriptor = {
    id: "boom",
    afterWorldLoad: false,
    lifecycle: {
      registerPermissions() {
        throw new Error("intentional");
      },
    },
  };
  const r = await runLifecycle(descriptor);
  assert.equal(r.ok, false);
  assert.match(r.error.message, /intentional/);
});

test("runCleanup 跑 cleanup 钩子", async () => {
  let cleaned = false;
  const descriptor = {
    id: "c",
    afterWorldLoad: false,
    lifecycle: {
      cleanup() {
        cleaned = true;
      },
    },
  };
  const r = await runCleanup(descriptor);
  assert.equal(r.ok, true);
  assert.equal(cleaned, true);
});