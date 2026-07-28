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
  /* HH:MM:SS + space + [PAK] + space + [SUC] + space → 约 21 */
  assert.ok(w >= 20 && w <= 24, `prefix width unexpected: ${w}`);
});

test("resolveDisplayLevel：BDS 行从正文解析，其余用 entry.level", async () => {
  const { resolveDisplayLevel, inferLevel, parseBdsEmbeddedLevel, stripBdsLogPrefix, pushLog, getAllLogs } =
    await import("./dist/logs.js");
  assert.equal(
    resolveDisplayLevel({
      time: new Date(),
      text: "[2026-07-18 23:56:06:778 ERROR] boom",
      source: "bds",
      level: "info",
    }),
    "error"
  );
  /* Bedrock 常用 WARN；亦识别纯小写 warn */
  assert.equal(
    parseBdsEmbeddedLevel(
      "[2026-07-25 18:42:27:626 WARN] [Commands] Error on line 4: command failed to parse"
    ),
    "warn"
  );
  assert.equal(
    parseBdsEmbeddedLevel("[2026-07-25 18:42:27:626 warn] [Commands] lowercase level"),
    "warn"
  );
  assert.equal(
    parseBdsEmbeddedLevel("[2026-07-25 18:42:27:626 error] boom"),
    "error"
  );
  assert.equal(
    stripBdsLogPrefix(
      "[2026-07-25 18:42:27:626 WARN] [Commands] Error on line 4: command failed to parse"
    ),
    "[Commands] Error on line 4: command failed to parse"
  );
  assert.equal(
    stripBdsLogPrefix("[2026-07-25 18:42:27:626 warn] [Commands] lowercase level"),
    "[Commands] lowercase level"
  );
  assert.equal(
    resolveDisplayLevel({
      time: new Date(),
      text: "[2026-07-25 18:42:27:626 WARN] [Commands] Error on line 4: command failed to parse",
      source: "bds",
      level: "info",
    }),
    "warn"
  );
  assert.equal(inferLevel("[2026-07-25 18:42:27:626 WARN] [Commands] Syntax error"), "warn");
  assert.equal(inferLevel("[2026-07-25 18:42:27:626 warn] [Commands] Syntax error"), "warn");
  assert.equal(inferLevel("[2026-07-25 18:42:27:626 ERROR] something broke"), "error");

  /* pushLog：等级入库 + 正文剥前缀 */
  const before = getAllLogs().length;
  pushLog(
    "[2026-07-25 18:42:27:626 warn] [Commands] Error on line 4: unexpected /",
    "bds",
    "info"
  );
  const last = getAllLogs().at(-1);
  assert.ok(last);
  assert.equal(last.level, "warn");
  assert.equal(last.text, "[Commands] Error on line 4: unexpected /");
  /* 入库后正文含 Error 字样，不得把展示级别抬成 error（旧 getLogLevel 松散匹配的坑） */
  assert.equal(resolveDisplayLevel(last), "warn");
  assert.ok(getAllLogs().length === before + 1);

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
