/**
 * command-surface.test.mjs — 通道门禁纯函数表驱动
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunCommand,
  findModuleSubSpec,
  findTopLevelSpec,
  listVisibleModuleSubs,
  listVisibleTopLevelNames,
} from "./dist/command-surface.js";

const tty = { isTty: true };
const noTty = { isTty: false };

test("install 仅 external：argv 可跑，REPL 拒绝", () => {
  const spec = findModuleSubSpec("install");
  assert.ok(spec);
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  const r = canRunCommand(spec, { mode: "repl", ...tty });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "externalOnly");
});

test("send 仅 REPL：argv 拒绝", () => {
  const spec = findTopLevelSpec("send");
  assert.ok(spec);
  const r = canRunCommand(spec, { mode: "argv", ...tty });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "replOnly");
  assert.equal(canRunCommand(spec, { mode: "repl", ...tty }).ok, true);
});

test("status 两边可用", () => {
  const spec = findTopLevelSpec("status");
  assert.ok(spec);
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  assert.equal(canRunCommand(spec, { mode: "repl", ...tty }).ok, true);
});

test("create 需 TTY", () => {
  const spec = findModuleSubSpec("create");
  assert.ok(spec);
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  const r = canRunCommand(spec, { mode: "argv", ...noTty });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "needTty");
});

test("build/reload 在 REPL 可见且 accent=dev", () => {
  const build = findModuleSubSpec("build");
  assert.equal(build?.accent, "dev");
  assert.equal(canRunCommand(build, { mode: "repl", ...tty }).ok, true);
  assert.ok(listVisibleModuleSubs("repl").includes("build"));
  assert.ok(!listVisibleModuleSubs("repl").includes("install"));
});

test("argv 顶层列表不含 send；含 debug/install", () => {
  const names = listVisibleTopLevelNames("argv");
  assert.ok(!names.includes("send"));
  assert.ok(names.includes("debug"));
  assert.ok(names.includes("module") || names.includes("mod"));
});

test("REPL 顶层列表含 send；不含 debug", () => {
  const names = listVisibleTopLevelNames("repl");
  assert.ok(names.includes("send"));
  assert.ok(!names.includes("debug"));
});

test("accent 不参与 canRun：debug 在 argv 可跑", () => {
  const spec = findTopLevelSpec("debug");
  assert.equal(spec?.accent, "dev");
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  assert.equal(canRunCommand(spec, { mode: "repl", ...tty }).ok, false);
});

test("logs -f：argv 拒绝，REPL 放行", async () => {
  const { gateLogsFollow } = await import("./dist/cli-gate.js");
  assert.ok(gateLogsFollow(["bds", "-f"], "argv"));
  assert.equal(gateLogsFollow(["bds", "-f"], "repl"), null);
  assert.equal(gateLogsFollow(["bds", "-n", "20"], "argv"), null);
});
