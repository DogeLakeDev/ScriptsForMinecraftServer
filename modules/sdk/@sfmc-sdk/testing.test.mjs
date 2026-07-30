/**
 * testing.test.mjs — harness 自身冒烟（配合 minecraft-loader）
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
  createSandbox,
} from "./dist/esm/testing/index.js";

test("createFakePlayer 收集 sendMessage", () => {
  const p = createFakePlayer({ id: "1", name: "tester" });
  p.sendMessage("hello");
  p.sendMessage("§a[√] ok");
  assert.equal(p.log.length, 2);
  assert.equal(assertMsg(p, "ok"), true);
});

test("createFakeWorld afterEvents 订阅", () => {
  const w = createFakeWorld();
  const calls = [];
  const handler = (payload) => calls.push(payload);
  w.afterEvents.chatSend.subscribe(handler);
  w.afterEvents.chatSend.emit({ message: 42 });
  w.afterEvents.chatSend.emit({ message: "bar" });
  w.afterEvents.chatSend.unsubscribe(handler);
  w.afterEvents.chatSend.emit({ message: "baz" });
  assert.deepEqual(
    calls.map((c) => c.message),
    [42, "bar"]
  );
});

test("createFakeWorld reset 清空玩家与事件", () => {
  const w = createFakeWorld();
  const calls = [];
  w.afterEvents.chatSend.subscribe((p) => calls.push(p));
  w.afterEvents.chatSend.emit({ message: 1 });
  w.reset();
  w.afterEvents.chatSend.emit({ message: 2 });
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
  await runLifecycle(descriptor, { afterWorldLoad: false });
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

test("createSandbox addPlayer", async () => {
  const sb = await createSandbox();
  const p = sb.addPlayer({ name: "x" });
  assert.equal(sb.world.getPlayers().length, 1);
  assert.equal(p.name, "x");
  assert.ok(sb.supported.l0.server.totalValueExports >= 95);
  assert.ok(sb.supported.l0.serverUi.totalValueExports >= 1);
  await sb.dispose();
});

test("createSandbox 宿主：afterWorldLoad 经假 worldLoad 后 init", async () => {
  const order = [];
  const descriptor = {
    id: "feature-host-awl",
    afterWorldLoad: true,
    lifecycle: {
      registerPermissions() {
        order.push("p");
      },
      registerCommands() {
        order.push("c");
      },
      async init() {
        order.push("i");
      },
      cleanup() {},
    },
  };
  const sb = await createSandbox({ module: descriptor });
  assert.deepEqual(order, ["p", "c", "i"]);
  await sb.dispose();
});

test("createSandbox enabled=false 不 boot", async () => {
  let cmds = 0;
  const descriptor = {
    id: "feature-off",
    afterWorldLoad: false,
    lifecycle: {
      registerCommands() {
        cmds++;
      },
      init() {},
      cleanup() {},
    },
  };
  const sb = await createSandbox({ module: descriptor, enabled: false });
  assert.equal(cmds, 0);
  await sb.dispose();
});

test("createSandbox 宿主：非 afterWorldLoad 在 bootAll 中 init", async () => {
  const order = [];
  const descriptor = {
    id: "feature-host-eager",
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
      init() {
        order.push("i");
      },
      cleanup() {},
    },
  };
  const sb = await createSandbox({ module: descriptor });
  assert.deepEqual(order, ["p", "c", "e", "i"]);
  await sb.dispose();
});

test("FakePlayer 字段对齐：typeId / nameTag / dimension", async () => {
  const sb = await createSandbox();
  const p = sb.addPlayer({ name: "Dana", op: true });
  assert.equal(p.typeId, "minecraft:player");
  assert.equal(p.nameTag, "Dana");
  assert.equal(p.dimension.id, "minecraft:overworld");
  assert.equal(p.playerPermissionLevel, 2);
  await sb.dispose();
});

test("sb.emit 触发 playerJoin / playerSpawn / chatSend / scriptEvent", async () => {
  const sb = await createSandbox();
  const p = sb.addPlayer({ name: "Eve" });
  const joins = [];
  const spawns = [];
  const chats = [];
  const scripts = [];
  sb.world.afterEvents.playerJoin.subscribe((ev) => joins.push(ev.playerName));
  sb.world.afterEvents.playerSpawn.subscribe((ev) => spawns.push(ev.initialSpawn));
  sb.world.beforeEvents.chatSend.subscribe((ev) => chats.push(ev.message));
  sb.system.afterEvents.scriptEventReceive.subscribe((ev) => scripts.push(ev.id));

  sb.emit.playerJoin(p);
  sb.emit.playerSpawn(p, { initialSpawn: false });
  sb.emit.chatSend(p, "!hi");
  sb.emit.scriptEvent("sfmc:ping");

  assert.deepEqual(joins, ["Eve"]);
  assert.deepEqual(spawns, [false]);
  assert.deepEqual(chats, ["!hi"]);
  assert.deepEqual(scripts, ["sfmc:ping"]);
  await sb.dispose();
});

test("Scoreboard：Learn 样例路径 setScore / getScore ?? 0", async () => {
  const sb = await createSandbox();
  const p = sb.addPlayer({ name: "Fran" });
  const board = sb.world.scoreboard;
  let objective = board.getObjective("demo");
  assert.equal(objective, undefined);
  objective = board.addObjective("demo", "Demo");
  assert.equal(objective.displayName, "Demo");
  assert.equal(objective.isValid, true);

  assert.equal(objective.getScore(p.scoreboardIdentity), undefined);
  objective.setScore(p.scoreboardIdentity, 100);
  const playerScore = objective.getScore(p.scoreboardIdentity) ?? 0;
  objective.setScore(p.scoreboardIdentity, playerScore + 10);
  assert.equal(objective.getScore(p), 110);
  assert.equal(objective.addScore(p.name, 5), 115);
  assert.equal(objective.hasParticipant(p), true);

  board.setObjectiveAtDisplaySlot("Sidebar", {
    objective,
    sortOrder: 1,
  });
  assert.equal(board.getObjectiveAtDisplaySlot("Sidebar")?.objective.id, "demo");
  assert.equal(board.getObjectives().length, 1);

  assert.equal(board.removeObjective("demo"), true);
  assert.equal(objective.isValid, false);
  assert.equal(board.getObjective("demo"), undefined);
  await sb.dispose();
});

test("Scoreboard：重复 addObjective 抛错；未设分 getScore 为 undefined", async () => {
  const sb = await createSandbox();
  const board = sb.world.scoreboard;
  board.addObjective("money");
  assert.throws(() => board.addObjective("money"), /already exists/);
  const obj = board.getObjective("money");
  assert.equal(obj.getScore("nobody"), undefined);
  await sb.dispose();
});

test("Dimension：getBlock 缺省空气；setBlockPermutation 可读写", async () => {
  const { BlockPermutation } = await import("@minecraft/server");
  const sb = await createSandbox();
  const dim = sb.world.getDimension("overworld");
  assert.equal(dim.id, "minecraft:overworld");
  const air = dim.getBlock({ x: 1.9, y: 64.2, z: -2.1 });
  assert.equal(air.isAir, true);
  assert.equal(air.typeId, "minecraft:air");
  assert.equal(air.x, 1);
  assert.equal(air.z, -3);

  const stone = BlockPermutation.resolve("minecraft:stone");
  dim.setBlockPermutation({ x: 1, y: 64, z: -3 }, stone);
  const again = dim.getBlock({ x: 1, y: 64, z: -3 });
  assert.equal(again.isAir, false);
  assert.equal(again.typeId, "minecraft:stone");
  assert.equal(again.permutation.matches("stone"), true);

  const p = sb.addPlayer({ name: "Geo" });
  assert.equal(p.dimension.id, "minecraft:overworld");
  assert.equal(p.dimension.getBlock(p.location).isAir, true);

  assert.throws(() => {
    void /** @type {any} */ (dim).fillBlocks;
  }, /未实现的 Minecraft API/);
  await sb.dispose();
});

test("Entity：spawnEntity / getEntities / remove / teleport", async () => {
  const sb = await createSandbox();
  const dim = sb.world.getDimension("overworld");
  const spawned = [];
  sb.world.afterEvents.entitySpawn.subscribe((ev) => spawned.push(ev.entity.typeId));

  const fox = dim.spawnEntity("minecraft:fox", { x: 0, y: 64, z: 0 });
  assert.equal(fox.typeId, "minecraft:fox");
  assert.equal(fox.isValid, true);
  assert.equal(fox.scoreboardIdentity.type, "Entity");
  assert.deepEqual(spawned, ["minecraft:fox"]);

  fox.addTag("pet");
  dim.spawnEntity("minecraft:cow", { x: 10, y: 64, z: 0 });
  const pets = dim.getEntities({ tags: ["pet"] });
  assert.equal(pets.length, 1);
  assert.equal(pets[0].id, fox.id);

  const near = dim.getEntities({
    location: { x: 0, y: 64, z: 0 },
    maxDistance: 2,
    closest: 1,
  });
  assert.equal(near[0].typeId, "minecraft:fox");

  fox.teleport({ x: 5, y: 70, z: 5 });
  assert.equal(fox.location.y, 70);

  assert.equal(fox.kill(), true);
  assert.equal(fox.isValid, false);
  assert.equal(dim.getEntities().length, 1);

  const horse = dim.spawnEntity("minecraft:horse<minecraft:ageable_grow_up>", {
    x: 1,
    y: 64,
    z: 1,
  });
  assert.equal(horse.typeId, "minecraft:horse");
  await sb.dispose();
});

test("Inventory：ItemStack + Container Learn 样例路径", async () => {
  const { ItemStack, EntityInventoryComponent, EntityComponentTypes } = await import(
    "@minecraft/server"
  );
  const sb = await createSandbox();
  const player = sb.addPlayer({ name: "Inv" });
  const inv = player.getComponent(EntityComponentTypes.Inventory);
  assert.ok(inv);
  assert.equal(EntityInventoryComponent.componentId, "minecraft:inventory");
  assert.equal(inv.inventorySize, 36);
  assert.equal(inv.container.size, 36);

  inv.container.setItem(0, new ItemStack("minecraft:apple", 10));
  assert.equal(inv.container.getItem(0)?.typeId, "minecraft:apple");
  assert.equal(inv.container.getItem(0)?.amount, 10);
  assert.equal(inv.container.emptySlotsCount, 35);

  const cart = sb.world.getDimension("overworld").spawnEntity("minecraft:chest_minecart", {
    x: 0,
    y: 64,
    z: 0,
  });
  const cartInv = cart.getComponent("minecraft:inventory");
  assert.equal(cartInv.container.size, 27);
  inv.container.transferItem(0, cartInv.container);
  assert.equal(inv.container.getItem(0), undefined);
  assert.equal(cartInv.container.getItem(0)?.typeId, "minecraft:apple");

  cartInv.container.setItem(1, new ItemStack("emerald", 10));
  inv.container.setItem(0, new ItemStack("minecraft:cake", 1));
  cartInv.container.swapItems(1, 0, inv.container);
  assert.equal(inv.container.getItem(0)?.typeId, "minecraft:emerald");
  assert.equal(cartInv.container.getItem(1)?.typeId, "minecraft:cake");
  await sb.dispose();
});

test("server-ui：CustomForm / MessageBox / Observables（本地 pin 全表面）", async () => {
  const {
    CustomForm,
    MessageBox,
    ObservableBoolean,
    ObservableNumber,
    DataDrivenScreenClosedReason,
    uiManager,
    FormRejectReason,
  } = await import("@minecraft/server-ui");
  const sb = await createSandbox();
  const player = sb.addPlayer({ name: "Ui" });

  // L0：未手写类型仍可 import
  assert.equal(typeof FormRejectReason, "object");

  const toggled = new ObservableBoolean(false);
  const idx = new ObservableNumber(0);
  let clicked = 0;
  const form = new CustomForm(player, "Title")
    .label("hello")
    .toggle("on", toggled)
    .button("Go", () => {
      clicked++;
    });
  sb.ui.queueResponse(player, { selection: 0 });
  const reason = await form.show();
  assert.equal(clicked, 1);
  assert.equal(reason, DataDrivenScreenClosedReason.ClientClosed);
  assert.equal(idx.value, 0);

  const box = new MessageBox(player, "Ask").body("?").button1("Yes").button2("No");
  sb.ui.queueResponse(player, { selection: 1, closeReason: DataDrivenScreenClosedReason.ClientClosed });
  const boxRes = await box.show();
  assert.equal(boxRes.selection, 1);
  assert.equal(boxRes.closeReason, DataDrivenScreenClosedReason.ClientClosed);

  sb.ui.queueResponse(player, { selection: 0 });
  uiManager.closeAllForms(player);
  const empty = await new MessageBox(player, "x").show();
  assert.equal(empty.closeReason, DataDrivenScreenClosedReason.ClientClosed);
  await sb.dispose();
});
