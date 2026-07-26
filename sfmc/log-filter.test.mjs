/**
 * log-filter.test.mjs — 纯函数表驱动（不测 IO）
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  compileLogFilterRegex,
  evaluateLogFilter,
} from "./dist/log-filter.js";

const entry = (over = {}) => ({
  text: "Player connected: Steve",
  source: "bds",
  level: "info",
  ...over,
});

const baseCfg = (over = {}) => ({
  enabled: true,
  mode: "drop",
  applyTo: "display",
  rules: [],
  ...over,
});

test("enabled=false 永不丢弃", () => {
  const r = evaluateLogFilter(
    entry(),
    baseCfg({
      enabled: false,
      mode: "keep",
      rules: [{ sources: ["bds"] }],
    })
  );
  assert.equal(r.dropDisplay, false);
  assert.equal(r.dropDisk, false);
});

test("drop × sources 命中则丢弃展示", () => {
  const r = evaluateLogFilter(
    entry(),
    baseCfg({ rules: [{ sources: ["bds", "pack"] }] })
  );
  assert.equal(r.matched, true);
  assert.equal(r.dropDisplay, true);
  assert.equal(r.dropDisk, false);
});

test("drop × sources 未命中则保留", () => {
  const r = evaluateLogFilter(entry({ source: "system" }), baseCfg({ rules: [{ sources: ["bds"] }] }));
  assert.equal(r.matched, false);
  assert.equal(r.dropDisplay, false);
});

test("drop × levels", () => {
  const hit = evaluateLogFilter(entry({ level: "debug" }), baseCfg({ rules: [{ levels: ["debug", "info"] }] }));
  const miss = evaluateLogFilter(entry({ level: "error" }), baseCfg({ rules: [{ levels: ["debug"] }] }));
  assert.equal(hit.dropDisplay, true);
  assert.equal(miss.dropDisplay, false);
});

test("drop × contains（大小写敏感）", () => {
  const hit = evaluateLogFilter(entry(), baseCfg({ rules: [{ contains: "Player connected" }] }));
  const miss = evaluateLogFilter(entry(), baseCfg({ rules: [{ contains: "player connected" }] }));
  assert.equal(hit.dropDisplay, true);
  assert.equal(miss.dropDisplay, false);
});

test("drop × regex 与 (?i) 旗标", () => {
  const hit = evaluateLogFilter(
    entry({ text: "GAMERULE keepInventory" }),
    baseCfg({ rules: [{ regex: "(?i)gamerule|syntax error" }] })
  );
  const miss = evaluateLogFilter(entry({ text: "hello" }), baseCfg({ rules: [{ regex: "(?i)gamerule" }] }));
  assert.equal(hit.dropDisplay, true);
  assert.equal(miss.dropDisplay, false);
  assert.ok(compileLogFilterRegex("(?i)ABC")?.test("abc"));
  assert.equal(compileLogFilterRegex("("), null);
});

test("同条 AND：sources + contains 须同时满足", () => {
  const both = evaluateLogFilter(
    entry(),
    baseCfg({ rules: [{ sources: ["bds"], contains: "Player" }] })
  );
  const onlySource = evaluateLogFilter(
    entry({ text: "nope" }),
    baseCfg({ rules: [{ sources: ["bds"], contains: "Player" }] })
  );
  assert.equal(both.dropDisplay, true);
  assert.equal(onlySource.dropDisplay, false);
});

test("多条 OR：任一命中即可", () => {
  const r = evaluateLogFilter(
    entry({ source: "pack", text: "done" }),
    baseCfg({
      rules: [{ sources: ["bds"] }, { sources: ["pack"], contains: "done" }],
    })
  );
  assert.equal(r.matched, true);
  assert.equal(r.dropDisplay, true);
});

test("rule.enabled=false 跳过", () => {
  const r = evaluateLogFilter(
    entry(),
    baseCfg({ rules: [{ enabled: false, sources: ["bds"] }] })
  );
  assert.equal(r.matched, false);
  assert.equal(r.dropDisplay, false);
});

test("keep 模式：仅保留匹配，未匹配丢弃", () => {
  const cfg = baseCfg({
    mode: "keep",
    rules: [{ levels: ["error"] }],
  });
  const keep = evaluateLogFilter(entry({ level: "error" }), cfg);
  const drop = evaluateLogFilter(entry({ level: "info" }), cfg);
  assert.equal(keep.dropDisplay, false);
  assert.equal(drop.dropDisplay, true);
});

test("applyTo=all 时落盘与展示一并过滤", () => {
  const r = evaluateLogFilter(
    entry(),
    baseCfg({
      applyTo: "all",
      rules: [{ sources: ["bds"] }],
    })
  );
  assert.equal(r.dropDisplay, true);
  assert.equal(r.dropDisk, true);
});

test("applyTo=display 时仅影响展示", () => {
  const r = evaluateLogFilter(
    entry(),
    baseCfg({
      applyTo: "display",
      rules: [{ sources: ["bds"] }],
    })
  );
  assert.equal(r.dropDisplay, true);
  assert.equal(r.dropDisk, false);
});
