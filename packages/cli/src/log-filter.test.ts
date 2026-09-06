/**
 * log-filter 纯函数表驱动（不测 IO）
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileLogFilterRegex, evaluateLogFilter } from "./log-filter.js";

const entry = (over: Record<string, unknown> = {}) => ({
  text: "Player connected: Steve",
  source: "bds",
  level: "info",
  ...over,
});

const baseCfg = (over: Record<string, unknown> = {}) => ({
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
  const r = evaluateLogFilter(entry(), baseCfg({ rules: [{ sources: ["bds", "pack"] }] }));
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
  const both = evaluateLogFilter(entry(), baseCfg({ rules: [{ sources: ["bds"], contains: "Player" }] }));
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
  const r = evaluateLogFilter(entry(), baseCfg({ rules: [{ enabled: false, sources: ["bds"] }] }));
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

test("evaluateLogFilter: 内置 BDS 翻译自动生效", () => {
  const r = evaluateLogFilter(
    entry({
      source: "bds",
      text: "Server started.",
    }),
    baseCfg({
      enabled: false,
      translate: true,
    })
  );
  assert.equal(r.transformedEntry.text, "[服务端] BDS 服务端已成功启动，准备就绪。");
});

test("evaluateLogFilter: 自定义 rule.replace 优先于内置翻译", () => {
  const r = evaluateLogFilter(
    entry({
      source: "bds",
      text: "Server started.",
    }),
    baseCfg({
      enabled: true,
      rules: [
        {
          sources: ["bds"],
          contains: "Server started.",
          replace: ">> 服务器准备完毕 <<",
        },
      ],
    })
  );
  assert.equal(r.transformedEntry.text, ">> 服务器准备完毕 <<");
});

test("evaluateLogFilter: 自定义 rule.replace 支持正则捕获组", () => {
  const r = evaluateLogFilter(
    entry({
      source: "system",
      text: "Job backup_world completed in 42ms",
    }),
    baseCfg({
      enabled: true,
      rules: [
        {
          regex: "Job (\\w+) completed in (\\d+)ms",
          replace: "任务 $1 完成 (耗时: $2毫秒)",
        },
      ],
    })
  );
  assert.equal(r.transformedEntry.text, "任务 backup_world 完成 (耗时: 42毫秒)");
});

test("evaluateLogFilter: translate=false 时不触发内置翻译", () => {
  const r = evaluateLogFilter(
    entry({
      source: "bds",
      text: "Server started.",
    }),
    baseCfg({
      translate: false,
    })
  );
  assert.equal(r.transformedEntry.text, "Server started.");
});
