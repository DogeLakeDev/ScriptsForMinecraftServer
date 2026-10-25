/**
 * scoreboard.test.ts — 世界计分板快照的接收、关注期与新鲜度
 *
 * 覆盖：上报格式校验（拒收引用未知参与者、重复 ID、超范围分数等）、无人查看时不要求计算快照、
 * 读取后进入关注期、哈希一致时只确认新鲜度、哈希不一致或数据服务丢失快照时要求补发完整快照、
 * 快照过期判定，以及读取结果按参与者展开。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseScoreboardReport,
  SCOREBOARD_FRESH_MS,
  SCOREBOARD_WATCH_MS,
  ScoreboardStore,
  type ScoreboardReport,
} from "../src/domain/scoreboard.js";

/** 一份包含玩家、虚拟玩家与侧边栏显示位的完整上报 */
function fullReport(hash = "h1", generatedAt = 1_000): Record<string, unknown> {
  return {
    kind: "full",
    hash,
    generatedAt,
    participants: [
      { id: 1, name: "Steve", type: "player", online: true },
      { id: 2, name: "coop.alpha", type: "fakePlayer", online: false },
    ],
    objectives: [
      { id: "kills", displayName: "击杀", scores: [[1, 12], [2, -3]] },
      { id: "money", displayName: "节操", scores: [[1, 500]] },
    ],
    displaySlots: [{ slot: "sidebar", objectiveId: "kills", sortOrder: "descending" }],
    truncated: false,
  };
}

const parse = (data: Record<string, unknown>, now = 1_000): ScoreboardReport => {
  const report = parseScoreboardReport(data, now);
  assert.ok(report, "上报应通过校验");
  return report;
};

test("上报格式：合法的完整快照、哈希与空闲探询", () => {
  assert.equal(parse({ kind: "idle" }).kind, "idle");
  assert.deepEqual(parse({ kind: "same", hash: "h1", generatedAt: 5 }), { kind: "same", hash: "h1", generatedAt: 5 });
  const full = parse(fullReport());
  assert.equal(full.kind, "full");
  if (full.kind === "full") {
    assert.equal(full.objectives.length, 2);
    assert.deepEqual(full.objectives[0]!.scores, [[1, 12], [2, -3]]);
  }
});

test("上报格式：拒收引用未知参与者、重复 ID、越界分数与未知类型", () => {
  const cases: Array<(data: Record<string, unknown>) => void> = [
    (data) => { (data.objectives as Array<{ scores: unknown[] }>)[0]!.scores.push([99, 1]); },
    (data) => { (data.participants as unknown[]).push({ id: 1, name: "dup", type: "player", online: false }); },
    (data) => { (data.objectives as Array<{ scores: unknown[] }>)[0]!.scores.push([1, 2 ** 31]); },
    (data) => { (data.participants as Array<{ type: string }>)[0]!.type = "npc"; },
    (data) => { (data.objectives as unknown[]).push({ id: "kills", displayName: "", scores: [] }); },
    (data) => { (data.displaySlots as Array<{ slot: string }>)[0]!.slot = "hotbar"; },
    (data) => { delete data.hash; },
    (data) => { data.kind = "other"; },
  ];
  for (const mutate of cases) {
    const data = fullReport();
    mutate(data);
    assert.equal(parseScoreboardReport(data, 1_000), null);
  }
});

test("关注期：无人读取时不要求计算，读取后在 WATCH_MS 内要求同步", () => {
  const store = new ScoreboardStore();
  assert.deepEqual(store.report({ kind: "idle" }, 1_000), { watching: false, needFull: false });
  store.read(2_000);
  assert.deepEqual(store.report({ kind: "idle" }, 2_500), { watching: true, needFull: false });
  assert.equal(store.report({ kind: "idle" }, 2_000 + SCOREBOARD_WATCH_MS).watching, false);
});

test("哈希确认：一致时刷新新鲜度，不一致或没有快照时要求补发完整快照", () => {
  const store = new ScoreboardStore();
  assert.equal(store.report({ kind: "same", hash: "h1", generatedAt: 900 }, 1_000).needFull, true, "数据服务没有快照时要求完整快照");
  store.report(parse(fullReport("h1", 1_000)), 1_000);
  assert.equal(store.report({ kind: "same", hash: "h1", generatedAt: 3_000 }, 3_000).needFull, false);
  assert.equal(store.read(3_000).updatedAt, 3_000, "哈希确认推进 updatedAt");
  assert.equal(store.report({ kind: "same", hash: "h2", generatedAt: 4_000 }, 4_000).needFull, true);
  assert.equal(store.read(4_000).updatedAt, 3_000, "哈希不一致时不推进 updatedAt");
});

test("读取结果：按参与者展开分数，超过 FRESH_MS 未确认视为过期", () => {
  const store = new ScoreboardStore();
  const empty = store.read(0);
  assert.equal(empty.available, false);
  assert.ok(empty.note);

  store.report(parse(fullReport("h1", 1_000)), 1_000);
  const view = store.read(1_500);
  assert.equal(view.available, true);
  assert.equal(view.fresh, true);
  assert.deepEqual(view.objectives[0]!.participants, [
    { id: 1, name: "Steve", type: "player", online: true, score: 12 },
    { id: 2, name: "coop.alpha", type: "fakePlayer", online: false, score: -3 },
  ]);
  assert.deepEqual(view.displaySlots, [{ slot: "sidebar", objectiveId: "kills", sortOrder: "descending" }]);

  const stale = store.read(1_000 + SCOREBOARD_FRESH_MS + 1);
  assert.equal(stale.fresh, false);
  assert.ok(stale.note);
  assert.equal(stale.objectives.length, 2, "过期时仍返回最后一次快照");
});

test("脚本连接：任意上报（含空闲探询）都算连接，超过 FRESH_MS 没有上报视为断开", () => {
  const store = new ScoreboardStore();
  assert.equal(store.read(0).scriptConnected, false);
  store.report({ kind: "idle" }, 1_000);
  assert.equal(store.read(1_000 + SCOREBOARD_FRESH_MS).scriptConnected, true);
  assert.equal(store.read(1_001 + SCOREBOARD_FRESH_MS).scriptConnected, false);
});
