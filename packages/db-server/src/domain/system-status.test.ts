/**
 * domain/system-status.test.ts — formatUptime / host 快照形状
 */

import assert from "node:assert/strict";
import test from "node:test";
import { collectHostStatus, formatUptimeSec } from "./system-status.js";

test("formatUptimeSec 分级", () => {
  assert.equal(formatUptimeSec(45), "45秒");
  assert.equal(formatUptimeSec(125), "2分5秒");
  assert.equal(formatUptimeSec(3661), "1时1分");
  assert.equal(formatUptimeSec(90061), "1天1时1分");
});

test("collectHostStatus 必填字段", () => {
  const h = collectHostStatus(7200);
  assert.equal(h.uptimeSec, 7200);
  assert.equal(h.uptimeText, "2时0分");
  assert.ok(h.hostname.length > 0);
  assert.ok(h.cpu.cores >= 1);
  assert.ok(h.memory.totalMb > 0);
  assert.ok(h.memory.usedPercent >= 0 && h.memory.usedPercent <= 100);
});
