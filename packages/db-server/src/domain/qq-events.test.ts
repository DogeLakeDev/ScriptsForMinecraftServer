/**
 * qq-events 聚合器单测
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createQqEventsAggregator,
  formatImmediateBody,
  formatWindowBody,
  localizeCause,
  MAX_WINDOW_EVENTS,
  normalizeEventPayload,
  resolveQqEventsConfig,
  type ResolvedQqEventsConfig,
} from "./qq-events.js";
import type { OutboundConfig } from "./bridge.js";

const ALL_ON: ResolvedQqEventsConfig = {
  enabled: true,
  window_sec: 60,
  join: true,
  leave: true,
  death: true,
  crash: true,
  start: true,
};

const fakeOutbound: OutboundConfig = {
  backend: "official",
  creds: { appId: "a", appSecret: "s" },
  groupOpenid: "G",
  prefix: "[MC]",
};

test("resolveQqEventsConfig 缺省与总开关", () => {
  const d = resolveQqEventsConfig(undefined);
  assert.equal(d.enabled, true);
  assert.equal(d.window_sec, 60);
  assert.equal(d.join, true);

  const off = resolveQqEventsConfig({ enabled: false, join: false });
  assert.equal(off.enabled, false);
  assert.equal(off.join, false);
  assert.equal(off.death, true);
});

test("localizeCause 映射与原文回退", () => {
  assert.equal(localizeCause("fall"), "坠落");
  assert.equal(localizeCause("drowning"), "溺水");
  assert.equal(localizeCause("custom_xyz"), "custom_xyz");
  assert.equal(localizeCause(""), "");
});

test("normalizeEventPayload 过滤非法 type", () => {
  assert.equal(normalizeEventPayload({ type: "chat" }), null);
  assert.deepEqual(normalizeEventPayload({ type: "join", player: "Steve" }), {
    type: "join",
    player: "Steve",
  });
});

test("formatWindowBody 聚合文案", () => {
  const text = formatWindowBody([
    { type: "join", player: "Steve" },
    { type: "join", player: "Alex" },
    { type: "leave", player: "Bob" },
    { type: "death", player: "Steve", cause: "fall" },
  ]);
  assert.match(text, /^\[MC事件\]/);
  assert.match(text, /上线：Steve、Alex/);
  assert.match(text, /下线：Bob/);
  assert.match(text, /死亡：Steve（坠落）/);
});

test("formatImmediateBody crash/start", () => {
  assert.equal(formatImmediateBody({ type: "crash", detail: "code=1" }), "[MC事件] BDS 意外退出 (code=1)");
  assert.equal(formatImmediateBody({ type: "start", detail: "pid=9" }), "[MC事件] BDS 已启动 (pid=9)");
});

test("窗口内 join+death 到期 flush 成一条", () => {
  const sent: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const agg = createQqEventsAggregator({
    getConfig: () => ({ ...ALL_ON, window_sec: 60 }),
    getOutbound: () => fakeOutbound,
    send: (t) => sent.push(t),
    setTimeoutFn: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutFn: () => {},
  });

  agg.ingestOne({ type: "join", player: "A" });
  agg.ingestOne({ type: "join", player: "B" });
  agg.ingestOne({ type: "death", player: "A", cause: "fall" });
  assert.equal(sent.length, 0);
  assert.equal(agg.pendingCount(), 3);
  assert.equal(timers.length, 1);
  assert.equal(timers[0]!.ms, 60_000);

  timers[0]!.fn();
  assert.equal(sent.length, 1);
  assert.match(sent[0]!, /上线：A、B/);
  assert.match(sent[0]!, /死亡：A（坠落）/);
  assert.equal(agg.pendingCount(), 0);
  agg.dispose();
});

test("crash 立即推且先冲刷窗口", () => {
  const sent: string[] = [];
  const timers: Array<{ fn: () => void }> = [];
  const agg = createQqEventsAggregator({
    getConfig: () => ALL_ON,
    getOutbound: () => fakeOutbound,
    send: (t) => sent.push(t),
    setTimeoutFn: (fn) => {
      timers.push({ fn });
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutFn: () => {},
  });

  agg.ingestOne({ type: "join", player: "Steve" });
  agg.ingestOne({ type: "crash", detail: "code=1" });
  assert.equal(sent.length, 2);
  assert.match(sent[0]!, /上线：Steve/);
  assert.match(sent[1]!, /BDS 意外退出 \(code=1\)/);
  assert.equal(agg.pendingCount(), 0);
  agg.dispose();
});

test("enabled:false 全丢", () => {
  const sent: string[] = [];
  const agg = createQqEventsAggregator({
    getConfig: () => ({ ...ALL_ON, enabled: false }),
    getOutbound: () => fakeOutbound,
    send: (t) => sent.push(t),
  });
  const r = agg.ingestMany([
    { type: "join", player: "A" },
    { type: "crash", detail: "x" },
  ]);
  assert.equal(r.accepted, 0);
  assert.equal(r.rejected, 2);
  assert.equal(sent.length, 0);
  agg.dispose();
});

test("单类关闭：death 关则丢弃", () => {
  const sent: string[] = [];
  const timers: Array<{ fn: () => void }> = [];
  const agg = createQqEventsAggregator({
    getConfig: () => ({ ...ALL_ON, death: false }),
    getOutbound: () => fakeOutbound,
    send: (t) => sent.push(t),
    setTimeoutFn: (fn) => {
      timers.push({ fn });
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutFn: () => {},
  });
  assert.equal(agg.ingestOne({ type: "death", player: "A", cause: "fall" }).accepted, false);
  assert.equal(agg.ingestOne({ type: "join", player: "A" }).accepted, true);
  timers[0]!.fn();
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0]!, /死亡/);
  agg.dispose();
});

test("窗口满 MAX_WINDOW_EVENTS 提前 flush", () => {
  const sent: string[] = [];
  const agg = createQqEventsAggregator({
    getConfig: () => ({ ...ALL_ON, window_sec: 600 }),
    getOutbound: () => fakeOutbound,
    send: (t) => sent.push(t),
    setTimeoutFn: () => 1 as unknown as ReturnType<typeof setTimeout>,
    clearTimeoutFn: () => {},
  });
  for (let i = 0; i < MAX_WINDOW_EVENTS; i++) {
    agg.ingestOne({ type: "join", player: `P${i}` });
  }
  assert.equal(sent.length, 1);
  assert.equal(agg.pendingCount(), 0);
  agg.dispose();
});
