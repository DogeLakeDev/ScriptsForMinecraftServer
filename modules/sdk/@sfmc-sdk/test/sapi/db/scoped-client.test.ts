/**
 * 作用域 db/config 客户端回归：多模块身份隔离 + 事务状态不互斥 + config onChange 不串桶。
 * 通过 stub HttpDB.typedRequest，避免依赖真实 BDS / db-server。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HttpDB } from "../../../src/sapi/runtime/httpdb.js";
import {
  clearDbModuleContext,
  createDbClient,
  setDbModuleContext,
  getDbClient,
} from "../../../src/sapi/db/client.js";
import {
  clearConfigModuleContext,
  createConfigClient,
} from "../../../src/sapi/config/client.js";

type Seen = { method: string; path: string; body?: Record<string, unknown>; auth?: string };

function installHttpStub(handler: (seen: Seen) => { ok: boolean; data?: unknown; status?: number; error?: string }) {
  const seen: Seen[] = [];
  const original = HttpDB.typedRequest.bind(HttpDB);
  HttpDB.typedRequest = (async (method, path, body, opts) => {
    const entry: Seen = {
      method: String(method),
      path,
      body: body as Record<string, unknown> | undefined,
      auth: opts?.authToken,
    };
    seen.push(entry);
    const res = handler(entry);
    return {
      ok: res.ok,
      data: res.data,
      error: res.error,
      status: res.status ?? (res.ok ? 200 : 500),
    };
  }) as typeof HttpDB.typedRequest;
  return {
    seen,
    restore() {
      HttpDB.typedRequest = original;
    },
  };
}

test.afterEach(() => {
  clearDbModuleContext();
  clearConfigModuleContext();
});

test("createDbClient：两模块 query 各自带正确 moduleId 与 token", async () => {
  const stub = installHttpStub((s) => {
    if (s.path.includes("/query")) return { ok: true, data: { rows: [{ id: 1 }] } };
    return { ok: false, error: "unexpected", status: 500 };
  });
  try {
    const a = createDbClient("module-a", "token-a");
    const b = createDbClient("module-b", "token-b");
    await a.query("table_a");
    await b.query("table_b");
    assert.equal(stub.seen.length, 2);
    assert.match(stub.seen[0]!.path, /moduleId=module-a/);
    assert.equal(stub.seen[0]!.auth, "token-a");
    assert.match(stub.seen[1]!.path, /moduleId=module-b/);
    assert.equal(stub.seen[1]!.auth, "token-b");
  } finally {
    stub.restore();
  }
});

test("createDbClient：A 处于 tx 时 B.query 不被全局互斥误杀", async () => {
  let txSeq = 0;
  const stub = installHttpStub((s) => {
    if (s.path.includes("/tx/begin")) {
      txSeq += 1;
      return { ok: true, data: { ok: true, txId: `tx-${txSeq}` } };
    }
    if (s.path.includes("/tx/step")) return { ok: true, data: { ok: true, result: { rows: [] } } };
    if (s.path.includes("/tx/commit")) return { ok: true, data: { ok: true } };
    if (s.path.includes("/query")) return { ok: true, data: { rows: [{ ok: true }] } };
    return { ok: false, error: `unexpected ${s.path}`, status: 500 };
  });
  try {
    const a = createDbClient("module-a", "token-a");
    const b = createDbClient("module-b", "token-b");

    let enteredTx!: () => void;
    const entered = new Promise<void>((r) => {
      enteredTx = r;
    });
    let release!: () => void;
    const hold = new Promise<void>((r) => {
      release = r;
    });

    const txPromise = a.tx(async () => {
      enteredTx();
      await hold; // 模拟网络挂起期间其它模块仍可 query
      return "done";
    });

    await entered;
    assert.equal(a.isTxRecording(), true);
    const rows = await b.query("other");
    assert.deepEqual(rows, [{ ok: true }]);
    assert.ok(stub.seen.some((s) => s.path.includes("/query") && s.path.includes("moduleId=module-b")));

    release();
    assert.equal(await txPromise, "done");
    assert.equal(a.isTxRecording(), false);
  } finally {
    stub.restore();
  }
});

test("setDbModuleContext 登记后 getDbClient 复用同一实例；清 A 不影响 B", () => {
  setDbModuleContext("module-a", "ta");
  setDbModuleContext("module-b", "tb");
  const a1 = getDbClient("module-a");
  setDbModuleContext("module-a", "ta2");
  const a2 = getDbClient("module-a");
  assert.equal(a1, a2);
  assert.equal(a1.moduleId, "module-a");
  clearDbModuleContext("module-a");
  assert.throws(() => getDbClient("module-a"));
  assert.equal(getDbClient("module-b").moduleId, "module-b");
});

test("createConfigClient：onChange 按客户端隔离，不跨模块广播", async () => {
  const stub = installHttpStub((s) => {
    if (s.path.includes("/set")) return { ok: true, data: { ok: true } };
    if (s.path.includes("/configs/")) return { ok: true, data: { config: {} } };
    return { ok: false, error: "unexpected", status: 500 };
  });
  try {
    const a = createConfigClient("module-a", "cfg-a", "ta");
    const b = createConfigClient("module-b", "cfg-b", "tb");
    const seenA: string[] = [];
    const seenB: string[] = [];
    a.onChange((k) => seenA.push(k));
    b.onChange((k) => seenB.push(k));
    await a.set("foo", 1);
    await b.set("bar", 2);
    assert.deepEqual(seenA, ["foo"]);
    assert.deepEqual(seenB, ["bar"]);
  } finally {
    stub.restore();
  }
});
