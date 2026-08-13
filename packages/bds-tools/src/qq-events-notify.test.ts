/**
 * qq-events-notify 单测：失败不抛、可注入 host/port
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { postBdsLifecycleEvent } from "./qq-events-notify.js";

test("postBdsLifecycleEvent：db 不可达不抛错", async () => {
  await assert.doesNotReject(() =>
    postBdsLifecycleEvent("start", "pid=1", {
      host: "127.0.0.1",
      port: 1,
      timeoutMs: 200,
    })
  );
});

test("postBdsLifecycleEvent：2xx 成功", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      assert.equal(req.method, "POST");
      assert.equal(req.url, "/api/sfmc/qq/events");
      const parsed = JSON.parse(body) as { type: string; detail?: string };
      assert.equal(parsed.type, "crash");
      assert.equal(parsed.detail, "code=1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  try {
    await postBdsLifecycleEvent("crash", "code=1", {
      host: "127.0.0.1",
      port: addr.port,
      timeoutMs: 2000,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
