/**
 * module-log-bridge 冒烟（源文件 + strip-types，不经 testing/index）
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  installModuleLogBridge,
  shouldForwardModuleLog,
} from "./src/testing/module-log-bridge.ts";

test("shouldForwardModuleLog skips host prefixes", () => {
  assert.equal(shouldForwardModuleLog("[playground] started"), false);
  assert.equal(shouldForwardModuleLog("[objects] create Player"), false);
  assert.equal(shouldForwardModuleLog("hello from module"), true);
});

test("installModuleLogBridge notifies with module source", () => {
  const got = [];
  const handle = installModuleLogBridge("demo-mod", (p) => {
    got.push({ source: p.source, text: p.text, level: p.level });
  });
  try {
    console.log("module says hi");
    assert.equal(got.length, 1);
    assert.equal(got[0].source, "demo-mod");
    assert.equal(got[0].text, "module says hi");
    assert.equal(got[0].level, "info");
    console.log("[playground] should skip");
    assert.equal(got.length, 1);
  } finally {
    handle.dispose();
  }
});
