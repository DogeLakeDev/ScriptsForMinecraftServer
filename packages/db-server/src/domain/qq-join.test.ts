/**
 * domain/qq-join.test.ts — 入服审批状态机 + 踢人队列
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initSchema } from "./schema.js";
import { createQuery } from "../lib/sqlite.js";
import { createQqJoinRoutes } from "../routes/qq-join.js";

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
    } as unknown as import("http").ServerResponse,
    get status() {
      return status;
    },
    get body() {
      return body;
    },
  };
}

function makeHandle(
  admins: string[] = ["admin1"],
  flags: {
    allowlistEnabled?: boolean;
    requireApproval?: boolean;
    treatGroupAdminsAsAdmins?: boolean;
  } = {}
) {
  const { query } = memDb();
  let bodyData: Record<string, unknown> = {};
  let joinFlags = {
    allowlistEnabled: flags.allowlistEnabled !== false,
    requireApproval: flags.requireApproval !== false,
    treatGroupAdminsAsAdmins: flags.treatGroupAdminsAsAdmins === true,
  };
  const handle = createQqJoinRoutes({
    query,
    body: async () => bodyData,
    json: (res, data, status = 200) => {
      (res as unknown as { writeHead: (c: number) => void }).writeHead(status);
      (res as unknown as { end: (s: string) => void }).end(JSON.stringify(data));
    },
    getAdminOpenids: () => admins,
    getJoinFlags: () => ({ ...joinFlags }),
    setJoinFlags: (partial) => {
      joinFlags = { ...joinFlags, ...partial };
      return { ...joinFlags };
    },
  });
  return {
    query,
    setBody(d: Record<string, unknown>) {
      bodyData = d;
    },
    handle,
    getFlags: () => ({ ...joinFlags }),
  };
}

test("initSchema 含 join / admin_actions 表", () => {
  const { db } = memDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sfmc_qq_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  assert.ok(tables.some((t) => t.name === "sfmc_qq_join_requests"));
  assert.ok(tables.some((t) => t.name === "sfmc_qq_admin_actions"));
});

test("join request → decide approve → apply-queue → applied", async () => {
  const { setBody, handle } = makeHandle(["admin1"]);

  setBody({ openid: "user1", player_name: "Steve", qq_backend: "official" });
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  const id = String(m.body.id);
  assert.match(id, /^join_/);

  setBody({ id, decision: "approve", decided_by: "stranger" });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/decide",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.status, 403);
  assert.equal(m.body.error, "not_admin");

  setBody({ id, decision: "approve", decided_by: "admin1" });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/decide",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  assert.equal(m.body.status, "approved");

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/apply-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  const queue = m.body.queue as Array<{ id: string; player_name: string }>;
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.player_name, "Steve");

  setBody({ id, ok: true });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/applied",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/apply-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.queue as unknown[]).length, 0);
});

test("join reject 不进 apply-queue", async () => {
  const { setBody, handle } = makeHandle(["admin1"]);
  setBody({ openid: "u2", player_name: "Alex" });
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  const id = String(m.body.id);

  setBody({ id, decision: "reject", decided_by: "admin1" });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/decide",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.status, "rejected");

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/apply-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.queue as unknown[]).length, 0);
});

test("kick → action-queue → action-done", async () => {
  const { setBody, handle } = makeHandle(["admin1"]);

  setBody({ openid: "admin1", target_name: "Steve", reason: "test" });
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/admin/kick",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  const id = String(m.body.id);

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/admin/action-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  const queue = m.body.queue as Array<{ id: string; kind: string; target_name: string }>;
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.kind, "kick");
  assert.equal(queue[0]!.target_name, "Steve");

  setBody({ id, ok: true });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/admin/action-done",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/admin/action-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.queue as unknown[]).length, 0);
});

test("白名单关闭时拒绝申请且 apply-queue 空", async () => {
  const { setBody, handle } = makeHandle(["admin1"], { allowlistEnabled: false });
  setBody({ openid: "u", player_name: "Steve" });
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.status, 403);
  assert.equal(m.body.error, "join_allowlist_disabled");

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/apply-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.queue as unknown[]).length, 0);
});

test("关闭审批时申请直接 approved", async () => {
  const { setBody, handle } = makeHandle(["admin1"], { requireApproval: false });
  setBody({ openid: "u", player_name: "Alex" });
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  assert.equal(m.body.status, "approved");
  assert.equal(m.body.auto_approved, true);

  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/apply-queue",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal((m.body.queue as unknown[]).length, 1);
});

test("管理员可改 settings", async () => {
  const { setBody, handle, getFlags } = makeHandle(["admin1"]);
  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/settings",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.allowlist_enabled, true);
  assert.equal(m.body.require_approval, true);
  assert.equal(m.body.treat_group_admins_as_admins, false);

  setBody({ openid: "stranger", require_approval: false });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/settings",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.status, 403);

  setBody({ openid: "admin1", require_approval: false, allowlist_enabled: true });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/settings",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  assert.equal(m.body.require_approval, false);
  assert.equal(getFlags().requireApproval, false);
});

test("treat_group_admins_as_admins 只读：POST 改写被拒；群管可鉴权", async () => {
  const { setBody, handle, getFlags } = makeHandle([], { treatGroupAdminsAsAdmins: true });

  let m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/settings",
    method: "GET",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.treat_group_admins_as_admins, true);

  setBody({ openid: "gadmin", treat_group_admins_as_admins: false, as_group_admin: true });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/settings",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.status, 400);
  assert.equal(m.body.error, "immutable_field");
  assert.equal(getFlags().treatGroupAdminsAsAdmins, true);

  setBody({ openid: "gadmin", player_name: "Alex", qq_backend: "official" });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/request",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  const id = String(m.body.id);

  setBody({ id, decision: "approve", decided_by: "gadmin", as_group_admin: true });
  m = mockRes();
  await handle({
    path: "/api/sfmc/qq/join/decide",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.body.success, true);
  assert.equal(m.body.status, "approved");

  const denied = makeHandle([], { treatGroupAdminsAsAdmins: false });
  denied.setBody({ id: "x", decision: "approve", decided_by: "gadmin", as_group_admin: true });
  m = mockRes();
  await denied.handle({
    path: "/api/sfmc/qq/join/decide",
    method: "POST",
    params: new URLSearchParams(),
    req: {} as import("http").IncomingMessage,
    res: m.res,
  });
  assert.equal(m.status, 403);
});
