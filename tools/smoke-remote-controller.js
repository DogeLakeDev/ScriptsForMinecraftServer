#!/usr/bin/env node
/**
 * smoke-remote-controller.js — 远程控制冒烟测试
 *
 * 验证 controller 端核心路径:
 *  - 启动 controller (随机端口 + 临时 token + 临时 state)
 *  - POST /v1/enroll → 拿到 agentId + agentSecret
 *  - GET  /v1/agents    → 列出
 *  - 模拟 agent 上线 → POST /v1/agents/{id}/tasks { action: "status" }
 *  - 等到 task 进入 complete,result.services 是数组
 *  - DELETE /v1/agents/{id} → connected: false
 *  - /v1/health 探活
 *
 * 用法: node tools/smoke-remote-controller.js
 * 要求: 远端编译产物已存在 (remote-controller/dist/index.js)
 */
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "remote-controller", "dist", "index.js");
const ENTRY = path.join(ROOT, "tools", "smoke-remote-controller-agent.js");

if (!fs.existsSync(DIST)) {
  console.error(`FAIL: missing build artifact ${DIST} (run: cd remote-controller && npx tsc)`);
  process.exit(1);
}

const PORT = 31000 + Math.floor(Math.random() * 1000);
const HOST = "127.0.0.1";
const ENROLL = randomBytes(24).toString("base64url");
const ADMIN = randomBytes(24).toString("base64url");
const STATE_FILE = path.join(ROOT, "data", `smoke-remote-controller-${Date.now()}.json`);

let controller = null;
let failures = 0;
function pass(label) { console.log(`  PASS  ${label}`); }
function fail(label, detail) {
  failures++;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}
function info(label, value) { console.log(`  ·     ${label}: ${value}`); }

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${token || ""}` };
    if (data) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(data);
    }
    const req = http.request({ hostname: HOST, port: PORT, path: urlPath, method, headers, timeout: 5000 }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (data) req.write(data);
    req.end();
  });
}

function waitForHealth(maxMs = 5000) {
  const deadline = Date.now() + maxMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      request("GET", "/v1/health", null, "").then((r) => {
        if (r.status === 200) return resolve();
        if (Date.now() > deadline) return reject(new Error("controller never became healthy"));
        setTimeout(tick, 100);
      }).catch(() => {
        if (Date.now() > deadline) return reject(new Error("controller never became healthy"));
        setTimeout(tick, 100);
      });
    };
    tick();
  });
}

async function main() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  controller = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      REMOTE_HOST: HOST,
      REMOTE_PORT: String(PORT),
      REMOTE_ENROLL_TOKEN: ENROLL,
      REMOTE_ADMIN_TOKEN: ADMIN,
      REMOTE_STATE_FILE: STATE_FILE,
      REMOTE_HEARTBEAT_MS: "1000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const controllerLog = [];
  controller.stdout.on("data", (d) => controllerLog.push(d.toString()));
  controller.stderr.on("data", (d) => controllerLog.push(d.toString()));

  try {
    await waitForHealth();
    pass("controller started");

    // 1. enroll
    const enrollResp = await request("POST", "/v1/enroll", { name: "smoke" }, ENROLL);
    if (enrollResp.status !== 201 || !enrollResp.body.agentId || !enrollResp.body.agentSecret) {
      throw new Error(`enroll failed: ${JSON.stringify(enrollResp)}`);
    }
    const { agentId, agentSecret } = enrollResp.body;
    info("agentId", agentId);
    pass("enroll");

    // 2. list agents
    const listResp = await request("GET", "/v1/agents", null, ADMIN);
    const agents = listResp.body?.agents || [];
    if (!agents.find((a) => a.id === agentId)) throw new Error("agent not in list");
    pass("list agents");

    // 3. spawn mock agent process
    const agent = spawn(process.execPath, [ENTRY, String(PORT), agentId, agentSecret], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const agentLog = [];
    agent.stdout.on("data", (d) => agentLog.push(d.toString()));
    agent.stderr.on("data", (d) => agentLog.push(d.toString()));

    try {
      // wait for connected
      let connected = false;
      for (let i = 0; i < 30; i++) {
        const r = await request("GET", `/v1/agents/${agentId}`, null, ADMIN);
        if (r.body?.connected) { connected = true; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!connected) throw new Error("agent never connected");
      pass("agent connected via WS");

      // 4. dispatch status task
      const taskResp = await request("POST", `/v1/agents/${agentId}/tasks`, { action: "status" }, ADMIN);
      if (taskResp.status !== 202) throw new Error(`dispatch failed: ${JSON.stringify(taskResp)}`);
      const taskId = taskResp.body.id;
      pass("dispatch status task");

      // 5. wait for complete
      let finalTask = null;
      for (let i = 0; i < 50; i++) {
        const r = await request("GET", `/v1/tasks/${taskId}`, null, ADMIN);
        if (r.body?.status === "complete" || r.body?.status === "failed") { finalTask = r.body; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!finalTask) throw new Error("task did not complete");
      if (finalTask.status !== "complete") throw new Error(`task failed: ${finalTask.error}`);
      if (!Array.isArray(finalTask.result?.services)) throw new Error("task result missing services array");
      info("services", finalTask.result.services.map((s) => `${s.name}=${s.running ? "up" : "down"}`).join(" "));
      pass("task complete with services");

      // 6. list tasks for this agent
      const tasksList = await request("GET", `/v1/agents/${agentId}/tasks`, null, ADMIN);
      if (!Array.isArray(tasksList.body?.tasks) || tasksList.body.tasks.length < 1) throw new Error("task list empty");
      pass("list agent tasks");

      // 7. DELETE agent
      const delResp = await request("DELETE", `/v1/agents/${agentId}`, null, ADMIN);
      if (delResp.status !== 204) throw new Error(`delete expected 204, got ${delResp.status}`);
      const after = await request("GET", `/v1/agents/${agentId}`, null, ADMIN);
      if (after.status !== 404) throw new Error(`agent still present after delete: ${after.status}`);
      pass("delete agent");

      // 8. /v1/health
      const health = await request("GET", "/v1/health", null, "");
      if (health.status !== 200 || !health.body.ok) throw new Error(`health failed: ${JSON.stringify(health)}`);
      pass("health endpoint");
    } finally {
      agent.kill("SIGKILL");
    }
  } catch (e) {
    fail("smoke run", e.message);
    console.error("\ncontroller log:");
    console.error(controllerLog.join(""));
  } finally {
    if (controller) controller.kill("SIGKILL");
    try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
  }

  if (failures) {
    console.error(`\nFAIL: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nPASS: all remote-controller smoke checks passed");
}

main().catch((e) => {
  console.error("FATAL", e);
  if (controller) controller.kill("SIGKILL");
  process.exit(1);
});