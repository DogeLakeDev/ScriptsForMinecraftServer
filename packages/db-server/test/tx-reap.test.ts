/**
 * tx-reap.test.ts — 交互式事务会话回收（abortModuleSessions / POST /api/sfmc/db/tx/reap）
 *
 * 场景：BDS /reload 时旧脚本实例刚开启的会话来不及提交或回滚，会占住全局事务槽直到空闲超时。
 * 覆盖：回收只作用于指定模块、回收后事务槽立即可用、无遗留会话时返回 0。
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createQuery } from "../src/lib/sqlite.js";
import type { ModuleManifestV2 } from "../src/manifest-loader.js";
import type { SchemaRegistry } from "../src/schema-registry.js";
import type { ServiceRegistry } from "../src/service-registry.js";
import { TxRunner } from "../src/tx-runner.js";

/** 只用到 begin/rollback/abort 的 TxRunner：schema 与 service 不会被调用，manifest 只需存在。 */
function createRunner(moduleIds: string[]) {
  const db = new DatabaseSync(":memory:");
  const enabled = new Map(moduleIds.map((id) => [id, {} as ModuleManifestV2]));
  const runner = new TxRunner(
    {
      db,
      query: createQuery(db),
      schema: {} as SchemaRegistry,
      serviceRegistry: {} as ServiceRegistry,
      enabled,
    },
    { slotWaitTimeoutMs: 50, sessionIdleTimeoutMs: 60_000 }
  );
  return { db, runner };
}

test("abortModuleSessions only reaps the given module and frees the transaction slot", async () => {
  const { db, runner } = createRunner(["economy", "land"]);
  try {
    const stale = await runner.beginSession("economy");
    assert.equal(stale.ok, true);

    // 遗留会话占住事务槽：其他模块开事务会等待超时并返回 transaction_busy
    const blocked = await runner.beginSession("land");
    assert.equal(blocked.ok, false);
    assert.equal(!blocked.ok && blocked.code, "transaction_busy");

    // 回收别的模块不会动 economy 的会话
    assert.equal(runner.abortModuleSessions("land"), 0);
    assert.equal((await runner.beginSession("land")).ok, false);

    // 回收 economy 后事务槽立即可用
    assert.equal(runner.abortModuleSessions("economy"), 1);
    const fresh = await runner.beginSession("land");
    assert.equal(fresh.ok, true);
    if (fresh.ok) assert.deepEqual(runner.rollbackSession(fresh.txId, "land"), { ok: true });

    // 被回收的会话已结束：再回滚按幂等处理
    if (stale.ok) assert.deepEqual(runner.rollbackSession(stale.txId, "economy"), { ok: true });
  } finally {
    db.close();
  }
});

test("abortModuleSessions returns 0 when the module has no open session", () => {
  const { db, runner } = createRunner(["economy"]);
  try {
    assert.equal(runner.abortModuleSessions("economy"), 0);
  } finally {
    db.close();
  }
});
