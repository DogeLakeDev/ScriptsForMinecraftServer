/**
 * llbot-launch.test.mjs — resolveLlbotLaunch 兼容目录/可执行文件
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { llbotExeName, resolveLlbotLaunch } from "./dist/llbot-launch.js";

test("llbot_path 为目录时拼平台 exe 名", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-llbot-"));
  try {
    const { exe, cwd } = resolveLlbotLaunch(dir, "");
    assert.equal(cwd, dir);
    assert.equal(exe, path.join(dir, llbotExeName()));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("llbot_path 为 exe 时尊重 cwd", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-llbot-"));
  const exePath = path.join(dir, llbotExeName());
  fs.writeFileSync(exePath, "");
  try {
    const { exe, cwd } = resolveLlbotLaunch(exePath, dir);
    assert.equal(exe, exePath);
    assert.equal(cwd, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("空 path 用默认目录 + cwd 覆盖", () => {
  const { exe, cwd } = resolveLlbotLaunch("", "D:/custom-llbot");
  assert.equal(cwd, "D:/custom-llbot");
  const expected = `D:/custom-llbot/${llbotExeName()}`.replace(/\\/g, "/");
  assert.equal(exe.replace(/\\/g, "/"), expected);
});
