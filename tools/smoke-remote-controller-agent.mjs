#!/usr/bin/env node
/**
 * tools/smoke-remote-controller-agent.mjs — mock sfmc agent for smoke test
 */
import WebSocket from "ws";

const port = parseInt(process.argv[2], 10);
const agentId = process.argv[3];
const agentSecret = process.argv[4];
if (!port || !agentId || !agentSecret) {
  console.error("usage: node smoke-remote-controller-agent.mjs <port> <agentId> <agentSecret>");
  process.exit(2);
}

const url = `ws://127.0.0.1:${port}/v1/agent?id=${encodeURIComponent(agentId)}`;
const ws = new WebSocket(url);

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "hello", agentId, secret: agentSecret }));
});

ws.on("message", (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.type === "ping") return;
  if (msg.type !== "task") return;
  if (msg.action === "status") {
    ws.send(
      JSON.stringify({
        type: "task_result",
        taskId: msg.taskId,
        ok: true,
        result: {
          services: [{ name: "bds", title: "BDS", running: false, pid: 0, uptime: "—" }],
        },
      })
    );
    return;
  }
  ws.send(
    JSON.stringify({
      type: "task_result",
      taskId: msg.taskId,
      ok: false,
      error: "unsupported in mock",
    })
  );
});

ws.on("close", () => process.exit(0));
ws.on("error", () => process.exit(1));
