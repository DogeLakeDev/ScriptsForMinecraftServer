// @ts-check
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
  resolveModuleTopShorthand,
} from "./dist/command-surface.js";

const tty = { isTty: true };
const noTty = { isTty: false };

test("install 两边可用（both）", () => {
  const spec = findModuleSubSpec("install");
  assert.ok(spec);
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  assert.equal(canRunCommand(spec, { mode: "repl", ...tty }).ok, true);
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

test("build/reload/install 在 REPL 可见", () => {
  const build = findModuleSubSpec("build");
  assert.equal(build?.accent, "dev");
  assert.equal(canRunCommand(build, { mode: "repl", ...tty }).ok, true);
  assert.ok(listVisibleModuleSubs("repl").includes("build"));
  assert.ok(listVisibleModuleSubs("repl").includes("install"));
});

test("argv 顶层列表不含 send；含 debug/install/uninstall", () => {
  const names = listVisibleTopLevelNames("argv");
  assert.ok(!names.includes("send"));
  assert.ok(names.includes("debug"));
  assert.ok(names.includes("install"));
  assert.ok(names.includes("uninstall") || names.includes("remove"));
  assert.ok(names.includes("module") || names.includes("mod"));
});

test("REPL 顶层列表含 send 与 debug", () => {
  const names = listVisibleTopLevelNames("repl");
  assert.ok(names.includes("send"));
  assert.ok(names.includes("debug"));
  assert.ok(names.includes("init"));
});

test("accent 不参与 canRun：debug 两边可跑", () => {
  const spec = findTopLevelSpec("debug");
  assert.equal(spec?.accent, "dev");
  assert.equal(canRunCommand(spec, { mode: "argv", ...tty }).ok, true);
  assert.equal(canRunCommand(spec, { mode: "repl", ...tty }).ok, true);
});

test("模块顶层短命令映射", () => {
  assert.equal(resolveModuleTopShorthand("i"), "install");
  assert.equal(resolveModuleTopShorthand("remove"), "uninstall");
  assert.equal(resolveModuleTopShorthand("search"), "search");
  assert.equal(resolveModuleTopShorthand("status"), undefined);
});

test("logs 仅 REPL（无参叶命令）", async () => {
  const { gateTopLevel } = await import("./dist/cli-gate.js");
  const { listPaletteRoots } = await import("./dist/command-surface.js");
  assert.ok(gateTopLevel("logs", "argv"), "argv 应拒绝 logs");
  assert.equal(gateTopLevel("logs", "repl"), null);
  const logs = listPaletteRoots("repl").find((n) => n.token === "logs");
  assert.ok(logs);
  assert.equal(logs.children, undefined);
  assert.notEqual(logs.freeArgs, true);
});

test("命令面板根列不含 module 短命令，统一挂在 /module", async () => {
  const { listPaletteRoots } = await import("./dist/command-surface.js");
  const roots = listPaletteRoots("repl");
  const tokens = roots.map((n) => n.token);
  for (const shy of ["install", "uninstall", "search", "verify", "link", "create", "dev"]) {
    assert.ok(!tokens.includes(shy), `面板根列不应有 /${shy}`);
  }
  const mod = roots.find((n) => n.token === "module");
  assert.ok(mod?.children?.length);
  const childTokens = mod.children.map((n) => n.token);
  assert.ok(childTokens.includes("install"));
  assert.ok(childTokens.includes("uninstall"));
  assert.ok(!childTokens.includes("create"));
  assert.ok(!childTokens.includes("link"));
  assert.ok(!childTokens.includes("dev"));
  assert.equal(mod.label, "/module");
});
