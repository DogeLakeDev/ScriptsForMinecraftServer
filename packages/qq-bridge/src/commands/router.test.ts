/**
 * commands/router.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { registerBuiltinCommands } from "./handlers.js";
import { PendingChoiceStore } from "./pending.js";
import { CommandRegistry } from "./registry.js";
import { CommandRouter } from "./router.js";
import type { CommandResult, InboundMessage, ReplyPort } from "./types.js";

function makeReplyCapture(): { port: ReplyPort; sent: CommandResult[] } {
  const sent: CommandResult[] = [];
  return {
    sent,
    port: {
      async send(_t, result) {
        sent.push(result);
      },
    },
  };
}

function makeRouter(reply: ReplyPort): CommandRouter {
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  return new CommandRouter({
    registry,
    pending: new PendingChoiceStore(60_000),
    reply,
    startedAt: Date.now() - 5000,
    runtimeInfo: { sandbox: false, appIdHint: "1905…6765" },
  });
}

test("router 命中 ping", async () => {
  const { port, sent } = makeReplyCapture();
  const router = makeRouter(port);
  const inbound: InboundMessage = {
    backend: "official",
    groupId: "G",
    userId: "U",
    userName: "Alice",
    text: "/ping",
    msgId: "m1",
  };
  assert.equal(await router.handle(inbound), true);
  assert.equal(sent.length, 1);
  assert.match(sent[0]!.text, /^pong/);
});

test("registry 首词匹配「申请入服 Steve」", () => {
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  const cmd = registry.resolve("申请入服 Steve");
  assert.ok(cmd);
  assert.equal(cmd!.name, "join");
  assert.equal(registry.resolve("踢人 Alex")?.name, "kick");
});

test("router 未命中透传", async () => {
  const { port, sent } = makeReplyCapture();
  const router = makeRouter(port);
  assert.equal(
    await router.handle({
      backend: "official",
      groupId: "G",
      userId: "U",
      userName: "A",
      text: "hello world",
    }),
    false
  );
  assert.equal(sent.length, 0);
});

test("router llbot 编号会话", async () => {
  const { port, sent } = makeReplyCapture();
  const router = makeRouter(port);
  const base: InboundMessage = {
    backend: "llbot",
    groupId: "123",
    userId: "99",
    userName: "Bob",
    text: "菜单",
  };
  assert.equal(await router.handle(base), true);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]!.buttons && sent[0]!.buttons.length >= 2);

  assert.equal(
    await router.handle({ ...base, text: "1" }),
    true
  );
  assert.equal(sent.length, 2);
  // 第 1 个按钮对应 ping（主菜单已去掉自指 menu）
  assert.match(sent[1]!.text, /^pong/);
});

test("registry normalizeTrigger", async () => {
  const { normalizeTrigger } = await import("./registry.js");
  assert.equal(normalizeTrigger(" /Ping "), "ping");
  assert.equal(normalizeTrigger("菜单"), "菜单");
});
