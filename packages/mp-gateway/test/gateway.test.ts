/**
 * gateway.test.ts — 网关的微信登录、按角色授权管理通道与桌面端设备登录
 *
 * 通过 startGateway 的依赖注入替换外部服务：假微信身份（code → openid）、内存绑定目录（可随时调整等级）、
 * 内存授权存储；管理通道子进程换成一个回显请求的假 CLI，不需要真实部署。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import WebSocket from "ws";
import { encodeDeviceLoginLink, parseDeviceLoginLink } from "@sfmc-bds/management";
import { createDbActivitySource, type PlayerActivityPage, type PlayerActivitySource } from "../src/activity-client.js";
import { authenticateChain, deviceAuthenticator, playerSessionAuthenticator, staticTokenAuthenticator } from "../src/authenticators.js";
import type { GatewayConfig } from "../src/config.js";
import type { PlayerAccount, PlayerDirectory } from "../src/db-client.js";
import { DeviceLogin, type DeviceGrant, type DeviceGrantStore } from "../src/device-login.js";
import { HttpError } from "../src/routes.js";
import { startGateway, type RunningGateway } from "../src/server.js";
import { PLAYER_SESSION_TTL_MS, signPlayerSession, verifyPlayerSession } from "../src/session-token.js";
import type { WechatIdentity } from "../src/wechat.js";

const STATIC_TOKEN = "static-token-0123456789abcdef";
const SECRET = "session-secret-0123456789abcdef";

let workDir = "";
let fakeCli = "";

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-gw-test-"));
  fakeCli = path.join(workDir, "fake-cli.mjs");
  // 假 CLI：每收到一行请求就回一个成功响应，result 回显方法与参数
  fs.writeFileSync(
    fakeCli,
    [
      'import readline from "node:readline";',
      "const rl = readline.createInterface({ input: process.stdin });",
      'rl.on("line", (line) => { const req = JSON.parse(line); process.stdout.write(JSON.stringify({ type: "res", id: req.id, ok: true, result: { method: req.method, params: req.params ?? null } }) + "\\n"); });',
      'rl.on("close", () => process.exit(0));',
    ].join("\n"),
  );
});

after(() => {
  // 假 CLI 子进程在网关关闭后才异步退出（Windows 上仍占用工作目录），重试几次再删
  fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

/** 内存绑定目录：openid → 账号；测试中直接修改 level 模拟升降级 */
function memoryDirectory(): PlayerDirectory & { accounts: Map<string, PlayerAccount> } {
  const accounts = new Map<string, PlayerAccount>();
  const none: PlayerAccount = { bound: false, xuid: "", name: "", boundAt: 0, level: 0, profile: null };
  return {
    accounts,
    async account(openid) {
      return accounts.get(openid) ?? none;
    },
    async requestBindCode(openid) {
      if (accounts.get(openid)?.bound) throw new HttpError(409, "已绑定");
      return { code: "123456", expiresAt: Date.now() + 300_000, ttlMs: 300_000 };
    },
    async unbind(openid) {
      return accounts.delete(openid);
    },
  };
}

/** 绑定一个账号 */
function bind(directory: ReturnType<typeof memoryDirectory>, openid: string, name: string, level: number) {
  directory.accounts.set(openid, { bound: true, xuid: `x-${name}`, name, boundAt: 1, level, profile: null });
}

/** 内存授权存储 */
function memoryStore(): DeviceGrantStore {
  let grants: DeviceGrant[] = [];
  return { load: () => structuredClone(grants), save: (next) => (grants = structuredClone(next)) };
}

/** 假微信身份：code "bad" 视为无效，其余 code → openid-<code> */
const fakeWechat: WechatIdentity = {
  async openidFromCode(code) {
    if (code === "bad") throw new HttpError(401, "微信登录失败（40029）");
    return `openid-${code}`;
  },
};

/** 启动一个测试网关，返回基础地址与依赖；activity 缺省时使用指向不可达地址的 db-server 实现 */
async function launch(options: { wechat?: WechatIdentity | null; activity?: PlayerActivitySource } = {}) {
  const directory = memoryDirectory();
  const config: GatewayConfig = {
    root: workDir,
    host: "127.0.0.1",
    port: 0,
    token: STATIC_TOKEN,
    tokenSource: "argument",
    tokenFile: path.join(workDir, "token.json"),
    node: process.execPath,
    entry: fakeCli,
    maxSessions: 4,
    maxUploadBytes: 1024 * 1024,
    trustProxy: false,
    wechat: null,
    sessionSecret: SECRET,
    dbUrl: "http://127.0.0.1:1",
    devicesFile: path.join(workDir, "devices.json"),
  };
  const gateway: RunningGateway = await startGateway(config, {
    wechat: options.wechat === undefined ? fakeWechat : options.wechat,
    directory,
    grantStore: memoryStore(),
    log: () => undefined,
    ...(options.activity ? { activity: options.activity } : {}),
  });
  const address = gateway.server.address();
  assert.ok(address && typeof address === "object");
  return { gateway, directory, base: `http://127.0.0.1:${address.port}`, ws: `ws://127.0.0.1:${address.port}/manage` };
}

/** 发 JSON 请求 */
async function call(url: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await fetch(url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return { status: response.status, data: (await response.json()) as Record<string, unknown> };
}

/** 微信登录拿玩家会话令牌 */
async function login(base: string, code: string): Promise<string> {
  const { status, data } = await call(`${base}/auth/wx-login`, { body: { code } });
  assert.equal(status, 200);
  return String(data.token);
}

/**
 * 打开 /manage 并在 onOpen 时立刻发出 handshake（验证鉴权期间的早到帧不会丢）。
 * 返回握手响应，或关闭码与原因。
 */
function openManage(url: string, token: string): Promise<{ response?: Record<string, unknown>; code?: number; reason?: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: { authorization: `Bearer ${token}` } });
    ws.on("open", () => ws.send(JSON.stringify({ id: "h1", method: "handshake", params: {} })));
    ws.on("message", (data) => {
      resolve({ response: JSON.parse(data.toString()) as Record<string, unknown> });
      ws.close();
    });
    ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() }));
    ws.on("error", () => undefined);
  });
}

test("玩家会话：签名、篡改、过期与换密钥", () => {
  const now = 1_000_000;
  const { token, expiresAt } = signPlayerSession(SECRET, "wx-a", now);
  assert.equal(expiresAt, now + PLAYER_SESSION_TTL_MS);
  assert.deepEqual(verifyPlayerSession(SECRET, token, now + 1), { openid: "wx-a", exp: expiresAt });
  assert.equal(verifyPlayerSession(SECRET, token, expiresAt), null);
  assert.equal(verifyPlayerSession("another-secret-0123456789abcdef", token, now), null);
  const [prefix, body, signature] = token.split(".");
  const forged = `${prefix}.${Buffer.from(JSON.stringify({ openid: "wx-b", exp: expiresAt })).toString("base64url")}.${signature}`;
  assert.equal(verifyPlayerSession(SECRET, forged, now), null);
  assert.equal(verifyPlayerSession(SECRET, `${prefix}.${body}`, now), null);
});

test("鉴权链：静态令牌 / 3 级管理员通过，2 级与未绑定为 403，未知凭证为 401，降级立即生效", async () => {
  const directory = memoryDirectory();
  const devices = new DeviceLogin(memoryStore());
  const chain = [staticTokenAuthenticator(STATIC_TOKEN), playerSessionAuthenticator(SECRET, directory), deviceAuthenticator(devices, directory)];
  bind(directory, "wx-admin", "Admin", 3);
  bind(directory, "wx-op", "Op", 2);
  const session = (openid: string) => signPlayerSession(SECRET, openid).token;

  assert.equal((await authenticateChain(chain, STATIC_TOKEN)).ok, true);
  assert.equal((await authenticateChain(chain, session("wx-admin"))).ok, true);
  assert.deepEqual(pick(await authenticateChain(chain, session("wx-op"))), { ok: false, status: 403 });
  assert.deepEqual(pick(await authenticateChain(chain, session("wx-nobody"))), { ok: false, status: 403 });
  assert.deepEqual(pick(await authenticateChain(chain, "garbage")), { ok: false, status: 401 });
  assert.deepEqual(pick(await authenticateChain(chain, "")), { ok: false, status: 401 });

  directory.accounts.get("wx-admin")!.level = 2;
  assert.deepEqual(pick(await authenticateChain(chain, session("wx-admin"))), { ok: false, status: 403 });
});

/** 只比较结果的 ok 与 status */
function pick(outcome: { ok: boolean; status?: number }) {
  return outcome.ok ? { ok: true } : { ok: false, status: outcome.status };
}

test("HTTP：微信登录、读取账号、申请绑定码、解绑；无效 code 为 401", async () => {
  const { gateway, directory, base } = await launch();
  try {
    assert.equal((await call(`${base}/auth/wx-login`, { body: { code: "bad" } })).status, 401);
    const token = await login(base, "a");
    let me = await call(`${base}/player/me`, { token });
    assert.deepEqual(me.data, { bound: false, player: null, level: 0, isAdmin: false, profile: null });
    const code = await call(`${base}/player/bind/request`, { token, body: {} });
    assert.equal(code.data.code, "123456");

    bind(directory, "openid-a", "Steve", 3);
    me = await call(`${base}/player/me`, { token });
    assert.equal(me.data.isAdmin, true);
    assert.deepEqual(me.data.player, { name: "Steve", xuid: "x-Steve", boundAt: 1 });
    assert.equal((await call(`${base}/player/bind/request`, { token, body: {} })).status, 409);

    assert.deepEqual((await call(`${base}/player/unbind`, { token, body: {} })).data, { unbound: true });
    assert.equal((await call(`${base}/player/me`, { token: "sfmcp1.bad.sig" })).status, 401);
  } finally {
    await gateway.close();
  }
});

test("HTTP：玩家行为记录按会话 openid 读取并转发查询参数；无会话为 401", async () => {
  const calls: { openid: string; params: string }[] = [];
  const page: PlayerActivityPage = { bound: true, installed: true, records: [], total: 0, limit: 5, offset: 0 };
  const activity: PlayerActivitySource = {
    async page(openid, params) {
      calls.push({ openid, params: params.toString() });
      return page;
    },
  };
  const { gateway, base } = await launch({ activity });
  try {
    assert.equal((await call(`${base}/player/activity`)).status, 401);
    const token = await login(base, "a");
    const result = await call(`${base}/player/activity?limit=5&eventTypePrefix=block.`, { token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, page);
    assert.deepEqual(calls, [{ openid: "openid-a", params: "limit=5&eventTypePrefix=block." }]);
  } finally {
    await gateway.close();
  }
});

test("db-server 行为记录数据源：只转发白名单参数（不含 actorId），失败映射为 503 / 400", async () => {
  const urls: string[] = [];
  const respond = (status: number, body: unknown) =>
    (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
  const ok = createDbActivitySource("http://db", respond(200, { success: true, bound: true, installed: true, records: [], total: 3, limit: 50, offset: 0 }));
  const result = await ok.page("wx-a", new URLSearchParams("actorId=p-alex&actorName=Alex&keyword=hi&limit=10"));
  assert.deepEqual(result, { bound: true, installed: true, records: [], total: 3, limit: 50, offset: 0 });
  assert.equal(urls[0], "http://db/api/sfmc/wechat/activity?openid=wx-a&keyword=hi&limit=10");

  const invalid = createDbActivitySource("http://db", respond(400, { success: false, error: "invalid_params", message: "非法 级别" }));
  await assert.rejects(invalid.page("wx-a", new URLSearchParams("level=x")), (error: unknown) => error instanceof HttpError && error.status === 400);
  const down = createDbActivitySource("http://db", (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch);
  await assert.rejects(down.page("wx-a", new URLSearchParams()), (error: unknown) => error instanceof HttpError && error.status === 503);
});

test("HTTP：未启用微信登录时玩家与设备接口为 503", async () => {
  const { gateway, base } = await launch({ wechat: null });
  try {
    assert.equal((await call(`${base}/auth/wx-login`, { body: { code: "a" } })).status, 503);
    assert.equal((await call(`${base}/auth/device/start`, { body: { name: "pc" } })).status, 503);
    assert.equal((await call(`${base}/player/activity`)).status, 503);
  } finally {
    await gateway.close();
  }
});

test("WebSocket：管理员会话可连接且早到的握手帧不丢；2 级为 4403；无效令牌为 4401", async () => {
  const { gateway, directory, base, ws } = await launch();
  try {
    bind(directory, "openid-admin", "Admin", 3);
    bind(directory, "openid-op", "Op", 2);
    const admin = await openManage(ws, await login(base, "admin"));
    assert.equal(admin.response?.ok, true);
    assert.equal((admin.response?.result as { method?: string }).method, "handshake");
    // 握手参数一律改写为网关配置的实例目录
    assert.deepEqual((admin.response?.result as { params?: unknown }).params, { root: workDir });

    const op = await openManage(ws, await login(base, "op"));
    assert.equal(op.code, 4403);
    const invalid = await openManage(ws, "not-a-token");
    assert.equal(invalid.code, 4401);
    const legacy = await openManage(ws, STATIC_TOKEN);
    assert.equal(legacy.response?.ok, true);
  } finally {
    await gateway.close();
  }
});

test("设备登录：短码批准 → 领取凭证 → 连接 → 撤销后拒绝；非管理员不能批准；授权人降级后拒绝", async () => {
  const { gateway, directory, base, ws } = await launch();
  try {
    bind(directory, "openid-admin", "Admin", 3);
    bind(directory, "openid-op", "Op", 2);
    const adminToken = await login(base, "admin");
    const opToken = await login(base, "op");

    const started = await call(`${base}/auth/device/start`, { body: { name: "My PC" } });
    assert.equal(started.status, 200);
    const { deviceId, userCode, pollSecret } = started.data as { deviceId: string; userCode: string; pollSecret: string };
    assert.match(userCode, /^\d{6}$/);
    assert.deepEqual((await call(`${base}/auth/device/poll`, { body: { deviceId, pollSecret } })).data, { status: "pending" });
    // 错误的 pollSecret 不泄露请求是否存在
    assert.deepEqual((await call(`${base}/auth/device/poll`, { body: { deviceId, pollSecret: "wrong" } })).data, { status: "expired" });

    assert.equal((await call(`${base}/auth/device/approve`, { token: opToken, body: { userCode } })).status, 403);
    const described = await call(`${base}/auth/device/describe`, { token: adminToken, body: { userCode } });
    assert.equal(described.data.name, "My PC");
    assert.equal((await call(`${base}/auth/device/approve`, { token: adminToken, body: { userCode } })).status, 200);

    const polled = await call(`${base}/auth/device/poll`, { body: { deviceId, pollSecret } });
    assert.equal(polled.data.status, "approved");
    assert.equal(polled.data.approvedByName, "Admin");
    const credential = String(polled.data.credential);
    assert.match(credential, /^sfmcd1\./);
    // 凭证只能领取一次
    assert.deepEqual((await call(`${base}/auth/device/poll`, { body: { deviceId, pollSecret } })).data, { status: "expired" });

    assert.equal((await openManage(ws, credential)).response?.ok, true);
    const listed = await call(`${base}/auth/devices`, { token: adminToken });
    const devices = listed.data.devices as Array<{ id: string; name: string; lastUsedAt: number }>;
    assert.equal(devices.length, 1);
    assert.equal(devices[0]!.name, "My PC");
    assert.ok(devices[0]!.lastUsedAt > 0);
    assert.equal(JSON.stringify(listed.data).includes("secretHash"), false);

    directory.accounts.get("openid-admin")!.level = 2;
    assert.equal((await openManage(ws, credential)).code, 4403);
    directory.accounts.get("openid-admin")!.level = 3;

    assert.deepEqual((await call(`${base}/auth/devices/revoke`, { token: adminToken, body: { id: devices[0]!.id } })).data, { revoked: true });
    assert.equal((await openManage(ws, credential)).code, 4401);
  } finally {
    await gateway.close();
  }
});

test("二维码内容：桌面端编码与小程序解析往返一致，非 SFMC 内容返回 null", () => {
  const link = { deviceId: "abc_-123", endpoint: "https://mc.example.com/sfmc?x=1&y=2" };
  assert.deepEqual(parseDeviceLoginLink(encodeDeviceLoginLink(link)), link);
  assert.equal(parseDeviceLoginLink("https://example.com"), null);
  assert.equal(parseDeviceLoginLink("sfmc://device-login?d=abc"), null);
  assert.equal(parseDeviceLoginLink("sfmc://device-login?d=abc&e=ftp%3A%2F%2Fx"), null);
});

test("设备登录：拒绝后桌面端轮询得到 denied，过期请求不能再批准", async () => {
  let now = 1_000_000;
  const devices = new DeviceLogin(memoryStore(), () => now);
  const first = devices.start("PC");
  devices.deny({ userCode: first.userCode });
  assert.deepEqual(devices.poll(first.deviceId, first.pollSecret), { status: "denied" });

  const second = devices.start("PC");
  now += 5 * 60 * 1000 + 1;
  assert.throws(() => devices.approve({ deviceId: second.deviceId }, { openid: "wx", name: "Admin" }), (error: unknown) => error instanceof HttpError && error.status === 404);
  assert.deepEqual(devices.poll(second.deviceId, second.pollSecret), { status: "expired" });
});
