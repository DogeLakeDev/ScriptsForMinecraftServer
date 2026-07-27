/**
 * devmode.test.mjs — 纯函数门面（用临时目录隔离 configs/）
 *
 * 不测 CLI dispatch（交互相关，迁至 e2e）；只测门面合约：
 *   - 默认值 false
 *   - set + read 双向一致
 *   - 浅合并：其它字段保留
 *   - 多次切换幂等
 *   - 字符串 / 数字 / 其它非 true 一律视为 false
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { isDeveloperMode, setDeveloperMode } from "./dist/devmode.js";

let tmpDir;
let runtimeJson;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sfmc-devmode-"));
  // 隔离路径：devmode.ts 走 ROOT/configs/runtime.json，
  // 但 isDeveloperMode(root) / setDeveloperMode(root, on) 接受自定义 root —— 我们就用它。
  // 但 dist 里 ROOT 是模块顶部常量；为不依赖 ROOT，把测试文件挪到与 devmode.ts 同一 import 图。
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function makeRuntime(content) {
  const cfgDir = join(tmpDir, "configs");
  mkdirSync(cfgDir, { recursive: true });
  runtimeJson = join(cfgDir, "runtime.json");
  writeFileSync(runtimeJson, JSON.stringify(content), "utf8");
}

test("runtime 不存在 → 默认 false", () => {
  const root = mkdtempSync(join(tmpdir(), "sfmc-devmode-empty-"));
  try {
    assert.equal(isDeveloperMode(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime 缺 developer_mode → 默认 false", () => {
  makeRuntime({ initialized_at: "2024-01-01T00:00:00Z", locale: "zh-CN" });
  assert.equal(isDeveloperMode(tmpDir), false);
});

test("setDeveloperMode(true) → isDeveloperMode 返回 true", () => {
  makeRuntime({});
  setDeveloperMode(tmpDir, true);
  assert.equal(isDeveloperMode(tmpDir), true);
  const written = JSON.parse(readFileSync(runtimeJson, "utf8"));
  assert.equal(written.developer_mode, true);
});

test("setDeveloperMode(false) → 关闭", () => {
  makeRuntime({ developer_mode: true });
  setDeveloperMode(tmpDir, false);
  assert.equal(isDeveloperMode(tmpDir), false);
  const written = JSON.parse(readFileSync(runtimeJson, "utf8"));
  assert.equal(written.developer_mode, false);
});

test("浅合并：其它字段保留", () => {
  makeRuntime({ initialized_at: "2024-01-01", locale: "zh-CN" });
  setDeveloperMode(tmpDir, true);
  const written = JSON.parse(readFileSync(runtimeJson, "utf8"));
  assert.equal(written.initialized_at, "2024-01-01");
  assert.equal(written.locale, "zh-CN");
  assert.equal(written.developer_mode, true);
});

test("developer_mode=true（字面量）→ 视为 true", () => {
  // patchJson 会保持字面量 true；测试读取路径
  makeRuntime({ developer_mode: true });
  assert.equal(isDeveloperMode(tmpDir), true);
});

test("developer_mode=其它真值 / 假值 → 一律视为 false", () => {
  // 真值测试：patchJson 写入布尔值，所以这里覆盖文件模拟
  for (const v of [1, "true", "1", "yes", "on"]) {
    makeRuntime({ developer_mode: v });
    assert.equal(isDeveloperMode(tmpDir), false, `expected false for ${JSON.stringify(v)}`);
  }
  for (const v of [false, 0, null, "", "off", "false", undefined]) {
    makeRuntime({ developer_mode: v });
    assert.equal(isDeveloperMode(tmpDir), false, `expected false for ${JSON.stringify(v)}`);
  }
});

test("多次切换幂等", () => {
  makeRuntime({});
  for (let i = 0; i < 5; i++) {
    setDeveloperMode(tmpDir, i % 2 === 0);
    assert.equal(isDeveloperMode(tmpDir), i % 2 === 0);
  }
});

test("从 runtime 中挑其它字段后开启 → 已存在字段保留", () => {
  makeRuntime({ a: 1, b: { nested: true }, c: [1, 2, 3] });
  setDeveloperMode(tmpDir, true);
  const written = JSON.parse(readFileSync(runtimeJson, "utf8"));
  assert.deepEqual(written.a, 1);
  assert.deepEqual(written.b, { nested: true });
  assert.deepEqual(written.c, [1, 2, 3]);
  assert.equal(written.developer_mode, true);
});