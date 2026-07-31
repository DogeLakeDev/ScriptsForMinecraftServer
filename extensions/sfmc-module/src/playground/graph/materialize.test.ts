import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindCreateObjectId,
  clearCreateObjectIds,
  isPlayerInstantiated,
  playerCreatePayload,
  preferredPlayerObjectId,
} from "./materialize.ts";

test("preferredPlayerObjectId 对齐 FakePlayer 默认 id", () => {
  assert.equal(preferredPlayerObjectId({ name: "alice" }), "player-alice");
  assert.equal(preferredPlayerObjectId({ id: "custom", name: "alice" }), "custom");
  assert.equal(preferredPlayerObjectId(undefined, "bob"), "player-bob");
});

test("playerCreatePayload 注入稳定 id", () => {
  const bag = playerCreatePayload({
    kind: "player",
    title: "alice",
    props: { name: "alice", op: true },
  });
  assert.equal(bag.id, "player-alice");
  assert.equal(bag.name, "alice");
  assert.equal(bag.op, true);
});

test("clear / bind objectId 表示图节点实例化状态", () => {
  const nodes = [
    {
      id: "n1",
      data: {
        kind: "player",
        title: "alice",
        objectId: "player-alice",
        props: { name: "alice", id: "player-alice" },
      },
    },
    { id: "n2", data: { kind: "emit", title: "x" } },
  ];
  assert.equal(isPlayerInstantiated(nodes[0]!.data), true);
  const cleared = clearCreateObjectIds(nodes);
  assert.equal(cleared[0]!.data.objectId, undefined);
  assert.equal(isPlayerInstantiated(cleared[0]!.data), false);
  assert.equal(cleared[1]!.data.kind, "emit");

  const bound = bindCreateObjectId(cleared, "n1", "player-alice");
  assert.equal(bound[0]!.data.objectId, "player-alice");
  assert.equal(bound[0]!.data.props?.id, "player-alice");
});
