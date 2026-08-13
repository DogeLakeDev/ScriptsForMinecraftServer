/**
 * llbot-ws-api.test.ts
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { LlbotWsApi } from "./llbot-ws-api.js";

class FakeSock extends EventEmitter {
  readyState = 1;
  sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
}

test("WS send_group_msg 等 echo 回包", async () => {
  const api = new LlbotWsApi();
  const sock = new FakeSock();
  api.attach(sock as unknown as import("ws").WebSocket);

  const p = api.sendGroupMsg("1058759051", "hello");
  assert.equal(sock.sent.length, 1);
  const req = JSON.parse(sock.sent[0]!) as { action: string; echo: string; params: { group_id: number } };
  assert.equal(req.action, "send_group_msg");
  assert.equal(req.params.group_id, 1058759051);

  assert.equal(
    api.tryHandleResponse({ status: "ok", retcode: 0, echo: req.echo, data: {} }),
    true
  );
  await p;
});

test("事件帧不消费", () => {
  const api = new LlbotWsApi();
  assert.equal(api.tryHandleResponse({ post_type: "message", echo: "x" }), false);
  assert.equal(api.tryHandleResponse({ retcode: 0 }), false);
});
