/**
 * conformance.test.mjs — 假引擎保真套件（须配合 minecraft-loader）
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSandbox,
  assertMsg,
} from "./dist/esm/testing/index.js";
import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Command, Msg, Permission } from "./dist/esm/sapi/runtime/index.js";

test("system.runTimeout 在 tick 后触发", async () => {
  const sb = await createSandbox();
  let hit = false;
  system.runTimeout(() => {
    hit = true;
  }, 2);
  sb.tick(1);
  assert.equal(hit, false);
  sb.tick(1);
  assert.equal(hit, true);
  await sb.dispose();
});

test("world.beforeEvents.chatSend emit 触发订阅", async () => {
  const sb = await createSandbox();
  const player = sb.addPlayer({ name: "Alice", op: true });
  const seen = [];
  world.beforeEvents.chatSend.subscribe((ev) => {
    seen.push(ev.message);
  });
  world.beforeEvents.chatSend.emit({
    sender: player,
    message: "hi",
    cancel: false,
  });
  assert.deepEqual(seen, ["hi"]);
  await sb.dispose();
});

test("createSandbox boot 命令路径", async () => {
  const descriptor = {
    id: "feature-conformance",
    afterWorldLoad: false,
    lifecycle: {
      registerPermissions() {
        Permission.register("c.use", Permission.Any);
      },
      registerCommands() {
        Command.register(
          "ping",
          "c.use",
          (player) => {
            if (player) Msg.info("pong", player);
          },
          "ping",
          "feature-conformance"
        );
      },
      cleanup() {},
    },
  };
  const sb = await createSandbox({ module: descriptor });
  const player = sb.addPlayer({ name: "Bob", op: true });
  await sb.triggerCommand("ping", player);
  assert.equal(assertMsg(player, "pong"), true);
  await sb.dispose();
});

test("ui.queueResponse 喂给 ActionFormData.show", async () => {
  const sb = await createSandbox();
  const player = sb.addPlayer({ name: "Carol" });
  sb.ui.queueResponse(player, { canceled: false, selection: 1 });
  const form = new ActionFormData().title("t").button("a").button("b");
  const res = await form.show(player);
  assert.equal(res.canceled, false);
  assert.equal(res.selection, 1);
  await sb.dispose();
});

test("未实现 API 抛错", async () => {
  const sb = await createSandbox();
  assert.throws(() => {
    void /** @type {any} */ (world).definitelyNotReal;
  }, /未实现的 Minecraft API/);
  await sb.dispose();
});
