import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindCreateObjectId,
  clearCreateObjectIds,
  createApiKind,
  createPayloadForKind,
  entityCreatePayload,
  isCreateInstantiated,
  isCreateStimulusKind,
  itemCreatePayload,
  playerCreatePayload,
  preferredEntityObjectId,
  preferredItemObjectId,
  preferredPlayerObjectId,
} from "./materialize.ts";

test("preferredPlayerObjectId 对齐 FakePlayer 默认 id", () => {
  assert.equal(preferredPlayerObjectId({ name: "alice" }), "player-alice");
  assert.equal(preferredPlayerObjectId({ id: "custom", name: "alice" }), "custom");
  assert.equal(preferredPlayerObjectId(undefined, "bob"), "player-bob");
});

test("preferredEntityObjectId / preferredItemObjectId", () => {
  assert.equal(preferredEntityObjectId({ typeId: "minecraft:cow" }), "entity-cow");
  assert.equal(preferredEntityObjectId({ id: "e-custom", typeId: "minecraft:cow" }), "e-custom");
  assert.equal(preferredEntityObjectId(undefined, "fox"), "entity-fox");
  assert.equal(preferredItemObjectId({ typeId: "minecraft:apple" }), "item-apple");
  assert.equal(preferredItemObjectId({ id: "stack-1", typeId: "minecraft:apple" }), "stack-1");
  assert.equal(preferredItemObjectId(undefined, "diamond"), "item-diamond");
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

test("entity / item createPayload 注入稳定 id", () => {
  const e = entityCreatePayload({
    kind: "entity",
    title: "cow",
    props: { typeId: "minecraft:cow", dimensionId: "minecraft:overworld" },
  });
  assert.equal(e.id, "entity-cow");
  assert.equal(e.typeId, "minecraft:cow");

  const item = itemCreatePayload({
    kind: "item",
    title: "apple",
    props: { typeId: "minecraft:apple" },
  });
  assert.equal(item.id, "item-apple");
  assert.equal(item.amount, 1);

  assert.equal(createApiKind("entity"), "Entity");
  assert.equal(createApiKind("item"), "ItemStack");
  assert.deepEqual(createPayloadForKind("item", { kind: "item", props: { typeId: "minecraft:stick", amount: 3 } }).amount, 3);
});

test("clear / bind objectId 覆盖 player / entity / item", () => {
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
    {
      id: "n2",
      data: {
        kind: "entity",
        title: "cow",
        objectId: "entity-cow",
        props: { typeId: "minecraft:cow", id: "entity-cow" },
      },
    },
    {
      id: "n3",
      data: {
        kind: "item",
        title: "apple",
        objectId: "item-apple",
        props: { typeId: "minecraft:apple", id: "item-apple" },
      },
    },
    { id: "n4", data: { kind: "emit", title: "x" } },
  ];
  assert.equal(isCreateStimulusKind("entity"), true);
  assert.equal(isCreateInstantiated(nodes[0]!.data), true);
  assert.equal(isCreateInstantiated(nodes[1]!.data), true);
  assert.equal(isCreateInstantiated(nodes[2]!.data), true);
  const cleared = clearCreateObjectIds(nodes);
  assert.equal(cleared[0]!.data.objectId, undefined);
  assert.equal(cleared[1]!.data.objectId, undefined);
  assert.equal(cleared[2]!.data.objectId, undefined);
  assert.equal(isCreateInstantiated(cleared[0]!.data), false);
  assert.equal(cleared[3]!.data.kind, "emit");

  const bound = bindCreateObjectId(cleared, "n2", "entity-cow");
  assert.equal(bound[1]!.data.objectId, "entity-cow");
  assert.equal(bound[1]!.data.props?.id, "entity-cow");
});
