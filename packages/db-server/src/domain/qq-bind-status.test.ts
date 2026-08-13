/**
 * domain/qq-bind-status.test.ts — bind 表 + status 查询形状
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { SQL } from "sql-template-strings";
import { initSchema } from "./schema.js";
import { createQuery } from "../lib/sqlite.js";
import { createStatusRoutes, FRESH_MS } from "../routes/status.js";
import { createQqBindRoutes } from "../routes/qq-bind.js";

function memDb() {
  const db = new DatabaseSync(":memory:");
  initSchema(db);
  return { db, query: createQuery(db) };
}

function mockRes() {
  let status = 200;
  let body: Record<string, unknown> = {};
  return {
    res: {
      writeHead(code: number) {
        status = code;
      },
      end(s: string) {
        body = JSON.parse(s) as Record<string, unknown>;
      },
      setHeader() {},
    } as unknown as import("http").ServerResponse,
    get status() {
      return status;
    },
    get body() {
      return body;
    },
  };
}

test("initSchema 含 qq bind 表", () => {
  const { db } = memDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sfmc_qq_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  const names = tables.map((t) => t.name);
  assert.ok(names.includes("sfmc_qq_bind_pending"));
  assert.ok(names.includes("sfmc_qq_bindings"));
  assert.ok(names.includes("sfmc_qq_join_requests"));
  assert.ok(names.includes("sfmc_qq_admin_actions"));
  assert.ok(FRESH_MS > 0);
});

test("GET /api/sfmc/status 空表不抛错", async () => {
  const { query } = memDb();
  const handle = createStatusRoutes({
    query,
    collectSystem: async () => ({
      host: {
        hostname: "test-host",
        platform: "win32",
        arch: "x64",
        release: "10.0",
        uptimeSec: 3600,
        uptimeText: "1时0分",
        cpu: { model: "Test CPU", cores: 4 },
        memory: { totalMb: 8192, freeMb: 4096, usedMb: 4096, usedPercent: 50 },
        loadavg: [0, 0, 0],
      },
      db: { pid: 1, running: true, uptimeSec: 10, uptimeText: "10秒" },
      bds: { state: "stopped", running: false, pid: 0, uptimeSec: null, uptimeText: "未运行" },
    }),
  });
  const m = mockRes();
  const ok = await handle({
    path: "/api/sfmc/status",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(ok, true);
  assert.equal(m.status, 200);
  assert.ok(Array.isArray(m.body.online));
  assert.equal((m.body.online as unknown[]).length, 0);
  assert.equal((m.body.host as { hostname: string }).hostname, "test-host");
  assert.equal((m.body.processes as { bds: { state: string } }).bds.state, "stopped");
});

test("bind request → confirm → me → unbind + 冲突", async () => {
  const { query } = memDb();
  let bodyData: Record<string, unknown> = {};
  const handle = createQqBindRoutes({
    query,
    body: async () => bodyData,
    json: (res, data, status = 200) => {
      (res as unknown as { writeHead: (c: number) => void }).writeHead(status);
      (res as unknown as { end: (s: string) => void }).end(JSON.stringify(data));
    },
  });

  bodyData = { openid: "oa", qq_backend: "official" };
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  const code = String(m.body.code);
  assert.match(code, /^\d{6}$/);

  bodyData = { code, xuid: "x1", name: "Steve" };
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/confirm",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/me",
    method: "GET",
    params: new URLSearchParams("openid=oa"),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.bound, true);
  assert.equal((m.body.binding as { player_name: string }).player_name, "Steve");

  // 冲突：另一 QQ 绑同一 xuid
  bodyData = { openid: "ob", qq_backend: "official" };
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  const code2 = String(m.body.code);
  bodyData = { code: code2, xuid: "x1", name: "Alex" };
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/confirm",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, false);
  assert.equal(m.body.error, "player_already_bound");

  bodyData = { openid: "oa" };
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/unbind",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.unbound, true);

  // 已绑定再 request
  bodyData = { openid: "oa", qq_backend: "official" };
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/bind/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  // 解绑后应能再申请
  assert.equal(m.body.success, true);
});

test("status 新鲜玩家计入 online", async () => {
  const { query } = memDb();
  const now = Date.now();
  query(
    SQL`INSERT INTO sfmc_players (id, name, updated_at) VALUES ('p1', 'Steve', ${now})`
  );
  query(
    SQL`INSERT INTO sfmc_world (day, difficulty, updated_at) VALUES (3, 'normal', ${String(now)})`
  );
  const handle = createStatusRoutes({
    query,
    collectSystem: async () => ({
      host: {
        hostname: "h",
        platform: "linux",
        arch: "x64",
        release: "6",
        uptimeSec: 1,
        uptimeText: "1秒",
        cpu: { model: "c", cores: 2 },
        memory: { totalMb: 1, freeMb: 1, usedMb: 0, usedPercent: 0 },
        loadavg: [0, 0, 0],
      },
      db: { pid: 1, running: true, uptimeSec: 1, uptimeText: "1秒" },
      bds: {
        state: "running",
        running: true,
        pid: 99,
        uptimeSec: 120,
        uptimeText: "2分0秒",
      },
    }),
  });
  const m = mockRes();
  await handle({
    path: "/api/sfmc/status",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.online as unknown[]).length, 1);
  assert.equal((m.body.world as { day: number }).day, 3);
  assert.equal((m.body.processes as { bds: { pid: number } }).bds.pid, 99);
});
