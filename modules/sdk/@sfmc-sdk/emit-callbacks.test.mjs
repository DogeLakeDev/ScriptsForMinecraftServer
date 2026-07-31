import { test } from "node:test";
import assert from "node:assert/strict";
import { createSandbox } from "./dist/esm/testing/index.js";
import { world } from "@minecraft/server";

test("events.emit 同步调用 @minecraft/server 上模块 subscribe 的回调", async () => {
  let hits = 0;
  /** @type {unknown} */
  let lastEv = null;
  const sb = await createSandbox({
    module: {
      id: "emit-cb-module",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents() {
          world.afterEvents.playerJoin.subscribe((ev) => {
            hits++;
            lastEv = ev;
          });
        },
      },
    },
  });
  try {
    assert.equal(sb.events.listenerCount("world.afterEvents.playerJoin"), 1);
    assert.equal(sb.world.afterEvents.playerJoin, world.afterEvents.playerJoin);

    const payload = { playerName: "Neo", playerId: "p1" };
    const returned = sb.events.emit("world.afterEvents.playerJoin", payload);
    assert.equal(hits, 1);
    assert.equal(returned, payload); // 无 $ref 时保持同一引用
    assert.equal(lastEv, payload);

    const meta = sb.events.lastMeta();
    assert.ok(meta);
    assert.equal(meta.listeners, 1);
    assert.equal(meta.errors.length, 0);
  } finally {
    await sb.dispose();
  }
});

test("events.emit 回调抛错仍继续调用其余订阅，并记入 lastMeta.errors", async () => {
  const order = [];
  const sb = await createSandbox({
    module: {
      id: "emit-err-module",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents() {
          world.beforeEvents.chatSend.subscribe(() => {
            order.push("a");
            throw new Error("boom-a");
          });
          world.beforeEvents.chatSend.subscribe(() => {
            order.push("b");
          });
        },
      },
    },
  });
  try {
    // 命令桥 + 模块两个 = 至少 3
    const n = sb.events.listenerCount("world.beforeEvents.chatSend");
    assert.ok(n >= 3, `expected >=3 listeners, got ${n}`);

    sb.events.emit("world.beforeEvents.chatSend", {
      message: "hi",
      sender: null,
      cancel: false,
    });
    assert.deepEqual(order, ["a", "b"]);
    const meta = sb.events.lastMeta();
    assert.ok(meta);
    assert.equal(meta.listeners, n);
    assert.ok(meta.errors.some((e) => e.message.includes("boom-a")));
  } finally {
    await sb.dispose();
  }
});

test("events.subscribedPaths 列出已 subscribe 的 path", async () => {
  const sb = await createSandbox({
    module: {
      id: "sub-paths-module",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents() {
          world.afterEvents.playerJoin.subscribe(() => {});
          world.afterEvents.playerSpawn.subscribe(() => {});
        },
      },
    },
  });
  try {
    const subs = sb.events.subscribedPaths();
    const paths = subs.map((s) => s.path);
    assert.ok(paths.includes("world.afterEvents.playerJoin"));
    assert.ok(paths.includes("world.afterEvents.playerSpawn"));
    // 宿主 chat→命令桥
    assert.ok(paths.includes("world.beforeEvents.chatSend"));
    const join = subs.find((s) => s.path === "world.afterEvents.playerJoin");
    assert.equal(join?.listeners, 1);
  } finally {
    await sb.dispose();
  }
});

test("beforeEvents emit 同一事件对象可被回调 cancel", async () => {
  const sb = await createSandbox({ boot: false });
  try {
    sb.world.beforeEvents.chatSend.subscribe((ev) => {
      ev.cancel = true;
    });
    const bag = { message: "x", sender: null, cancel: false };
    sb.events.emit("world.beforeEvents.chatSend", bag);
    assert.equal(bag.cancel, true);
  } finally {
    await sb.dispose();
  }
});
