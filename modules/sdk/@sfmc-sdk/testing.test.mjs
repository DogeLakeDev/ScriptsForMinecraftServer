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

test("World 薄 L2：默认三维、时间、sendMessage、getEntity", async () => {
  const sb = await createSandbox();
  const ids = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"].map(
    (id) => sb.world.getDimension(id).id
  );
  assert.deepEqual(ids, ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]);
  assert.equal(sb.world.getDimension("nether").heightRange.max, 128);
  assert.equal(sb.world.seed, "sfmc-testing");
  assert.equal(sb.world.isHardcore, false);

  sb.world.setAbsoluteTime(25000);
  assert.equal(sb.world.getAbsoluteTime(), 25000);
  assert.equal(sb.world.getDay(), 1);
  assert.equal(sb.world.getTimeOfDay(), 1000);
  sb.world.setTimeOfDay("Noon");
  assert.equal(sb.world.getTimeOfDay(), 6000);

  sb.world.setDefaultSpawnLocation({ x: 8, y: 70, z: -4 });
  assert.deepEqual(sb.world.getDefaultSpawnLocation(), { x: 8, y: 70, z: -4 });

  const p = sb.addPlayer({ name: "MsgP" });
  sb.world.sendMessage("hello-world");
  assert.ok(p.log.some((l) => l.includes("hello-world")));

  const fox = sb.world.getDimension("overworld").spawnEntity("minecraft:fox", { x: 1, y: 64, z: 1 });
  assert.equal(sb.world.getEntity(fox.id)?.typeId, "minecraft:fox");
  assert.equal(sb.world.getEntity(p.id)?.name, "MsgP");

  sb.world.setDynamicProperty("k", 1);
  assert.equal(sb.world.getDynamicProperty("k"), 1);
  assert.deepEqual(sb.world.getDynamicPropertyIds(), ["k"]);
  await sb.dispose();
});

test("Dimension 部分 L2：spawnItem / getEntitiesAtBlockLocation / 天气 / isChunkLoaded", async () => {
  const { ItemStack } = await import("@minecraft/server");
  const sb = await createSandbox();
  const dim = sb.world.getDimension("overworld");
  assert.equal(dim.isChunkLoaded({ x: 1e6, y: 0, z: 1e6 }), true);
  assert.equal(dim.getWeather(), "Clear");
  dim.setWeather("Rain");
  assert.equal(dim.getWeather(), "Rain");

  const item = dim.spawnItem(new ItemStack("minecraft:diamond", 2), { x: 3.2, y: 64, z: -1.8 });
  assert.equal(item.typeId, "minecraft:item");
  const at = dim.getEntitiesAtBlockLocation({ x: 3, y: 64, z: -2 });
  assert.equal(at.length, 1);
  assert.equal(at[0].id, item.id);
  await sb.dispose();
});

test("Entity：spawnEntity / getEntities / remove / teleport", async () => {
  const sb = await createSandbox();
  const dim = sb.world.getDimension("overworld");
  const spawned = [];
  const died = [];
  sb.world.afterEvents.entitySpawn.subscribe((ev) => spawned.push(ev.entity.typeId));
  sb.world.afterEvents.entityDie.subscribe((ev) => died.push(ev.deadEntity.typeId));

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
  assert.deepEqual(died, ["minecraft:fox"]);
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

  const stack = new ItemStack("minecraft:stick", 1);
  assert.throws(() => {
    void /** @type {any} */ (stack).definitelyNotAMethod;
  }, /未实现的 Minecraft API.*ItemStack/);
  assert.throws(() => {
    void /** @type {any} */ (inv.container).definitelyNotAMethod;
  }, /未实现的 Minecraft API.*Container/);
  await sb.dispose();
});

test("ItemStack / Container 缺成员硬失败（独立）", async () => {
  const { ItemStack } = await import("@minecraft/server");
  const sb = await createSandbox();
  const item = new ItemStack("minecraft:dirt", 2);
  assert.equal(item.typeId, "minecraft:dirt");
  assert.equal(item.clone().amount, 2);
  assert.throws(() => {
    void /** @type {any} */ (item).getLore;
  }, /UnimplementedMinecraftApiError|未实现的 Minecraft API/);
  const bag = sb.addPlayer({ name: "HardFail" }).getComponent("minecraft:inventory");
  assert.throws(() => {
    void /** @type {any} */ (bag.container).getItemCooldown;
  }, /未实现的 Minecraft API.*Container/);
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

test("sb.emit.chatSend !命令 走 Command.trigger", async () => {
  const { Command, Msg, Permission } = await import("./dist/esm/sapi/runtime/index.js");
  const descriptor = {
    id: "feature-chat-cmd",
    afterWorldLoad: false,
    lifecycle: {
      registerPermissions() {
        Permission.register("chatcmd.use", Permission.Any);
      },
      registerCommands() {
        Command.register(
          "chatping",
          "chatcmd.use",
          (player) => {
            if (player) Msg.info("chat-pong", player);
          },
          "chat ping"
        );
      },
      cleanup() {},
    },
  };
  const sb = await createSandbox({ module: descriptor });
  const player = sb.addPlayer({ name: "ChatCmd", op: true });
  sb.emit.chatSend(player, "!chatping");
  sb.flush();
  await Promise.resolve();
  sb.flush();
  assert.equal(assertMsg(player, "chat-pong"), true);
  await sb.dispose();
});

test("createSandbox moduleRoot 装载真实入口", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-"));
  fs.mkdirSync(path.join(root, "sapi", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "tmp-mod", type: "module" })
  );
  fs.writeFileSync(
    path.join(root, "sapi", "manifest.json"),
    JSON.stringify({ schemaVersion: 2, id: "feature-load-root", name: "Load Root" })
  );
  // 用 .mjs 避免测试依赖 tsx；生产入口仍是 sapi/src/index.ts
  const entry = path.join(root, "sapi", "src", "index.mjs");
  const sdkLoader = pathToFileURL(path.resolve("dist/esm/module-loader/index.js")).href;
  const sdkRuntime = pathToFileURL(path.resolve("dist/esm/sapi/runtime/index.js")).href;
  fs.writeFileSync(
    entry,
    `
import { ModuleRegistry } from ${JSON.stringify(sdkLoader)};
import { Command, Msg, Permission } from ${JSON.stringify(sdkRuntime)};

export const DESCRIPTOR = {
  id: "feature-load-root",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() { Permission.register("loadroot.use", Permission.Any); },
    registerCommands() {
      Command.register("loadroot", "loadroot.use", (player) => {
        if (player) Msg.info("loaded-from-root", player);
      }, "load root");
    },
    registerEvents() {},
    init() {},
    cleanup() {},
  },
};
ModuleRegistry.register(DESCRIPTOR);
`
  );

  const sb = await createSandbox({ moduleRoot: root });
  assert.equal(sb.module?.id, "feature-load-root");
  assert.equal(sb.module?.root, path.resolve(root));
  const player = sb.addPlayer({ name: "Root", op: true });
  sb.emit.chatSend(player, "!loadroot");
  sb.flush();
  await Promise.resolve();
  sb.flush();
  assert.equal(assertMsg(player, "loaded-from-root"), true);
  await sb.dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

test("L2 本批：getGameMode/setGameMode + playerGameModeChange", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const { GameMode } = await import("@minecraft/server");
  const sb = await createSandbox({});
  const seen = [];
  sb.world.afterEvents.playerGameModeChange.subscribe((ev) => {
    seen.push({ from: ev.fromGameMode, to: ev.toGameMode });
  });
  const p = sb.addPlayer({ name: "GM" });
  assert.equal(p.getGameMode(), GameMode.Survival);
  p.setGameMode(GameMode.Creative);
  assert.equal(p.getGameMode(), "Creative");
  assert.deepEqual(seen, [{ from: "Survival", to: "Creative" }]);
  await sb.dispose();
});

test("L2 本批：runCommand 记录 + gamemode 薄解析", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const sb = await createSandbox({});
  const p = sb.addPlayer({ name: "Cmd" });
  const r = p.runCommand("give @s minecraft:apple 1");
  assert.equal(r.successCount, 1);
  assert.ok(p.commandLog.includes("give @s minecraft:apple 1"));
  p.runCommand("gamemode creative");
  assert.equal(p.getGameMode(), "Creative");
  const dim = sb.world.getDimension("overworld");
  dim.runCommand("say hi");
  assert.ok(dim.commandLog.includes("say hi"));
  await sb.dispose();
});

test("L2 第二批：runCommand give/clear → 物品栏", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const sb = await createSandbox({});
  const p = sb.addPlayer({ name: "Shop" });
  p.runCommand("give @s minecraft:diamond 3 0");
  const inv = p.getComponent("minecraft:inventory").container;
  assert.equal(inv.getItem(0)?.typeId, "minecraft:diamond");
  assert.equal(inv.getItem(0)?.amount, 3);
  // daily-task 形态：clear "Name" item data qty
  p.runCommand('clear "Shop" minecraft:diamond 0 2');
  assert.equal(inv.getItem(0)?.amount, 1);
  p.runCommand("clear @s minecraft:diamond 0 1");
  assert.equal(inv.getItem(0), undefined);
  // 解析不了：仍记录
  p.runCommand("ability @s mayfly true");
  assert.ok(p.commandLog.includes("ability @s mayfly true"));
  await sb.dispose();
});

test("L2 第二批：applyDamage + 生命值袋", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const { EntityHealthComponent } = await import("@minecraft/server");
  const sb = await createSandbox({});
  const dim = sb.world.getDimension("overworld");
  const fox = dim.spawnEntity("minecraft:fox", { x: 0, y: 64, z: 0 });
  const health = fox.getComponent(EntityHealthComponent.componentId);
  assert.equal(health.currentValue, 20);
  const hurt = [];
  const hpChanged = [];
  sb.world.afterEvents.entityHurt.subscribe((ev) => hurt.push(ev.damage));
  sb.world.afterEvents.entityHealthChanged.subscribe((ev) => {
    hpChanged.push({ old: ev.oldValue, neu: ev.newValue });
  });
  assert.equal(fox.applyDamage(7), true);
  assert.equal(health.currentValue, 13);
  assert.deepEqual(hurt, [7]);
  assert.ok(hpChanged.some((r) => r.old === 20 && r.neu === 13));
  assert.equal(fox.applyDamage(0), false);
  health.resetToMaxValue();
  assert.equal(health.currentValue, 20);
  const died = [];
  sb.world.afterEvents.entityDie.subscribe((ev) => died.push(ev.deadEntity.id));
  fox.applyDamage(100);
  assert.equal(fox.isValid, false);
  assert.deepEqual(died, [fox.id]);

  const p = sb.addPlayer({ name: "Tank" });
  const ph = p.getComponent("minecraft:health");
  assert.equal(ph.currentValue, 20);
  p.applyDamage(5);
  assert.equal(ph.currentValue, 15);
  await sb.dispose();
});

test("L2 第二批：itemUse / playerBreakBlock / entityHitEntity emit + getEntitiesOfType", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const { ItemStack } = await import("@minecraft/server");
  const sb = await createSandbox({});
  const p = sb.addPlayer({ name: "Ev" });
  const uses = [];
  const breaks = [];
  const hits = [];
  sb.world.afterEvents.itemUse.subscribe((ev) => uses.push(ev.source.name));
  sb.world.afterEvents.playerBreakBlock.subscribe((ev) => breaks.push(ev.player.name));
  sb.world.afterEvents.entityHitEntity.subscribe((ev) => {
    hits.push([ev.damagingEntity.id, ev.hitEntity.id]);
  });
  sb.emit.itemUse(p, new ItemStack("minecraft:stick", 1));
  sb.emit.playerBreakBlock(p, { block: p.dimension.getBlock(p.location) });
  const fox = p.dimension.spawnEntity("minecraft:fox", { x: 1, y: 64, z: 0 });
  sb.emit.entityHitEntity(p, fox);
  assert.deepEqual(uses, ["Ev"]);
  assert.deepEqual(breaks, ["Ev"]);
  assert.deepEqual(hits, [[p.id, fox.id]]);
  p.dimension.spawnEntity("minecraft:cow", { x: 2, y: 64, z: 0 });
  assert.equal(p.dimension.getEntitiesOfType("minecraft:fox").length, 1);
  assert.equal(p.dimension.getEntitiesOfType("cow").length, 1);
  await sb.dispose();
});

test("L2 本批：playSound / onScreenDisplay / spawnPoint / playerLeave", async () => {
  const { createSandbox } = await import("./dist/esm/testing/index.js");
  const sb = await createSandbox({});
  const p = sb.addPlayer({ name: "Hud" });
  p.playSound("bucket.fill_water");
  assert.deepEqual(p.soundLog, ["bucket.fill_water"]);
  p.onScreenDisplay.setTitle("Hello", { subtitle: "World" });
  assert.equal(p.onScreenDisplay.title, "Hello");
  assert.equal(p.onScreenDisplay.subtitle, "World");
  p.onScreenDisplay.setActionBar("bar");
  assert.equal(p.onScreenDisplay.actionBar, "bar");
  p.onScreenDisplay.updateSubtitle("2");
  assert.equal(p.onScreenDisplay.subtitle, "2");
  assert.equal(p.getSpawnPoint(), undefined);
  p.setSpawnPoint({ dimension: p.dimension, x: 10, y: 70, z: -3 });
  const sp = p.getSpawnPoint();
  assert.equal(sp?.x, 10);
  assert.equal(sp?.y, 70);
  assert.equal(sp?.z, -3);

  let left = null;
  sb.world.afterEvents.playerLeave.subscribe((ev) => {
    left = ev.playerId;
  });
  sb.emit.playerLeave(p);
  assert.equal(left, p.id);
  assert.equal(sb.world.getPlayers().length, 0);
  await sb.dispose();
});

test("L2 本批：未接线 API 仍硬失败（无空成功）", async () => {
  const { createSandbox, UnimplementedMinecraftApiError } = await import(
    "./dist/esm/testing/index.js"
  );
  const sb = await createSandbox({});
  const p = sb.addPlayer({ name: "Hard" });
  assert.throws(() => p.applyImpulse?.({ x: 0, y: 1, z: 0 }), (err) => {
    return (
      err instanceof UnimplementedMinecraftApiError ||
      (err instanceof Error && /未实现的 Minecraft API/.test(err.message))
    );
  });
  assert.throws(() => p.onScreenDisplay.hideAllExcept?.(), (err) => {
    return err instanceof Error && /未实现的 Minecraft API/.test(err.message);
  });
  await sb.dispose();
});
