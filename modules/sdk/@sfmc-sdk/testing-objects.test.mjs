/**
 * testing-objects.test.mjs — sb.objects / sb.events 1:1 API 冒烟（含 Event 对象）
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSandbox, PLAYGROUND_META } from "./dist/esm/testing/index.js";

test("PLAYGROUND_META 含 Player、Event 类与 eventTypes", () => {
  assert.ok(PLAYGROUND_META.classes.Player);
  assert.equal(PLAYGROUND_META.events["world.afterEvents"].length, 65);
  assert.equal(PLAYGROUND_META.events["world.beforeEvents"].length, 16);
  assert.equal(PLAYGROUND_META.classes.PlayerJoinAfterEvent?.kind, "event");
  assert.equal(
    PLAYGROUND_META.eventTypes["world.afterEvents.playerJoin"].eventType,
    "PlayerJoinAfterEvent"
  );
  assert.ok(Object.keys(PLAYGROUND_META.eventTypes).length >= 85);
});

test("场景天生登记 World / Dimension", async () => {
  const sb = await createSandbox({});
  try {
    const scene = sb.objects.sceneNodes();
    assert.equal(scene.world.id, "world");
    assert.equal(scene.dimensions.length, 3);
    assert.ok(scene.dimensions.some((d) => d.dimensionId.includes("overworld")));
    const insp = sb.objects.inspect("world");
    assert.equal(insp.kind, "World");
    assert.throws(() => sb.objects.create("World", {}), /天生已有/);
  } finally {
    await sb.dispose();
  }
});

test("objects.create Player / ItemStack / Event / $ref", async () => {
  const sb = await createSandbox({});
  try {
    const h = sb.objects.create("Player", { name: "alice", op: true });
    assert.equal(h.kind, "Player");
    sb.objects.call(h.id, "sendMessage", ["hi"]);
    const player = /** @type {{ log: string[] }} */ (h.target);
    assert.ok(player.log.some((l) => l.includes("hi")));

    const item = sb.objects.create("ItemStack", { typeId: "minecraft:apple", amount: 3 });
    assert.equal(/** @type {{ amount: number }} */ (item.target).amount, 3);

    const ev = sb.objects.create("ChatSendBeforeEvent", {
      cancel: false,
      message: "hello",
      sender: { $ref: h.id },
    });
    assert.equal(ev.kind, "ChatSendBeforeEvent");
    const bag = /** @type {{ message: string, sender: unknown }} */ (ev.target);
    assert.equal(bag.message, "hello");
    assert.equal(bag.sender, h.target);
  } finally {
    await sb.dispose();
  }
});

test("events.emit 带 Event 类型 payload 与全路径", async () => {
  const sb = await createSandbox({});
  try {
    assert.equal(sb.events.eventType("world.afterEvents.playerJoin"), "PlayerJoinAfterEvent");
    let got = null;
    sb.world.afterEvents.playerJoin.subscribe((e) => {
      got = e;
    });
    const payload = sb.objects.create("PlayerJoinAfterEvent", {
      playerName: "x",
      playerId: "1",
    });
    sb.events.emit("world.afterEvents.playerJoin", payload.target);
    assert.deepEqual(got, { playerName: "x", playerId: "1" });

    for (const path of sb.events.paths()) {
      sb.events.emit(path, {});
    }
  } finally {
    await sb.dispose();
  }
});
