/**
 * wrap-log-line.test.mjs — 悬挂缩进:显式 \\n + 多行软换行均须对齐
 */
import assert from "node:assert/strict";
import test from "node:test";
import { logPrefixWidth, visibleWidth, wrapLogLine } from "./dist/logs.js";

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

test("显式换行后的续行带悬挂缩进", () => {
  const prev = process.stdout.columns;
  process.stdout.columns = 80;
  try {
    const indent = 26;
    const input = `${"x".repeat(10)}\n  https://example.com/abc`;
    const out = stripAnsi(wrapLogLine(input, indent));
    const lines = out.split("\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[1].startsWith(" ".repeat(indent)));
    assert.ok(lines[1].includes("https://example.com/abc"));
    assert.equal(lines[1].trimStart(), "https://example.com/abc");
  } finally {
    process.stdout.columns = prev;
  }
});

test("软换行三行以上每行都悬挂缩进", () => {
  const prev = process.stdout.columns;
  process.stdout.columns = 40;
  try {
    const indent = 10;
    const body = "A".repeat(100);
    const out = stripAnsi(wrapLogLine(body, indent));
    const lines = out.split("\n");
    assert.ok(lines.length >= 3, `expected >=3 lines, got ${lines.length}`);
    assert.equal(lines[0][0], "A");
    for (let i = 1; i < lines.length; i++) {
      assert.ok(
        lines[i].startsWith(" ".repeat(indent)),
        `line ${i} missing indent: ${JSON.stringify(lines[i].slice(0, 20))}`
      );
      assert.ok(visibleWidth(lines[i]) <= 39, `line ${i} width ${visibleWidth(lines[i])} > 39`);
    }
  } finally {
    process.stdout.columns = prev;
  }
});

test("显式换行后再软折:第三行仍缩进", () => {
  const prev = process.stdout.columns;
  process.stdout.columns = 40;
  try {
    const indent = 8;
    const input = `short\n${"B".repeat(80)}`;
    const out = stripAnsi(wrapLogLine(input, indent));
    const lines = out.split("\n");
    assert.ok(lines.length >= 3);
    assert.equal(lines[0], "short");
    for (let i = 1; i < lines.length; i++) {
      assert.ok(lines[i].startsWith(" ".repeat(indent)), `line ${i} no hang indent`);
    }
  } finally {
    process.stdout.columns = prev;
  }
});

test("logPrefixWidth 与常见源标签匹配", () => {
  const log = {
    time: new Date("2026-07-25T00:48:54"),
    text: "hello",
    source: "pack",
    level: "success",
  };
  const w = logPrefixWidth(log);
  /* HH:MM:SS + space + [  PACK  ] + space + [OK] + space */
  assert.ok(w >= 24 && w <= 28, `prefix width unexpected: ${w}`);
});

test("resolveDisplayLevel：BDS 行从正文解析，其余用 entry.level", async () => {
  const { resolveDisplayLevel } = await import("./dist/logs.js");
  assert.equal(
    resolveDisplayLevel({
      time: new Date(),
      text: "[2026-07-18 23:56:06:778 ERROR] boom",
      source: "bds",
      level: "info",
    }),
    "error"
  );
  assert.equal(
    resolveDisplayLevel({
      time: new Date(),
      text: "ok",
      source: "pack",
      level: "success",
    }),
    "success"
  );
});
