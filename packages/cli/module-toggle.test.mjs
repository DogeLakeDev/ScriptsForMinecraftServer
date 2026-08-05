// @ts-check
/**
 * module-toggle.test.mjs — 本地写 lock + 通知结果信封（纯函数）
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLockEnabled,
  finalizeToggle,
  resolveToggleTarget,
} from "./dist/module-toggle.js";

const candidates = [
  { logicalId: "feature-afk", folderId: "afk", configKey: "afk", canDisable: true },
  { logicalId: "core-gui", folderId: "gui", configKey: "gui", canDisable: false },
];

test("resolveToggleTarget：folderId / logicalId / configKey", () => {
  assert.equal(resolveToggleTarget("afk", candidates)?.logicalId, "feature-afk");
  assert.equal(resolveToggleTarget("feature-afk", candidates)?.logicalId, "feature-afk");
  assert.equal(resolveToggleTarget("afk", candidates)?.folderId, "afk");
  assert.equal(resolveToggleTarget("missing", candidates), null);
});

test("resolveToggleTarget：canDisable 来自候选", () => {
  assert.equal(resolveToggleTarget("gui", candidates)?.canDisable, false);
  assert.equal(resolveToggleTarget("core-gui", candidates)?.canDisable, false);
});

test("applyLockEnabled：写入 enabled + updatedAt", () => {
  const lock = { version: 1, modules: {} };
  const next = applyLockEnabled(lock, "feature-afk", true);
  assert.equal(next.modules["feature-afk"].enabled, true);
  assert.equal(typeof next.modules["feature-afk"].updatedAt, "number");
  assert.equal(lock.modules["feature-afk"].enabled, true);
});

test("finalizeToggle：本地已写 + 通知失败 → ok 且 warn", () => {
  assert.deepEqual(finalizeToggle(true, { ok: true }), { ok: true, warnNotify: false });
  assert.deepEqual(finalizeToggle(true, { ok: false, reason: "unreachable" }), {
    ok: true,
    warnNotify: true,
  });
  assert.deepEqual(finalizeToggle(true, { ok: false, reason: "http", detail: "x" }), {
    ok: true,
    warnNotify: true,
  });
  assert.deepEqual(finalizeToggle(false, { ok: true }), { ok: false, warnNotify: false });
});
